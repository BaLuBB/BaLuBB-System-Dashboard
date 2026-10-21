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
