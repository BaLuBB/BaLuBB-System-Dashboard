import test from 'node:test';
import assert from 'node:assert/strict';
import { getJson } from '../client/src/net.js';

// Ein Abruf, der nie antwortet, aber auf das Abbrechen hört, wie der echte fetch
const hanging = (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('abgebrochen', 'AbortError'))));

test('hängende Anfrage wird nach der Zeitgrenze abgebrochen', async () => {
  const t0 = Date.now();
  await assert.rejects(() => getJson('x', { ms: 50, fetchFn: hanging }), /Zeitüberschreitung/);
  assert.ok(Date.now() - t0 < 1000);
});

test('hängender Antworttext wird ebenfalls abgebrochen', async () => {
  const slowBody = (url, { signal }) => Promise.resolve({ ok: true, status: 200, headers: new Headers(), json: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('abgebrochen', 'AbortError')))) });
  await assert.rejects(() => getJson('x', { ms: 50, fetchFn: slowBody }), /Zeitüberschreitung/);
});

test('normale Antwort und Fehlercodes kommen unverändert durch', async () => {
  const ok = await getJson('x', { ms: 500, fetchFn: async () => ({ ok: true, status: 200, headers: new Headers({ age: '3' }), json: async () => ({ a: 1 }) }) });
  assert.deepEqual([ok.ok, ok.status, ok.json, ok.headers.get('age')], [true, 200, { a: 1 }, '3']);
  const nf = await getJson('x', { ms: 500, fetchFn: async () => ({ ok: false, status: 404, headers: new Headers(), json: async () => { throw new Error('nicht lesen'); } }) });
  assert.deepEqual([nf.ok, nf.status, nf.json], [false, 404, undefined]);
  await assert.rejects(() => getJson('x', { ms: 500, fetchFn: async () => { throw new TypeError('Netz weg'); } }), /Netz weg/);
});
