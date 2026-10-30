// Cliente único de las API del proyecto: arma headers, serializa el body y convierte
// las respuestas con error en excepciones con el mensaje que devuelve el servidor.

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export async function api(path, { method = 'GET', token, body, fallbackError = 'No se pudo completar la operación.' } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, {
    method,
    headers,
    cache: 'no-store',
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let payload = {};
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok) throw new ApiError(payload.error || fallbackError, response.status, payload);
  return payload;
}

const clubQuery = slug => `club=${encodeURIComponent(slug)}`;

export function fetchClubConfig(slug) {
  return api(`/api/config?${clubQuery(slug)}`);
}

export function fetchClubDataset(slug, dataset, { token, fallbackError } = {}) {
  return api(`/api/club-data?${clubQuery(slug)}&dataset=${dataset}`, { token, fallbackError });
}

// Acciones de escritura de /api/club-data. Las del cuerpo técnico requieren `token`.
export function postClubAction(slug, action, data = {}, { token, fallbackError } = {}) {
  return api(`/api/club-data?${clubQuery(slug)}`, { method: 'POST', token, body: { action, ...data }, fallbackError });
}

export function deleteTrackerEvents(slug, token, idOrIds) {
  return api(`/api/club-data?${clubQuery(slug)}`, {
    method: 'DELETE',
    token,
    body: Array.isArray(idOrIds) ? { ids: idOrIds } : { id: idOrIds },
    fallbackError: 'No se pudo eliminar el evento.'
  });
}

export function signInWithGoogle(slug, googleCredential, invite) {
  return api(`/api/auth?${clubQuery(slug)}`, {
    method: 'POST',
    body: { googleCredential, invite },
    fallbackError: 'No se pudo validar la cuenta de Google.'
  });
}

export function verifySession(slug, token) {
  return api(`/api/auth?${clubQuery(slug)}`, { token });
}

export function fetchFixture(slug, division, fallbackError = 'No se pudo cargar el fixture.') {
  return api(`/api/torneo/matches?${clubQuery(slug)}&division=${division}`, { fallbackError });
}

export function fetchStandings(slug, division) {
  return api(`/api/torneo?${clubQuery(slug)}&division=${division}`, { fallbackError: 'No se pudo cargar la tabla.' });
}

export function adminApi(token, { method = 'GET', body } = {}) {
  return api('/api/admin/clubs', { method, token, body });
}
