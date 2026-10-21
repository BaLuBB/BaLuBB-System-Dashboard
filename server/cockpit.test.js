import test from 'node:test';
import assert from 'node:assert/strict';
import { entryView, maintenancePhase, durationText, relTime, lastN, compact, truncate, pctOf } from '../client/src/cockpit/data.js';
import { overallStatus, computeNotes } from '../client/src/cockpit/status.js';

const NOW = Date.UTC(2026, 9, 21, 12, 0, 0);
const iso = (ms) => new Date(ms).toISOString();
const snap = (over = {}) => ({
  generatedAt: iso(NOW - 60_000), intervalMin: 5,
  balubb: { configured: true, sources: {
    health: { available: true, data: { ok: true, dashboard: { ok: true }, servers: { items: [] }, maintenance: [] } },
    servers: { available: true, data: { items: [{ name: 'A', state: 'running' }, { name: 'B', state: 'running' }] } },
    maintenance: { available: true, data: { items: [] } },
    automations: { available: true, data: { errors_today: 0 } },
  } },
  cloudflare: { configured: false },
  ...over,
});
const withServers = (items) => { const s = snap(); s.balubb.sources.servers.data.items = items; return s; };

test('Cockpit-Daten: Zeit, Dauer, Zahlen, Kürzen', () => {
  assert.equal(durationText(93784), '1 Tg. 2 Std.');
  assert.equal(durationText(3700), '1 Std. 1 Min.');
  assert.equal(relTime(iso(NOW - 3 * 60_000), NOW), 'vor 3 Min.');
  assert.equal(relTime(iso(NOW + 2 * 3600_000), NOW), 'in 2 Std.');
  assert.equal(compact(1109), '1,1 Tsd.');
  assert.equal(truncate('a'.repeat(100), 10).length, 10);
  assert.deepEqual(lastN([1, 2, 3, 4], 2), [3, 4]);
  assert.deepEqual(lastN(undefined, 2), []);
  assert.equal(Math.round(pctOf(512 * 1024 * 1024, 1024 * 1024 * 1024)), 50);
});

test('Cockpit-Daten: Einträge aus „Zu erledigen“ mit unbekannten Feldnamen', () => {
  assert.deepEqual(entryView({ guild_name: 'Srv', message: 'Hallo', created_at: 'T' }), { server: 'Srv', text: 'Hallo', time: 'T' });
  assert.equal(entryView({ foo: 'nur ein Text' }).text, 'nur ein Text');
  assert.equal(entryView('roh').text, 'roh');
});

test('Wartungen: Phase läuft / geplant / vorbei', () => {
  const m = (a, b) => ({ startsAt: iso(a), endsAt: iso(b) });
  assert.equal(maintenancePhase(m(NOW - 1000, NOW + 3600_000), NOW).phase, 'running');
  assert.equal(maintenancePhase(m(NOW + 3600_000, NOW + 7200_000), NOW).phase, 'upcoming');
  assert.equal(maintenancePhase(m(NOW - 7200_000, NOW - 3600_000), NOW).phase, 'past');
});

test('Gesamtzustand: Sätze und Zustände', () => {
  assert.deepEqual([overallStatus(snap(), NOW).state, overallStatus(snap(), NOW).text], ['ok', 'Alles in Ordnung']);
  const one = overallStatus(withServers([{ name: 'A', state: 'offline' }, { name: 'B', state: 'running' }]), NOW);
  assert.deepEqual([one.state, one.text], ['warn', '1 Dienst gestört']);
  const all = overallStatus(withServers([{ name: 'A', state: 'offline' }]), NOW);
  assert.equal(all.state, 'crit');
  const stale = snap({ generatedAt: iso(NOW - 40 * 60_000) });
  assert.ok(computeNotes(stale, NOW).some((n) => n.text.includes('veraltet')));
  const maint = snap(); maint.balubb.sources.maintenance.data.items = [{ title: 'W', startsAt: iso(NOW - 1000), endsAt: iso(NOW + 1e6) }];
  assert.equal(overallStatus(maint, NOW).state, 'maint');
});
