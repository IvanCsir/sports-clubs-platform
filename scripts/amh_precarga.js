/**
 * Script CLI de Precarga Oficial AMH
 * Reenvía la ejecución a la librería centralizada en api/lib/amh.js
 */

require('./load-env')();
const { fetchAvailableMatches, fetchMatchesHttp, executeAmhPrecarga, matchPlayer } = require('../api/_lib/amh.js');

// Ejecución directa por CLI si se llama desde terminal
if (require.main === module) {
  const args = process.argv.slice(2);
  const divArg = args.find(a => a.startsWith('--division='))?.split('=')[1] || '1';

  console.log(`\n======================================================`);
  console.log(`🏑 TEST CLI DE PRECARGA AMH - REGATAS ANDINO`);
  console.log(`División: ${divArg === '2' ? 'Intermedia' : 'Primera'}`);
  console.log(`======================================================\n`);

  fetchAvailableMatches(divArg)
    .then(partidos => {
      console.log('Partidos disponibles en AMH:');
      console.table(partidos);
    })
    .catch(err => {
      console.error('Error:', err.message);
    });
}

module.exports = {
  fetchAvailableMatches,
  fetchMatchesHttp,
  executeAmhPrecarga,
  matchPlayer
};
