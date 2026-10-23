const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const clubConfigPath = path.join(root, 'api', '_lib', 'club-config.js');
const amhPath = path.join(root, 'api', '_lib', 'amh.js');
const sportsDataPath = path.join(root, 'api', '_lib', 'sports-data.js');
const precargaPath = path.join(root, 'api', 'torneo', 'precarga.js');
const clubDataPath = path.join(root, 'api', 'club-data.js');

const clubs = {
  'club-a': { slug: 'club-a', auth: { password: 'staff-a', secret: 'club-a-test-secret' } },
  'club-b': { slug: 'club-b', auth: { password: 'staff-b', secret: 'club-b-test-secret' } }
};

require.cache[clubConfigPath] = {
  id: clubConfigPath,
  filename: clubConfigPath,
  loaded: true,
  exports: { getClubAsync: async slug => clubs[slug] }
};

let precargaCalls = 0;
require.cache[amhPath] = {
  id: amhPath,
  filename: amhPath,
  loaded: true,
  exports: {
    fetchAvailableMatches: async () => [],
    executeAmhPrecarga: async () => {
      precargaCalls += 1;
      return { inscribedCount: 1 };
    }
  }
};

const calls = [];
const privateData = { citations: { primera: { players: ['A'], meta: {} } }, physicalPlayers: ['físicos'], events: ['privados'], players: [{ id: '1', name: 'A', active: true, categories: ['primera'] }] };
const sportsData = {
  getClubData: async slug => { calls.push(['getClubData', slug]); return privateData; },
  savePlayer: async (slug, body) => { calls.push(['savePlayer', slug, body]); return { id: '2', name: body.name, category: body.category, active: true }; },
  saveCallup: async (slug, body) => { calls.push(['saveCallup', slug, body]); return { callupId: 9 }; },
  saveEvent: async (slug, body) => { calls.push(['saveEvent', slug, body]); return { id: 1 }; },
  replaceMatchEvents: async (slug, body) => { calls.push(['replaceMatchEvents', slug, body]); return { saved: body.events.length }; },
  deleteEvent: async (slug, id) => { calls.push(['deleteEvent', slug, id]); return true; },
  savePhysicalAssessment: async (slug, body) => { calls.push(['savePhysicalAssessment', slug, body]); return { assessmentId: 3 }; }
};
require.cache[sportsDataPath] = {
  id: sportsDataPath,
  filename: sportsDataPath,
  loaded: true,
  exports: sportsData
};

const auth = require(path.join(root, 'api', 'auth.js'));
const precargaHandler = require(precargaPath);
const clubDataHandler = require(clubDataPath);

function responseRecorder() {
  return {
    status: null,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(status, headers = {}) { this.status = status; Object.assign(this.headers, headers); },
    end(body = '') { this.body = body; }
  };
}

function request({ method = 'POST', path: pathname, club = 'club-a', token, body } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = pathname || `/api/club-data?club=${club}`;
  req.headers = { host: 'localhost', ...(token ? { authorization: `Bearer ${token}` } : {}) };
  if (body) req.body = body;
  return req;
}

function staffToken(club = 'club-a') {
  return auth.createSessionToken(clubs[club]).token;
}

function precargaRequest({ club = 'club-a', token } = {}) {
  const req = request({ path: `/api/torneo/precarga?club=${club}`, club, token, body: { clubSlug: club, players: ['Jugadora'] } });
  return req;
}

test('precarga rejects missing session without executing the external action', async () => {
  precargaCalls = 0;
  const res = responseRecorder();
  await precargaHandler(precargaRequest(), res);
  assert.equal(res.status, 401);
  assert.equal(precargaCalls, 0);
});

test('precarga rejects a session issued for another club', async () => {
  precargaCalls = 0;
  const res = responseRecorder();
  await precargaHandler(precargaRequest({ club: 'club-a', token: staffToken('club-b') }), res);
  assert.equal(res.status, 401);
  assert.equal(precargaCalls, 0);
});

