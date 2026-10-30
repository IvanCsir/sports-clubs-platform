// Reglas para decidir si la citación guardada corresponde al próximo partido del fixture
// y qué datos del partido se muestran.

function normalizeMatchValue(value) {
  return String(value || '').trim().toLocaleLowerCase('es-AR').replace(/\s+/g, ' ');
}

export function callupMatchesFixture(meta, fixture) {
  if (!fixture) return false;
  const storedRound = meta['fecha n°'] || meta['fecha n'] || meta.fecha || '';
  const storedDate = meta.dia || meta['día'] || meta.date || '';
  const identityComparisons = [
    [fixture.round, storedRound],
    [fixture.rival, meta.rival]
  ].filter(([fixtureValue, storedValue]) => fixtureValue && storedValue);
  if (identityComparisons.length === 2) {
    return identityComparisons.every(([fixtureValue, storedValue]) =>
      normalizeMatchValue(fixtureValue) === normalizeMatchValue(storedValue)
    );
  }
  const comparisons = [...identityComparisons, [fixture.fecha, storedDate]]
    .filter(([fixtureValue, storedValue]) => fixtureValue && storedValue);
  return comparisons.length >= 2 && comparisons.every(([fixtureValue, storedValue]) =>
    normalizeMatchValue(fixtureValue) === normalizeMatchValue(storedValue)
  );
}

function dateOrdinal(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return Math.floor(date.getTime() / 86400000);
}

function parseCallupDate(value) {
  const text = String(value || '').trim();
  const localDate = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (localDate) return dateOrdinal(Number(localDate[3]), Number(localDate[2]), Number(localDate[1]));
  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDate) return dateOrdinal(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]));
  return null;
}

export function isCallupExpired(meta) {
  const matchDate = parseCallupDate(meta?.dia || meta?.['día'] || meta?.date);
  if (matchDate === null) return false;
  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const today = Object.fromEntries(todayParts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  const todayOrdinal = dateOrdinal(today.year, today.month, today.day);
  return todayOrdinal !== null && todayOrdinal - matchDate > 1;
}

export function callTimeOf(meta) {
  return meta['horario citacion'] || meta['horario citación'] || '';
}

export function matchTimeOf(meta) {
  return meta['horario partido'] || meta.partido || '';
}

// Datos visibles del próximo partido: los del fixture de AMH tienen prioridad, y los de
// la citación sólo se usan si corresponden a ese mismo partido.
export function describeNextMatch(meta, nextMatch, club) {
  const sameMatch = callupMatchesFixture(meta, nextMatch);
  const callTime = nextMatch ? (sameMatch ? callTimeOf(meta) : '') : callTimeOf(meta);
  const venue = nextMatch ? (sameMatch ? (meta.cancha || '') : '') : (meta.cancha || '');
  const matchTime = nextMatch
    ? (sameMatch && matchTimeOf(meta) ? matchTimeOf(meta) : (nextMatch.matchTime || ''))
    : matchTimeOf(meta);
  const homeVenue = nextMatch
    ? (nextMatch.homeAway === 'Local' ? `${club.shortName || club.name} (Local)` : `${nextMatch.rival} (Visitante)`)
    : 'Cancha pendiente';
  return {
    round: nextMatch?.round || meta['fecha n°'] || meta['fecha'] || 'PRÓXIMO PARTIDO',
    rival: nextMatch?.rival || meta.rival || '',
    date: nextMatch?.fecha || meta.dia || meta['día'] || 'Fecha pendiente',
    callTime,
    matchTime: matchTime || 'Horario pendiente de confirmar',
    venue: venue || homeVenue
  };
}
