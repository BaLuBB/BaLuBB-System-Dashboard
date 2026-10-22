import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKeywords, makeMatcher, applyNameFilter, filterHistory, DEFAULT_KEYWORDS, ALL_SERVER_SOURCES, statsFromServers } from '../client/src/cockpit/filter.js';

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
  activations: ok({ total: 5, pending_count: 3, pending: [{ server: 'Neuer Clan', text: 'a' }, { server: 'BaLuBB Treff', text: 'b' }, { name: 'Bot Zentrale', text: 'c' }] }),
  feedback: ok({ total: 8, new_count: 3, new: [{ server: 'Test Bot 1', text: 'x' }, { server_name: 'Bot Club', text: 'y' }, { text: 'ohne Servernamen' }] }),
  customBotRequests: ok({ total: 2, open_count: 1, open: [{ guild_name: 'Kochfreunde' }] }),
  tickets: ok({ total: 9 }),
  applications: ok({ total: 4 }), moderation: ok({ totals: {} }), statsGlobal: ok({ daily: [] }), dashboardActivity: ok({ daily: [] }),
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
  for (const k of ALL_SERVER_SOURCES.filter((x) => x !== 'statsGlobal')) assert.deepEqual([s[k].available, s[k].hidden], [false, true], `${k}: Summen über alle Server werden bei aktivem Filter nicht veröffentlicht`);
  assert.deepEqual([s.statsGlobal.available, s.statsGlobal.hidden], [false, undefined], 'Gesamtlage: ohne Verläufe je Server gibt es einen Fehlerzustand statt erfundener Zahlen');
  assert.match(s.statsGlobal.error, /Tagesverläufe/);
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

test('Filter: Zu-erledigen-Listen zeigen nur passende Server, Zähler folgen, Test Bot 1 nie', () => {
  const s = applyNameFilter(sources(), ['BaLuBB', 'Bot']);
  assert.deepEqual(s.activations.data.pending.map((x) => x.text), ['b', 'c']);
  assert.equal(s.activations.data.pending_count, 2);
  assert.deepEqual(s.feedback.data.new.map((x) => x.text), ['y'], 'Test Bot 1 und Eintrag ohne Namen fallen weg');
  assert.equal(s.feedback.data.new_count, 1);
  assert.deepEqual([s.customBotRequests.data.open.length, s.customBotRequests.data.open_count], [0, 0]);
  assert.equal(s.activations.data.total, undefined, 'Gesamtzahlen über alle Server werden nicht veröffentlicht');
  const off = applyNameFilter(sources(), []);
  assert.deepEqual(off.feedback.data.new.map((x) => x.text), ['y', 'ohne Servernamen'].filter((t) => t !== 'x'), 'ohne Stichwörter nur die Ausschlussliste');
});

test('Filter: Summen der „Zu erledigen“-Quellen und Dashboard-Aktivität', () => {
  const src = { ...sources(), activations: ok({ total: 5, by_status: { active: 4 }, pending_count: 1, pending: [{ server: 'Bot X' }] }), feedback: ok({ total: 9, by_kind: { a: 1 }, volume: [{ date: 'd', received: 3 }], days: 90, new_count: 0, new: [] }) };
  const s = applyNameFilter(src, ['Bot']);
  for (const k of ['total', 'by_status', 'by_kind', 'volume', 'days']) { assert.equal(s.activations.data[k], undefined, `activations.${k}`); assert.equal(s.feedback.data[k], undefined, `feedback.${k}`); }
  assert.equal(s.activations.data.pending_count, 1);
  assert.equal(s.dashboardActivity.available, true, 'Dashboard-Aktivität bleibt sichtbar (nur Summe über alle)');
});

test('Filter: ohne Stichwörter bleiben die Gesamtstatistiken sichtbar', () => {
  const s = applyNameFilter(sources(), []);
  assert.equal(s.activations.data.total, 5, 'Summen der Zu-erledigen-Quellen bleiben ohne Filter');
  assert.deepEqual(s.activations.data.by_status ?? null, s.activations.data.by_status ?? null);
  for (const k of ALL_SERVER_SOURCES) assert.equal(s[k].available, true, k);
});

test('Filter: Gesamtlage wird aus den Tagesverläufen der passenden Server zusammengesetzt', () => {
  const day = (date, m) => ({ date, messages: m, voice_hours: 1, joins: 2, leaves: 1 });
  const top = ok({ days: 30, items: [
    { name: 'BaLuBB Treff', messages: 10, active_chatters: 3, daily: [day('2026-10-01', 4), day('2026-10-02', 6)] },
    { name: 'Bot Club', messages: 5, active_chatters: 2, daily: [day('2026-10-02', 5)] },
    { name: 'Community', messages: 99, daily: [day('2026-10-01', 99)] }] });
  const s = applyNameFilter({ ...sources(), serversTop90: top, statsGlobal: ok({ daily: [day('2026-10-01', 1000)] }) }, ['BaLuBB', 'Bot']);
  const g = s.statsGlobal.data;
  assert.equal(s.statsGlobal.available, true);
  assert.deepEqual(g.daily.map((d) => [d.date, d.messages, d.joins]), [['2026-10-01', 4, 2], ['2026-10-02', 11, 4]], 'Community (99) und die Summe über alle (1000) fehlen');
  assert.deepEqual([g.servers_with_activity, g.active_chatters, g.derived], [2, 5, true]);
  assert.equal(statsFromServers({ available: true, data: { items: [{ name: 'x' }] } }), null, 'ohne Verläufe nichts erfinden');
});