test('precarga allows a valid session for the selected club', async () => {
  precargaCalls = 0;
  const res = responseRecorder();
  await precargaHandler(precargaRequest({ token: staffToken() }), res);
  assert.equal(res.status, 200);
  assert.equal(precargaCalls, 1);
  assert.deepEqual(JSON.parse(res.body), { success: true, result: { inscribedCount: 1 } });
});

test('club session signatures cannot be reused across clubs', () => {
  const token = staffToken();
  assert.equal(auth.verifySessionToken(token, clubs['club-a']).valid, true);
  assert.equal(auth.verifySessionToken(token, clubs['club-b']).valid, false);
});

test('public citation reads omit private physical and match data', async () => {
  calls.length = 0;
  const res = responseRecorder();
  await clubDataHandler(request({ method: 'GET', path: '/api/club-data?club=club-a&dataset=citations' }), res);
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), { citations: privateData.citations });
  assert.deepEqual(calls, [['getClubData', 'club-a']]);
});

test('staff data rejects missing and cross-club sessions', async t => {
  for (const [label, token] of [['missing session', null], ['session from another club', staffToken('club-b')]]) {
    await t.test(label, async () => {
      const res = responseRecorder();
      await clubDataHandler(request({ method: 'GET', path: '/api/club-data?club=club-a&dataset=staff', token }), res);
      assert.equal(res.status, 401);
      assert.match(JSON.parse(res.body).error, /Sesión inválida/);
    });
  }
});

test('staff data is returned only to a matching club session', async () => {
  calls.length = 0;
  const res = responseRecorder();
  await clubDataHandler(request({ method: 'GET', path: '/api/club-data?club=club-a&dataset=staff', token: staffToken() }), res);
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), { events: privateData.events, physicalPlayers: privateData.physicalPlayers, players: privateData.players });
});

test('database writes reject a missing or cross-club session before persistence', async t => {
  calls.length = 0;
  for (const [label, token] of [['missing session', null], ['session from another club', staffToken('club-b')]]) {
    await t.test(label, async () => {
      const res = responseRecorder();
      await clubDataHandler(request({ body: { action: 'save-callup', category: 'primera', players: [] }, token }), res);
      assert.equal(res.status, 401);
      assert.equal(calls.length, 0);
    });
  }
});

test('database writes use the authenticated club scope', async () => {
  calls.length = 0;
  const res = responseRecorder();
  await clubDataHandler(request({ token: staffToken(), body: { action: 'save-callup', category: 'primera', players: ['Jugadora'] } }), res);
  assert.equal(res.status, 200);
  assert.deepEqual(calls[0], ['saveCallup', 'club-a', { action: 'save-callup', category: 'primera', players: ['Jugadora'] }]);
});

test('adding players requires a matching club session and persists only in that club', async t => {
  calls.length = 0;
  for (const [label, token] of [['missing session', null], ['session from another club', staffToken('club-b')]]) {
    await t.test(label, async () => {
      const res = responseRecorder();
      await clubDataHandler(request({ token, body: { action: 'save-player', name: 'Nueva', category: 'primera' } }), res);
      assert.equal(res.status, 401);
      assert.equal(calls.length, 0);
    });
  }
  const res = responseRecorder();
  const body = { action: 'save-player', name: ' Nueva Jugadora ', category: '5ta' };
  await clubDataHandler(request({ token: staffToken(), body }), res);
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [['savePlayer', 'club-a', body]]);
});

test('adding players rejects invalid names and categories', async t => {
  for (const body of [
    { action: 'save-player', name: '  ', category: 'primera' },
    { action: 'save-player', name: 'Jugadora', category: 'otra' }
  ]) {
    await t.test(JSON.stringify(body), async () => {
      calls.length = 0;
      const res = responseRecorder();
      await clubDataHandler(request({ token: staffToken(), body }), res);
      assert.equal(res.status, 400);
      assert.equal(calls.length, 0);
    });
  }
});
