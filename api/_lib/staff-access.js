const crypto = require('crypto');
const postgres = require('./postgres');
const { ValidationError } = require('./errors');

function hashInvite(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function countActiveManagers(client, clubSlug) {
  const managers = await client.query(
    `SELECT COUNT(*)::int AS count FROM sc_staff_users
     WHERE club_slug = $1 AND revoked_at IS NULL AND can_manage_access = TRUE`, [clubSlug]
  );
  return managers.rows[0].count;
}

async function createStaffInvite(clubSlug, email, invitedBy = '', canManageAccess = false) {
  if (!postgres.isConfigured()) throw new Error('La base de datos no está configurada.');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw new ValidationError('Ingresá un email válido.');
  }
  const token = crypto.randomBytes(32).toString('base64url');
  return postgres.withTransaction(async client => {
    await client.query('SELECT slug FROM club_catalog WHERE slug = $1 FOR UPDATE', [clubSlug]);
    await client.query(
      `UPDATE sc_staff_invites SET expires_at = NOW()
       WHERE club_slug = $1 AND email = $2 AND accepted_at IS NULL`,
      [clubSlug, normalizedEmail]
    );
    const active = await client.query(
      `SELECT 1 FROM sc_staff_users WHERE club_slug = $1 AND email = $2 AND revoked_at IS NULL`,
      [clubSlug, normalizedEmail]
    );
    if (active.rowCount) throw new ValidationError('Ese email ya tiene acceso al club.');
    const inviteCanManageAccess = Boolean(canManageAccess || await countActiveManagers(client, clubSlug) === 0);
    await client.query(
      `INSERT INTO sc_staff_invites (club_slug, email, token_hash, invited_by, expires_at, can_manage_access)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', $5)`,
      [clubSlug, normalizedEmail, hashInvite(token), String(invitedBy || '').slice(0, 254), inviteCanManageAccess]
    );
    return { token, email: normalizedEmail, expiresInDays: 7, canManageAccess: inviteCanManageAccess };
  });
}

async function exchangeGoogleCredential(clubSlug, credential, inviteToken = '') {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new ValidationError('El acceso con Google todavía no está configurado.', 503);
  if (!credential || String(credential).length > 12000) throw new ValidationError('No se recibió una credencial válida de Google.', 401);
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) throw new ValidationError('No se pudo verificar la cuenta de Google.', 401);
  const identity = await response.json();
  if (identity.aud !== clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(identity.iss) ||
      Number(identity.exp) * 1000 <= Date.now() || ![true, 'true'].includes(identity.email_verified) || !identity.sub || !identity.email) {
    throw new ValidationError('La cuenta de Google no pudo verificarse.', 401);
  }
  const email = String(identity.email).trim().toLowerCase();
  const displayName = String(identity.name || '').slice(0, 160);
  if (inviteToken) {
    await postgres.withTransaction(async client => {
      const result = await client.query(
        `UPDATE sc_staff_invites SET accepted_at = NOW()
         WHERE club_slug = $1 AND email = $2 AND token_hash = $3
           AND accepted_at IS NULL AND expires_at > NOW()
         RETURNING email, can_manage_access`,
        [clubSlug, email, hashInvite(inviteToken)]
      );
      if (!result.rowCount) {
        throw new ValidationError('La invitación venció, ya fue usada o pertenece a otro email. Pedí una nueva al cuerpo técnico.', 401);
      }
      await client.query(
        `INSERT INTO sc_staff_users (club_slug, email, google_sub, display_name, can_manage_access)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (club_slug, email) DO UPDATE SET
           google_sub = EXCLUDED.google_sub, display_name = EXCLUDED.display_name,
           can_manage_access = EXCLUDED.can_manage_access,
           revoked_at = NULL, last_login_at = NOW()`,
        [clubSlug, email, identity.sub, displayName, result.rows[0].can_manage_access]
      );
    });
  } else {
    const result = await postgres.getPool().query(
      `UPDATE sc_staff_users SET last_login_at = NOW()
       WHERE club_slug = $1 AND email = $2 AND google_sub = $3 AND revoked_at IS NULL
       RETURNING id`,
      [clubSlug, email, identity.sub]
    );
    if (!result.rowCount) {
      throw new ValidationError('Esa cuenta Google todavía no tiene acceso. Usá tu invitación o pedí una al cuerpo técnico.', 401);
    }
  }
  return { email, name: displayName };
}

async function listStaffUsers(clubSlug) {
  const result = await postgres.getPool().query(
    `SELECT id, email, display_name AS "displayName", created_at AS "createdAt", last_login_at AS "lastLoginAt",
            can_manage_access AS "canManageAccess"
     FROM sc_staff_users WHERE club_slug = $1 AND revoked_at IS NULL ORDER BY display_name, email`,
    [clubSlug]
  );
  return result.rows;
}

function revokeStaffUser(clubSlug, userId, currentEmail) {
  return postgres.withTransaction(async client => {
    await client.query('SELECT slug FROM club_catalog WHERE slug = $1 FOR UPDATE', [clubSlug]);
    const target = await client.query(
      `SELECT id, email, can_manage_access FROM sc_staff_users
       WHERE club_slug = $1 AND id = $2 AND revoked_at IS NULL`, [clubSlug, userId]
    );
    if (!target.rowCount || target.rows[0].email === String(currentEmail || '').toLowerCase()) return false;
    if (target.rows[0].can_manage_access && await countActiveManagers(client, clubSlug) <= 1) {
      throw new ValidationError('El club debe conservar al menos una persona responsable de accesos.');
    }
    await client.query('UPDATE sc_staff_users SET revoked_at = NOW() WHERE club_slug = $1 AND id = $2', [clubSlug, userId]);
    return true;
  });
}

function setStaffAccessManager(clubSlug, userId, canManageAccess, currentEmail) {
  return postgres.withTransaction(async client => {
    await client.query('SELECT slug FROM club_catalog WHERE slug = $1 FOR UPDATE', [clubSlug]);
    const target = await client.query(
      `SELECT email, can_manage_access FROM sc_staff_users
       WHERE club_slug = $1 AND id = $2 AND revoked_at IS NULL`, [clubSlug, userId]
    );
    if (!target.rowCount) return false;
    if (!canManageAccess && target.rows[0].email === String(currentEmail || '').toLowerCase()) {
      throw new ValidationError('No podés quitarte el permiso de responsable. Otro responsable puede quitar tu acceso.');
    }
    if (!canManageAccess && target.rows[0].can_manage_access && await countActiveManagers(client, clubSlug) <= 1) {
      throw new ValidationError('El club debe conservar al menos una persona responsable de accesos.');
    }
    await client.query(
      'UPDATE sc_staff_users SET can_manage_access = $3 WHERE club_slug = $1 AND id = $2',
      [clubSlug, userId, Boolean(canManageAccess)]
    );
    return true;
  });
}

module.exports = { createStaffInvite, exchangeGoogleCredential, listStaffUsers, revokeStaffUser, setStaffAccessManager };
