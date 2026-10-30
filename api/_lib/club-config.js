const postgres = require('./postgres');

// Valores por defecto de cada club. Sin CLUBS_CONFIG_JSON, también es el club inicial
// que `npm run db:migrate` registra en club_catalog.
const DEFAULT_CLUB = {
  slug: 'regatas-andino',
  name: 'CLUB REGATAS ANDINO',
  shortName: 'REGATAS ANDINO',
  sport: 'Hockey',
  teamName: 'PLANTEL SUPERIOR B',
  logoUrl: '/escudo-regatas-andino.png',
  theme: {
    primary: '#1e88e5',
    accent: '#00a2ff',
    danger: '#d32f2f'
  },
  tournament: {
    provider: 'amh',
    baseUrl: 'http://15.235.75.172:8080',
    tournamentId: '97',
    clubId: '3',
    teamName: 'REGATAS ANDINO',
    amhTeamName: '',
    name: 'Clausura Damas B 2026'
  },
  season: { name: '2026' },
  auth: {
    secret: ''
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Clubes del despliegue (CLUBS_CONFIG_JSON o el club por defecto) combinados con el
// catálogo de PostgreSQL, que es la fuente operativa.
async function readConfiguredClubsAsync() {
  if (!postgres.isConfigured()) return readConfiguredClubs().map(normalizeClub);
  try {
    const [clubs, deletedSlugs] = await Promise.all([
      postgres.listClubs(),
      postgres.listDeletedClubSlugs()
    ]);
    const deleted = new Set(deletedSlugs);
    const configured = readConfiguredClubs().filter(club => !deleted.has(club.slug));
    return mergeClubs(configured, clubs).map(normalizeClub);
  } catch (err) {
    console.error('[Postgres] No se pudo leer la configuración de clubes:', err.message);
    throw new Error('No se pudo acceder a la configuración de clubes.');
  }
}

function readConfiguredClubs() {
  const raw = process.env.CLUBS_CONFIG_JSON;
  if (!raw) {
    const club = clone(DEFAULT_CLUB);
    if (process.env.CT_AUTH_SECRET) club.auth.secret = process.env.CT_AUTH_SECRET;
    return [club];
  }

  try {
    const clubs = JSON.parse(raw);
    if (!Array.isArray(clubs) || clubs.length === 0) {
      throw new Error('CLUBS_CONFIG_JSON debe ser un array no vacío');
    }
    return clubs;
  } catch (error) {
    throw new Error(`Configuración de clubes inválida: ${error.message}`);
  }
}

function normalizeClub(club) {
  return {
    ...clone(DEFAULT_CLUB),
    ...club,
    theme: { ...clone(DEFAULT_CLUB.theme), ...(club.theme || {}) },
    tournament: { ...clone(DEFAULT_CLUB.tournament), ...(club.tournament || {}) },
    season: { ...clone(DEFAULT_CLUB.season), ...(club.season || {}) },
    auth: { ...clone(DEFAULT_CLUB.auth), ...(club.auth || {}) }
  };
}

async function getClubAsync(slug) {
  const clubs = await readConfiguredClubsAsync();
  return slug ? clubs.find(club => club.slug === slug) : undefined;
}

function mergeClubs(baseClubs, additionalClubs) {
  const bySlug = new Map(baseClubs.map(club => [club.slug, club]));
  additionalClubs.forEach(club => bySlug.set(club.slug, club));
  return Array.from(bySlug.values());
}

function getPublicClub(club) {
  const safeClub = clone(club);
  delete safeClub.auth;
  // Sheet identifiers are migration-only configuration and must never reach browsers.
  delete safeClub.spreadsheetId;
  delete safeClub.physicalSpreadsheetId;
  delete safeClub.dtSpreadsheetId;
  delete safeClub.dtSpreadsheetUrl;
  return safeClub;
}

module.exports = {
  DEFAULT_CLUB,
  getClubAsync,
  getPublicClub,
  readConfiguredClubs,
  readConfiguredClubsAsync
};
