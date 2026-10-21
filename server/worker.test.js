import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../cloudflare-worker/worker.js';

test('Worker: ruft den Workflow-Start von GitHub mit Token und ref main auf', async () => {
  let seen;
  const ok = await dispatch({ GH_TOKEN: 'tok' }, async (url, init) => { seen = { url, init }; return { status: 204 }; });
  assert.equal(ok, 204);
  assert.equal(seen.url, 'https://api.github.com/repos/BaLuBB/BaLuBB-System-Dashboard/actions/workflows/pages.yml/dispatches');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(seen.init.body), { ref: 'main' });
});

test('Worker: fehlendes Token und Fehlerantworten werden gemeldet', async () => {
  await assert.rejects(() => dispatch({}), /GH_TOKEN fehlt/);
  await assert.rejects(() => dispatch({ GH_TOKEN: 'x' }, async () => ({ status: 403 })), /HTTP 403/);
});
