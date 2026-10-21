import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.js';
import { collect } from './collector.js';

test('collect liefert alle Hauptbereiche', async () => {
  const s = await collect();
  for (const k of ['cpu', 'memory', 'disks', 'network', 'processes', 'uptime']) assert.ok(k in s, k);
  assert.ok(s.memory.total > 0);
  assert.ok(Array.isArray(s.processes.topCpu));
});

test('API liefert Stats und Info', async () => {
  const app = createApp({ sample: async () => ({ cpu: { percent: 5 } }), info: async () => ({ hostname: 'x' }) });
  await app.locals.start();
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const stats = await (await fetch(`${base}/api/stats`)).json();
  assert.equal(stats.cpu.percent, 5);
  assert.equal((await (await fetch(`${base}/api/info`)).json()).hostname, 'x');
  server.close();
  app.locals.stop();
});

import { createBalubbClient } from './balubb.js';

const fakeRes = (status, body, headers = {}) => ({
  ok: status < 400, status, json: async () => body, headers: new Headers(headers),
});

test('BaLuBB-Client: ohne Key nicht konfiguriert', async () => {
  assert.deepEqual(await createBalubbClient({ key: '' })(), { configured: false });
});

test('BaLuBB-Client: sendet Bearer-Key und cached', async () => {
  let calls = 0, auth;
  const get = createBalubbClient({
    key: 'geheim', ttlMs: 60_000,
    fetchImpl: async (_u, o) => { calls++; auth = o.headers.Authorization; return fakeRes(200, { ok: true }); },
  });
  const a = await get();
  await get();
  assert.equal(calls, 1);
  assert.equal(auth, 'Bearer geheim');
  assert.equal(a.data.ok, true);
  assert.ok(!JSON.stringify(a).includes('geheim'));
});

test('BaLuBB-Client: erkennt Cloudflare-Challenge und Netzfehler', async () => {
  const challenged = await createBalubbClient({ key: 'k', ttlMs: 0, fetchImpl: async () => fakeRes(403, {}, { 'cf-mitigated': 'challenge' }) })();
  assert.match(challenged.error, /403.*Cloudflare/);
  const down = await createBalubbClient({ key: 'k', ttlMs: 0, fetchImpl: async () => { throw new Error('boom'); } })();
  assert.match(down.error, /boom/);
});

import { createCloudflareClient, summarize } from './cloudflare.js';

const cfGroups = [
  { dimensions: { date: '2026-10-20' }, uniq: { uniques: 5 }, sum: { requests: 100, cachedRequests: 40, bytes: 1000, cachedBytes: 400, threats: 2, pageViews: 30,
    responseStatusMap: [{ edgeResponseStatus: 200, requests: 90 }, { edgeResponseStatus: 403, requests: 10 }],
    countryMap: [{ clientCountryName: 'DE', requests: 80 }, { clientCountryName: 'US', requests: 20 }] } },
  { dimensions: { date: '2026-10-21' }, uniq: { uniques: 7 }, sum: { requests: 50, cachedRequests: 10, bytes: 500, cachedBytes: 100, threats: 0, pageViews: 20,
    responseStatusMap: [{ edgeResponseStatus: 200, requests: 45 }, { edgeResponseStatus: 503, requests: 5 }],
    countryMap: [{ clientCountryName: 'DE', requests: 50 }] } },
];

test('Cloudflare: summarize fasst Summen, Statusklassen und Länder zusammen', () => {
  const r = summarize(cfGroups);
  assert.equal(r.totals.requests, 150);
  assert.equal(Math.round(r.totals.cacheRate), 33);
  assert.deepEqual(r.status, [{ klass: '2xx', requests: 135 }, { klass: '4xx', requests: 10 }, { klass: '5xx', requests: 5 }]);
  assert.deepEqual(r.countries[0], { country: 'DE', requests: 130 });
  assert.equal(r.days.length, 2);
});

test('Cloudflare-Client: ohne Token/Zone nicht konfiguriert', async () => {
  assert.deepEqual(await createCloudflareClient({ token: '', zone: 'z' })(), { configured: false });
});

test('Cloudflare-Client: sendet Token, cached, Token nicht in Antwort', async () => {
  let calls = 0, auth, vars;
  const get = createCloudflareClient({
    token: 'tok-geheim', zone: 'zone1', days: 2, ttlMs: 60_000,
    fetchImpl: async (_u, o) => { calls++; auth = o.headers.Authorization; vars = JSON.parse(o.body).variables;
      return { ok: true, status: 200, json: async () => ({ data: { viewer: { zones: [{ httpRequests1dGroups: cfGroups }] } } }) }; },
  });
  const a = await get(); await get();
  assert.equal(calls, 1);
  assert.equal(auth, 'Bearer tok-geheim');
  assert.equal(vars.zone, 'zone1');
  assert.equal(a.data.totals.requests, 150);
  assert.ok(!JSON.stringify(a).includes('tok-geheim'));
});

test('Cloudflare-Client: Fehlerfälle', async () => {
  const mk = (resp) => createCloudflareClient({ token: 't', zone: 'z', ttlMs: 0, fetchImpl: async () => resp })();
  assert.match((await mk({ ok: false, status: 403, json: async () => ({}) })).error, /HTTP 403/);
  assert.match((await mk({ ok: true, status: 200, json: async () => ({ errors: [{ message: 'not authorized' }] }) })).error, /not authorized/);
  assert.match((await mk({ ok: true, status: 200, json: async () => ({ data: { viewer: { zones: [] } } }) })).error, /Zone nicht gefunden/);
});
