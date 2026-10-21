import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKeywords, makeMatcher, applyNameFilter, filterHistory, DEFAULT_KEYWORDS } from '../client/src/cockpit/filter.js';

test('Filter: Stichwörter und Standard', () => {
  assert.deepEqual(parseKeywords(''), DEFAULT_KEYWORDS);
  assert.deepEqual(parseKeywords(undefined), ['BaLuBB', 'Bot']);
  assert.deepEqual(parseKeywords('a, b ,,c'), ['a', 'b', 'c']);
  assert.deepEqual(parseKeywords('*'), []);
  assert.deepEqual(parseKeywords('OFF'), []);
});

test('Filter: ODER, ohne Beachtung der Groß-/Kleinschreibung', () => {
  const m = makeMatcher(['BaLuBB', 'Bot']);
  for (const n of ['BaLuBB System', 'balubb statusseite', 'Test Bot 2', 'Bot Dashboard', 'BaLuBB Bot Website']) assert.ok(m(n), n);
  for (const n of ['Diamant System', 'Zammad Notification', 'Background System', 'Social Media Automation - Backend', '', undefined]) assert.ok(!m(n), String(n));
  assert.ok(makeMatcher([])('irgendwas'), 'ohne Stichwörter wird nichts gefiltert');
});

const ok = (data) => ({ available: true, data });
const sources = () => ({
  servers: ok({ total: 3, running: 2, items: [{ name: 'BaLuBB System', state: 'running' }, { name: 'Diamant System', state: 'running' }, { name: 'Test Bot 2', state: 'offline' }] }),
  health: ok({ ok: true, servers: { total: 3, running: 2, items: [{ name: 'BaLuBB System', state: 'running' }, { name: 'Diamant System', state: 'running' }] } }),
  serversTop30: ok({ servers_with_data: 3, items: [{ rank: 1, name: 'Community' }, { rank: 2, name: 'BaLuBB Treff' }, { rank: 3, name: 'Bot Club' }] }),
  automations: ok({ total: 3, active: 2, runs_today: 30, errors_today: 5, incomplete: false, items: [
    { name: 'Bot Backup', active: true, runs_today: 10, errors_today: 1 }, { name: 'Newsletter', active: true, runs_today: 20, errors_today: 4 }, { name: 'BaLuBB Status', active: false, runs_today: 0, errors_today: 0 }] }),
  automationsHistory: ok({ runs: 100, errors: 5, busiest: [{ name: 'Newsletter', runs: 50 }, { name: 'Bot Backup', runs: 20 }], most_errors: [{ name: 'Newsletter', errors: 4 }] }),
  overview: ok({ servers: { total: 3, running: 2 }, automations: { total: 3, active: 2, runs_today: 30, errors_today: 5 } }),
  tickets: ok({ total: 9 }),
});

test('Filter: Dienste, Top-Server und Abläufe nach Namen, Summen werden neu berechnet', () => {
  const s0 = sources();
  const s = applyNameFilter(s0, ['BaLuBB', 'Bot']);
  assert.deepEqual(s.servers.data.items.map((x) => x.name), ['BaLuBB System', 'Test Bot 2']);
  assert.deepEqual([s.servers.data.total, s.servers.data.running], [2, 1]);
  assert.deepEqual(s.health.data.servers.items.map((x) => x.name), ['BaLuBB System']);
  assert.deepEqual(s.serversTop30.data.items.map((x) => [x.rank, x.name]), [[1, 'BaLuBB Treff'], [2, 'Bot Club']]);
  assert.equal(s.serversTop30.data.servers_with_data, 2);
  assert.deepEqual([s.automations.data.total, s.automations.data.active, s.automations.data.runs_today, s.automations.data.errors_today], [2, 1, 10, 1]);
  assert.deepEqual(s.automationsHistory.data.busiest.map((x) => x.name), ['Bot Backup']);
  assert.deepEqual(s.automationsHistory.data.most_errors, []);
  assert.equal(s.automationsHistory.data.aggregate_all, true);
  assert.deepEqual(s.overview.data.servers, { total: 2, running: 1 });
  assert.equal(s.overview.data.automations.errors_today, 1);
  assert.equal(s.tickets.data.total, 9, 'Summen über alle bleiben');
  assert.equal(s0.servers.data.items.length, 3, 'Original bleibt unverändert');
});

test('Filter: ohne Stichwörter und bei nicht verfügbaren Quellen', () => {
  const s = sources();
  assert.deepEqual(applyNameFilter(s, []).servers.data.items.length, 3, 'ohne Stichwörter bleibt nur die Ausschlussliste');
  const out = applyNameFilter({ servers: { available: false, error: 'HTTP 500' } }, ['Bot']);
  assert.deepEqual(out.servers, { available: false, error: 'HTTP 500' });
});

test('Filter: Verlauf behält nur passende Spalten', () => {
  const h = { names: ['BaLuBB System', 'Diamant', 'Test Bot 1'], points: [[1, 'rro'], [2, 'ror'], [3, 'rr']] };
  assert.deepEqual(filterHistory(h, ['BaLuBB', 'Bot']), { names: ['BaLuBB System'], points: [[1, 'r'], [2, 'r'], [3, 'r']] });
  assert.deepEqual(filterHistory(h, []).names, ['BaLuBB System', 'Diamant']);
});

test('Filter: „Test Bot 1“ wird nie angezeigt, ähnliche Namen schon', () => {
  const m = makeMatcher(['Bot']);
  assert.equal(m('Test Bot 1'), false);
  assert.equal(m(' test bot 1 '), false);
  assert.equal(m('Test Bot 10'), true);
  assert.equal(m('Bot Club'), true);
});
