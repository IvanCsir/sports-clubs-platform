const crypto = require('crypto');
const postgres = require('./postgres');

function hashInvite(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function createStaffInvite(clubSlug, email, invitedBy = '', canManageAccess = false) {
  if (!postgres.isConfigured()) throw new Error('La base de datos no está configurada.');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw new Error('Ingresá un email válido.');
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const client = await postgres.getPool().connect();
  try {
    await client.query('BEGIN');
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
    if (active.rowCount) throw new Error('Ese email ya tiene acceso al club.');
    const managers = await client.query(
      `SELECT 1 FROM sc_staff_users WHERE club_slug = $1 AND revoked_at IS NULL AND can_manage_access = TRUE LIMIT 1`,
      [clubSlug]
    );
    const inviteCanManageAccess = Boolean(canManageAccess || !managers.rowCount);
    await client.query(
      `INSERT INTO sc_staff_invites (club_slug, email, token_hash, invited_by, expires_at, can_manage_access)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', $5)`,
      [clubSlug, normalizedEmail, hashInvite(token), String(invitedBy || '').slice(0, 254), inviteCanManageAccess]
    );
    await client.query('COMMIT');
    return { token, email: normalizedEmail, expiresInDays: 7, canManageAccess: inviteCanManageAccess };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function exchangeGoogleCredential(clubSlug, credential, inviteToken = '') {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('El acceso con Google todavía no está configurado.');
  if (!credential || String(credential).length > 12000) throw new Error('No se recibió una credencial válida de Google.');
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!response.ok) throw new Error('No se pudo verificar la cuenta de Google.');
  const identity = await response.json();
  if (identity.aud !== clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(identity.iss) ||
      Number(identity.exp) * 1000 <= Date.now() || ![true, 'true'].includes(identity.email_verified) || !identity.sub || !identity.email) {
    throw new Error('La cuenta de Google no pudo verificarse.');
  }
  const email = String(identity.email).trim().toLowerCase();
  const pool = postgres.getPool();
  if (inviteToken) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE sc_staff_invites SET accepted_at = NOW()
         WHERE club_slug = $1 AND email = $2 AND token_hash = $3
           AND accepted_at IS NULL AND expires_at > NOW()
         RETURNING email, can_manage_access`,
        [clubSlug, email, hashInvite(inviteToken)]
      );
      if (!result.rowCount) throw new Error('La invitación venció, ya fue usada o pertenece a otro email. Pedí una nueva al cuerpo técnico.');
      await client.query(
        `INSERT INTO sc_staff_users (club_slug, email, google_sub, display_name, can_manage_access)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (club_slug, email) DO UPDATE SET
           google_sub = EXCLUDED.google_sub, display_name = EXCLUDED.display_name,
           can_manage_access = EXCLUDED.can_manage_access,
           revoked_at = NULL, last_login_at = NOW()`,
        [clubSlug, email, identity.sub, String(identity.name || '').slice(0, 160), result.rows[0].can_manage_access]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else {
    const result = await pool.query(
      `UPDATE sc_staff_users SET last_login_at = NOW()
       WHERE club_slug = $1 AND email = $2 AND google_sub = $3 AND revoked_at IS NULL
       RETURNING id`,
      [clubSlug, email, identity.sub]
    );
    if (!result.rowCount) throw new Error('Esa cuenta Google todavía no tiene acceso. Usá tu invitación o pedí una al cuerpo técnico.');
  }
  return { email, name: String(identity.name || '').slice(0, 160) };
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

async function revokeStaffUser(clubSlug, userId, currentEmail) {
  const client = await postgres.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT slug FROM club_catalog WHERE slug = $1 FOR UPDATE', [clubSlug]);
    const target = await client.query(
      `SELECT id, email, can_manage_access FROM sc_staff_users
       WHERE club_slug = $1 AND id = $2 AND revoked_at IS NULL`, [clubSlug, userId]
    );
    if (!target.rowCount || target.rows[0].email === String(currentEmail || '').toLowerCase()) {
      await client.query('ROLLBACK');
      return false;
    }
    if (target.rows[0].can_manage_access) {
      const managers = await client.query(
        `SELECT COUNT(*)::int AS count FROM sc_staff_users
         WHERE club_slug = $1 AND revoked_at IS NULL AND can_manage_access = TRUE`, [clubSlug]
      );
      if (managers.rows[0].count <= 1) throw new Error('El club debe conservar al menos una persona responsable de accesos.');
    }
    await client.query('UPDATE sc_staff_users SET revoked_at = NOW() WHERE club_slug = $1 AND id = $2', [clubSlug, userId]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function setStaffAccessManager(clubSlug, userId, canManageAccess, currentEmail) {
  const client = await postgres.getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT slug FROM club_catalog WHERE slug = $1 FOR UPDATE', [clubSlug]);
    const target = await client.query(
      `SELECT email, can_manage_access FROM sc_staff_users
       WHERE club_slug = $1 AND id = $2 AND revoked_at IS NULL`, [clubSlug, userId]
    );
    if (!target.rowCount) {
      await client.query('ROLLBACK');
      return false;
    }
    if (!canManageAccess && target.rows[0].email === String(currentEmail || '').toLowerCase()) {
      throw new Error('No podés quitarte el permiso de responsable. Otro responsable puede quitar tu acceso.');
    }
    if (!canManageAccess && target.rows[0].can_manage_access) {
      const managers = await client.query(
        `SELECT COUNT(*)::int AS count FROM sc_staff_users
         WHERE club_slug = $1 AND revoked_at IS NULL AND can_manage_access = TRUE`, [clubSlug]
      );
      if (managers.rows[0].count <= 1) throw new Error('El club debe conservar al menos una persona responsable de accesos.');
    }
    await client.query(
      'UPDATE sc_staff_users SET can_manage_access = $3 WHERE club_slug = $1 AND id = $2',
      [clubSlug, userId, Boolean(canManageAccess)]
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createStaffInvite, exchangeGoogleCredential, listStaffUsers, revokeStaffUser, setStaffAccessManager };
