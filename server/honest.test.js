// Grundsatz: fehlende Daten werden als „–“ gezeigt, nie als 0 oder sonst eine erfundene Zahl, und nichts verschwindet stillschweigend.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isNum, sumBy, diff, num, compact, pctText, bytesText, durationText, pctOf, mbToBytes } from '../client/src/cockpit/data.js';
import { applyNameFilter, statsFromServers } from '../client/src/cockpit/filter.js';
import { overallStatus } from '../client/src/cockpit/status.js';

test('Zahlen: fehlt der Wert, steht „–“; 0 bleibt eine echte Null', () => {
  for (const missing of [null, undefined, '', NaN, 'abc', true]) assert.equal(isNum(missing), false, String(missing));
  for (const real of [0, '0', 5, '7.5', -1]) assert.equal(isNum(real), true, String(real));
  assert.equal(num(null), '–'); assert.equal(num(undefined), '–'); assert.equal(num(0), '0');
  assert.equal(compact(null), '–'); assert.equal(compact(0), '0'); assert.equal(compact(12345), '12 Tsd.');
  assert.equal(pctText(null), '–'); assert.equal(pctText(0), '0 %');
  assert.equal(bytesText(undefined), '–'); assert.equal(bytesText(0), '0 B');
  assert.equal(durationText(null), '–'); assert.equal(durationText(0), '0 Min.');
  assert.equal(mbToBytes(undefined), null); assert.equal(pctOf(null, 100), null); assert.equal(pctOf(5, null), null);
});

test('Summen: nur wenn jeder Wert bekannt ist, sonst null statt einer Teilsumme', () => {
  assert.equal(sumBy([{ a: 1 }, { a: 2 }], (x) => x.a), 3);
  assert.equal(sumBy([{ a: 1 }, {}], (x) => x.a), null, 'ein fehlender Wert macht die Summe unbekannt');
  assert.equal(sumBy([{ a: 0 }, { a: 0 }], (x) => x.a), 0, 'echte Nullen sind eine echte 0');
  assert.equal(sumBy([], (x) => x.a), null, 'keine Einträge: nichts zu summieren');
  assert.equal(diff(5, 2), 3); assert.equal(diff(5, null), null);
});

const ok = (data) => ({ available: true, data });

test('Filter: fehlende Werte werden nicht zu 0 summiert', () => {
  const s = applyNameFilter({ automations: ok({ items: [{ name: 'Bot A', active: true, runs_today: 3 }, { name: 'Bot B', active: true }] }) }, ['Bot']);
  assert.equal(s.automations.data.runs_today, null, 'Läufe eines Ablaufs fehlen: keine Summe');
  assert.equal(s.automations.data.errors_today, null);
});

test('Gesamtlage aus Servern: fehlende Verläufe und Werte bleiben sichtbar unbekannt', () => {
  const top = ok({ days: 30, items: [
    { name: 'Bot A', messages: 5, daily: [{ date: '2026-10-01', messages: 4, voice_hours: 1, joins: 1, leaves: 0 }] },
    { name: 'Bot B', messages: 3 }, // kein Verlauf
    { name: 'Bot C', messages: 2, daily: [{ date: '2026-10-01', messages: 3, voice_hours: 1, joins: 2 }] }, // leaves fehlt
  ] });
  const g = statsFromServers(top);
  assert.equal(g.servers_total, 3); assert.equal(g.servers_without_daily, 1, 'Server ohne Verlauf werden gezählt und angezeigt');
  assert.deepEqual(g.daily[0], { date: '2026-10-01', messages: 7, voice_hours: 2, joins: 3, leaves: null }, 'fehlendes leaves: unbekannt, nicht 0');
  assert.equal(statsFromServers(ok({ items: [{ name: 'Bot X', messages: 1 }] })), null, 'gar keine Verläufe: nichts erfinden');
  assert.equal(statsFromServers(ok({ items: [{ name: 'Bot X', messages: 1, daily: [] }] })), null);
});

const snapWith = (sources, extra = {}) => ({ generatedAt: new Date().toISOString(), balubb: { configured: true, sources }, ...extra });

test('Gesamtzustand: ohne Serverdaten kein „Alles in Ordnung“', () => {
  const st = overallStatus(snapWith({ servers: { available: false, error: 'HTTP 500' }, health: { available: false, error: 'HTTP 500' } }));
  assert.notEqual(st.state, 'ok');
  assert.match(st.text, /unbekannt/i);
  assert.ok(st.notes.some((n) => /nicht abrufbar/.test(n.text)));
});

test('Gesamtzustand: nicht verfügbare Nebenquellen werden genannt', () => {
  const st = overallStatus(snapWith({ servers: ok({ items: [{ name: 'Bot A', state: 'running' }] }), automations: { available: false, error: 'HTTP 502' } }));
  assert.equal(st.state, 'ok');
  assert.ok(st.notes.some((n) => n.level === 'info' && /Abläufe/.test(n.text)), 'Hinweis auf die fehlende Quelle');
});
