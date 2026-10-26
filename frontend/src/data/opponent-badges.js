const CLUB_BADGES = [
  { match: ['murialdo', 'leonardo murialdo'], image: '/escudos-rivales/murialdo.svg' },
  { match: ['los tordos', 'tordos'], image: '/escudos-rivales/los-tordos.png' },
  { match: ['marista san rafael', 'marista s rafael', 'maristas san rafael', 'maristas s rafael', 'maristas de san rafael'], image: '/escudos-rivales/marista-san-rafael-transparente.png' },
  { match: ['marista', 'maristas'], image: '/escudos-rivales/marista.png' },
  { match: ['club aleman', 'aleman'], image: '/escudos-rivales/aleman-transparente.png' },
  { match: ['vistalba'], image: '/escudos-rivales/vistalba-transparente.png' },
  { match: ['universidad nacional de san juan', 'universidad san juan', 'unsj'], image: '/escudos-rivales/UNSJ-transparente.png' },
  { match: ['universidad nacional de cuyo', 'uncuyo'], image: '/escudos-rivales/uncuyo-transparente.png' },
  { match: ['tacuru'], image: '/escudos-rivales/tacuru-transparente.png' },
  { match: ['san juan rugby club', 'san juan rugby'], image: '/escudos-rivales/san-juan-rugby-transparente.png' },
  { match: ['peumayen'], image: '/escudos-rivales/Peumayen.png' },
  { match: ['liceo'], image: '/escudos-rivales/liceo-transparente.png' },
  { match: ['teque'], image: '/escudos-rivales/images-transparente.png' },
  { match: ['bco mza', 'banco mza', 'banco mendoza', 'banco de mendoza', 'cpbm'], image: '/escudos-rivales/banco-mza.png' }
];

function normalizeClubName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(equipo|club|primera|intermedia|reserva|division|a|b|c)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getOpponentBadge(name) {
  const normalizedName = normalizeClubName(name);
  const club = CLUB_BADGES.find(({ match }) => match.some(alias => normalizedName.includes(normalizeClubName(alias))));
  return club?.image || '';
}

export function getOpponentInitials(name) {
  const words = normalizeClubName(name).split(' ').filter(Boolean);
  if (!words.length) return '?';
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0].slice(0, 2)).toUpperCase();
}