test('Filter: fehlt die Liste bei „Zu erledigen“, bleibt der Zähler unbekannt statt 0', () => {
  const s = applyNameFilter({ activations: ok({ pending_count: 4 }), feedback: ok({ new: [] }) }, ['Bot']);
  assert.equal(s.activations.data.pending_count, null, 'ohne Liste keine erfundene 0');
  assert.equal(s.activations.data.pending, undefined);
  assert.equal(s.feedback.data.new_count, 0, 'eine vorhandene leere Liste ist wirklich leer');
});

test('Filter: Summen über alle Server werden auch aus der Übersicht nicht veröffentlicht', () => {
  const ov = ok({ servers: { total: 3, running: 2 }, automations: { total: 3, active: 2, runs_today: 30, errors_today: 5 },
    tickets: { total: 9 }, applications: { total: 4 }, moderation: { actions_30_days: 7 }, custom_bots: { total: 2 }, to_do: { new_feedback: 1 } });
  const on = applyNameFilter({ ...sources(), overview: ov }, ['Bot']);
  for (const k of ['tickets', 'applications', 'moderation', 'custom_bots', 'to_do']) assert.equal(on.overview.data[k], undefined, `overview.${k}`);
  assert.ok(on.overview.data.servers && on.overview.data.automations, 'Server und Abläufe bleiben (gefiltert)');
  const off = applyNameFilter({ ...sources(), overview: ov }, []);
  for (const k of ['tickets', 'applications', 'moderation', 'custom_bots', 'to_do']) assert.ok(off.overview.data[k], `ohne Filter bleibt overview.${k}`);
});

test('Filter: nach dem Filtern kommt kein fremder Servername mehr im Snapshot vor', () => {
  const FOREIGN = ['Fremd Alpha', 'Fremd Beta', 'Test Bot 1'];
  const src = {
    servers: ok({ total: 4, running: 4, items: [{ name: 'BaLuBB System', state: 'running' }, { name: 'Fremd Alpha', state: 'running' }, { name: 'Test Bot 1', state: 'running' }] }),
    health: ok({ servers: { total: 3, running: 3, items: [{ name: 'Fremd Beta', state: 'running' }, { name: 'Bot Web', state: 'running' }] } }),
    serversTop30: ok({ items: [{ name: 'Fremd Alpha', daily: [] }, { name: 'Bot Club', daily: [] }, { name: 'Test Bot 1' }] }),
    automations: ok({ items: [{ name: 'Fremd Beta Ablauf' }, { name: 'Bot Ablauf' }] }),
    automationsHistory: ok({ busiest: [{ name: 'Fremd Alpha Sync', runs: 1 }, { name: 'Bot Sync', runs: 2 }], most_errors: [{ name: 'Fremd Beta', errors: 1 }] }),
    activations: ok({ pending: [{ server: 'Fremd Alpha' }, { server: 'Bot X' }] }),
    feedback: ok({ new: [{ server: 'Test Bot 1', text: 'Fremd Beta sagt etwas' }, { server: 'BaLuBB Y', text: 'ok' }] }),
    customBotRequests: ok({ open: [{ guild_name: 'Fremd Alpha' }] }),
  };
  const text = JSON.stringify(applyNameFilter(src, ['BaLuBB', 'Bot']));
  for (const n of ['Fremd Alpha', 'Fremd Beta', 'Fremd Beta Ablauf', 'Fremd Alpha Sync', 'Test Bot 1']) assert.ok(!text.includes(n), `${n} darf nicht vorkommen`);
  for (const n of ['BaLuBB System', 'Bot Web', 'Bot Club', 'Bot Ablauf', 'Bot Sync', 'Bot X', 'BaLuBB Y']) assert.ok(text.includes(n), `${n} bleibt`);
  assert.ok(FOREIGN.length);
});

test('Gesamtlage: kein passender Server unter den Top-Servern nennt den echten Grund', async () => {
  const { applyNameFilter } = await import('../client/src/cockpit/filter.js');
  const top = { available: true, data: { days: 90, items: [{ name: 'Fremdserver', daily: [{ date: '2026-01-01', messages: 1, voice_hours: 0, joins: 0, leaves: 0 }] }] } };
  const out = applyNameFilter({ statsGlobal: { available: true, data: {} }, serversTop90: top }, ['BaLuBB', 'Bot']);
  assert.equal(out.statsGlobal.available, false);
  assert.match(out.statsGlobal.reason, /10 aktivsten Server/);
});
