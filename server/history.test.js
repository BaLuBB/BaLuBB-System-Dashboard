import test from 'node:test';
import assert from 'node:assert/strict';
import { appendPoint, emptyHistory, uptimeByServer, runningSeries, statusStrips, MAX_AGE_S } from '../client/src/history.js';

const api = (...pairs) => ({ data: { servers: { items: pairs.map(([name, state]) => ({ name, state })) } } });
const T0 = Date.UTC(2026, 9, 21, 12, 0, 0);

test('Verlauf: Punkte anhängen, neue Server erweitern names', () => {
  let h = appendPoint(emptyHistory(), api(['A', 'running'], ['B', 'offline']), T0);
  h = appendPoint(h, api(['A', 'running'], ['B', 'running'], ['C', 'starting']), T0 + 300_000);
  assert.deepEqual(h.names, ['A', 'B', 'C']);
  assert.deepEqual(h.points.map((p) => p[1]), ['ro', 'rrs']);
});

test('Verlauf: API-Fehler hängt nichts an, alte Punkte werden entfernt', () => {
  let h = appendPoint(emptyHistory(), api(['A', 'running']), T0);
  assert.equal(appendPoint(h, { error: 'x' }, T0 + 1000), h);
  h = appendPoint(h, api(['A', 'offline']), T0 + (MAX_AGE_S + 10) * 1000);
  assert.equal(h.points.length, 1);
});

test('Uptime: nur bekannte Messpunkte zählen, Serien für das Diagramm', () => {
  let h = appendPoint(emptyHistory(), api(['A', 'running']), T0);
  h = appendPoint(h, api(['A', 'offline'], ['B', 'running']), T0 + 300_000);
  h = appendPoint(h, api(['A', 'running'], ['B', 'running']), T0 + 600_000);
  const u = Object.fromEntries(uptimeByServer(h, 3600, T0 + 600_000).map((x) => [x.name, x]));
  assert.equal(Math.round(u.A.uptime), 67);
  assert.equal(u.B.uptime, 100);
  assert.equal(u.B.samples, 2);
  assert.deepEqual(runningSeries(h).map((p) => p.running), [1, 1, 2]);
});

test('Streifen: je Zeitfenster der schlechteste Zustand, ohne Messung bleibt „-“', () => {
  const h = { names: ['A', 'B'], points: [[1000, 'rr'], [1100, 'ro'], [1500, 'r-'], [2000, 'sr']] };
  const strips = statusStrips(h, 1000, 4, 2000 * 1000);
  assert.equal(strips[0].cells, 'r-rs', 'A: läuft, keine Messung, läuft, startet');
  assert.equal(strips[1].cells, 'o--r', 'B: im ersten Fenster einmal offline (schlechtester Zustand zählt), dann keine Messung, dann läuft');
});
