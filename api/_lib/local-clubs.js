const fs = require('fs');
const path = require('path');

const STORE_PATH = path.resolve(__dirname, '..', '..', 'data', 'clubs.local.json');

function ensureStore() {
  const directory = path.dirname(STORE_PATH);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, '[]\n', 'utf8');
}

function readClubs() {
  ensureStore();
  const content = fs.readFileSync(STORE_PATH, 'utf8');
  const clubs = JSON.parse(content || '[]');
  if (!Array.isArray(clubs)) throw new Error('data/clubs.local.json debe contener un array JSON.');
  return clubs;
}

function createClub(config) {
  const clubs = readClubs();
  if (clubs.some(club => club.slug === config.slug)) {
    throw new Error(`Ya existe un club con slug "${config.slug}".`);
  }
  clubs.push(config);
  fs.writeFileSync(STORE_PATH, `${JSON.stringify(clubs, null, 2)}\n`, 'utf8');
  return config;
}

function updateClub(slug, config) {
  const clubs = readClubs();
  const index = clubs.findIndex(club => club.slug === slug);
  if (index === -1) throw new Error(`No existe el club "${slug}".`);
  clubs[index] = config;
  fs.writeFileSync(STORE_PATH, `${JSON.stringify(clubs, null, 2)}\n`, 'utf8');
  return config;
}

module.exports = { readClubs, createClub, updateClub, STORE_PATH };
