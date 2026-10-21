import test from 'node:test';
import assert from 'node:assert/strict';
import { createBalubbSuite, SOURCES } from './balubbApi.js';

const ok = (json) => ({ ok: true, status: 200, json: async () => json, headers: new Headers() });
const fail = (status, headers = {}) => ({ ok: false, status, json: async () => ({}), headers: new Headers(headers) });

test('Suite: ohne Schlüssel nicht konfiguriert, kein Abruf', async () => {
  let calls = 0;
  assert.deepEqual(await createBalubbSuite({ key: '', fetchImpl: async () => { calls++; return ok({}); } })(), { configured: false });
  assert.equal(calls, 0);
});

test('Suite: alle Quellen, Bearer-Schlüssel, Cache, Schlüssel nicht in der Antwort', async () => {
  const seen = [];
  const get = createBalubbSuite({ key: 'geheim', ttlMs: 60_000, base: 'https://x.test/v1/',
    fetchImpl: async (url, o) => { seen.push({ url, auth: o.headers.Authorization }); return ok({ pfad: url }); } });
  const a = await get();
  const n = seen.length;
  await get();
  assert.equal(seen.length, n, 'zweiter Aufruf kommt aus dem Cache');
  assert.equal(n, Object.keys(SOURCES).length);
  assert.ok(seen.every((s) => s.auth === 'Bearer geheim'));
  assert.ok(Object.values(a.sources).every((s) => s.available));
  assert.ok(!JSON.stringify(a).includes('geheim'));
  assert.ok(a.sources.serversTop30.data.pfad.includes('days=30'));
});

test('Suite: ein Fehler betrifft nur die eigene Quelle, Rückfallpfade greifen', async () => {
  const get = createBalubbSuite({ key: 'k', ttlMs: 0,
    fetchImpl: async (url) => {
      if (url.endsWith('/tickets?days=90')) return fail(400);        // erster Pfad abgelehnt -> zweiter Pfad
      if (url.endsWith('/moderation?days=90') || url.endsWith('/moderation')) return fail(500);
      if (url.endsWith('/system')) throw new Error('boom');
      return ok({ ok: true });
    } });
  const r = await get();
  assert.equal(r.sources.tickets.available, true, 'Rückfall auf /tickets');
  assert.deepEqual([r.sources.moderation.available, r.sources.moderation.error], [false, 'HTTP 500']);
  assert.equal(r.sources.system.available, false);
  assert.match(r.sources.system.error, /nicht erreichbar/);
  assert.equal(r.sources.health.available, true);
  assert.equal(r.error, undefined, 'solange eine Quelle antwortet, gibt es keinen Gesamtfehler');
});

test('Suite: Zugang abgelehnt (401/403) probiert keine weiteren Pfade und meldet Cloudflare-Challenge', async () => {
  const paths = [];
  const r = await createBalubbSuite({ key: 'k', ttlMs: 0, sources: { tickets: ['tickets?days=90', 'tickets'], health: ['health'] },
    fetchImpl: async (url) => { paths.push(url); return fail(403, { 'cf-mitigated': 'challenge' }); } })();
  assert.equal(paths.length, 2, 'je Quelle nur ein Versuch');
  assert.match(r.error, /403.*Cloudflare/);
  assert.equal(r.sources.health.available, false);
});
