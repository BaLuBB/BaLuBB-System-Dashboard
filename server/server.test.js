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
