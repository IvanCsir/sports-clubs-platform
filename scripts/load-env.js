const fs = require('fs');
const path = require('path');

// Carga el .env de la raíz para uso local sin pisar variables ya definidas en el entorno.
// En Vercel las variables vienen de la configuración del proyecto.
module.exports = function loadEnv() {
  const file = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    if (index > 0 && !process.env[key]) process.env[key] = line.slice(index + 1).trim();
  }
};
