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

// Mock: antwortet je nach Abfrage-Text wie die echte GraphQL-/REST-API
const cfRouter = ({ failing = [], calls = [] } = {}) => async (url, o) => {
  const ok = (json) => ({ ok: true, status: 200, json: async () => json });
  if (!String(url).endsWith('/graphql')) return ok({ result: { account: { id: 'acc1' } } });
  const { query, variables } = JSON.parse(o.body);
  calls.push({ auth: o.headers.Authorization, variables });
  const z = (field, rows) => ok({ data: { viewer: { zones: [{ [field]: rows }] } } });
  if (query.includes('httpRequests1dGroups')) return z('httpRequests1dGroups', cfGroups);
  if (failing.includes('hourly') && query.includes('httpRequests1hGroups')) return ok({ errors: [{ message: 'nope' }] });
  if (query.includes('httpRequests1hGroups')) return z('httpRequests1hGroups', [{ dimensions: { datetime: 'T1' }, sum: { requests: 5, cachedRequests: 2, threats: 0 } }]);
  if (query.includes('securityAction')) return z('httpRequestsAdaptiveGroups', [
    { count: 7, dimensions: { securityAction: 'block', securitySource: 'waf' } },
    { count: 3, dimensions: { securityAction: 'block', securitySource: 'firewallrules' } },
    { count: 90, dimensions: { securityAction: '', securitySource: '' } }]);
  if (query.includes('clientRequestPath')) return z('httpRequestsAdaptiveGroups', [{ count: 40, dimensions: { clientRequestPath: '/' } }]);
  if (query.includes('rumPageload')) return ok({ data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [{ count: 12, sum: { visits: 8 }, dimensions: { requestPath: '/' } }] }] } } });
  return ok({});
};

test('Cloudflare-Client: alle Teile, Token als Bearer, Cache, Token nicht in Antwort', async () => {
  const calls = [];
  const get = createCloudflareClient({ token: 'tok-geheim', zone: 'zone1', days: 2, ttlMs: 60_000, fetchImpl: cfRouter({ calls }) });
  const a = await get();
  const n = calls.length;
  await get();
  assert.equal(calls.length, n, 'zweiter Aufruf kommt aus dem Cache');
  assert.ok(calls.every((c) => c.auth === 'Bearer tok-geheim'));
  assert.equal(a.data.totals.requests, 150);
  assert.ok(Array.isArray(a.data.days) && a.data.days.length === 2, 'days ist die Tagesliste');
  assert.deepEqual(a.data.security.actions[0], { action: 'keine', requests: 90 });
  assert.deepEqual(a.data.security.sources.find((s) => s.source === 'waf'), { source: 'waf', requests: 7 });
  assert.equal(a.data.paths[0].path, '/');
  assert.equal(a.data.hourly.length, 1);
  assert.deepEqual([a.data.web.enabled, a.data.web.visits], [true, 8]);
  assert.deepEqual(a.data.partErrors, {});
  assert.ok(!JSON.stringify(a).includes('tok-geheim'));
});

test('Cloudflare-Client: Teilfehler blockieren die Kachel nicht', async () => {
  const a = await createCloudflareClient({ token: 't', zone: 'z', ttlMs: 0, fetchImpl: cfRouter({ failing: ['hourly'] }) })();
  assert.equal(a.data.totals.requests, 150);
  assert.equal(a.data.hourly, null);
  assert.match(a.data.partErrors.hourly, /nope/);
});

test('Cloudflare-Client: Fehler im Hauptteil', async () => {
  const mk = (resp) => createCloudflareClient({ token: 't', zone: 'z', ttlMs: 0, fetchImpl: async () => resp })();
  assert.match((await mk({ ok: false, status: 403, json: async () => ({}) })).error, /HTTP 403/);
  assert.match((await mk({ ok: true, status: 200, json: async () => ({ errors: [{ message: 'not authorized' }] }) })).error, /not authorized/);
  assert.match((await mk({ ok: true, status: 200, json: async () => ({ data: { viewer: { zones: [] } } }) })).error, /Zone nicht gefunden/);
});
