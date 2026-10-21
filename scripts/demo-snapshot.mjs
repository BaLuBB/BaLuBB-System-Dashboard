// Erzeugt einen verschlüsselten DEMO-Snapshot mit erfundenen Daten im Format der BaLuBB-API und von Cloudflare.
// Nur für die lokale Vorschau: npm run build:pages:demo, dann dist-pages/ mit einem statischen Server öffnen.
import { mkdir, writeFile } from 'node:fs/promises';
import { encryptJson } from '../client/src/crypto.js';
import { appendPoint, emptyHistory } from '../client/src/history.js';
import { applyNameFilter, filterHistory, parseKeywords } from '../client/src/cockpit/filter.js';

const password = process.env.DEMO_PASSWORD ?? 'demo-passwort-123';
const out = process.argv[2] ?? 'dist-pages';
const now = Date.now();
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const iso = (ms) => new Date(ms).toISOString();
const day = (back) => iso(now - back * 86400e3).slice(0, 10);
const series = (n, f) => Array.from({ length: n }, (_, i) => f(day(n - 1 - i), i));

const names = ['Diamant System', 'Test Bot 1', 'BaLuBB Bot Website', 'BaLuBB System', 'Zammad Notification', 'Bot Dashboard', 'Background System', 'Social Media Automation - Backend', 'Social Media Automation - Frontend', 'BaLuBB Statusseite'];
const state = ['offline', 'offline', 'running', 'running', 'offline', 'running', 'offline', 'running', 'starting', 'running'];
const servers = names.map((name, i) => ({ name, state: state[i], suspended: false, uptime_seconds: state[i] === 'running' ? 86400 * (1 + i) + 1234 : 0,
  cpu_percent: state[i] === 'running' ? 3 + rnd() * 40 : 0, memory: { used_bytes: (200 + rnd() * 700) * 2 ** 20, limit_mb: 1024 }, disk: { used_bytes: (300 + rnd() * 2500) * 2 ** 20, limit_mb: 4096 }, network: { rx_bytes: 1e9, tx_bytes: 5e8 } }));
const maintenance = [{ title: 'Wartung beim Domain-Anbieter (Sicherheitsupdates)', description: 'Vorsorglich wurden Webhosting-Dienste vom Netz genommen. Bot, Dashboard und Webseite laufen auf eigenen Servern und sind nicht betroffen.', startsAt: iso(now + 2 * 3600e3), endsAt: iso(now + 6 * 3600e3), state: 'geplant' }];
const stats = series(90, (date, i) => ({ date, messages: Math.round(300 + 400 * rnd() + i * 3), voice_hours: +(8 + rnd() * 30).toFixed(1), joins: Math.round(rnd() * 9), leaves: Math.round(rnd() * 6), tickets_created: Math.round(rnd() * 5), tickets_closed: Math.round(rnd() * 5), applications: Math.round(rnd() * 3), moderation: Math.round(rnd() * 4) }));
const top = (days) => ({ time: iso(now), days, ranked_by: 'messages', servers_with_data: 9, items: Array.from({ length: 9 }, (_, i) => {
  const f = days / 30;
  return { rank: i + 1, id: `s${i}`, name: ['Community Zentrale', 'Gaming Lounge', 'Support Hub', 'Creator Club', 'Dev Treff', 'Musik Raum', 'Clan Nord', 'Test Server', 'Anime Corner'][i],
    member_count: Math.round(2400 / (i + 1) + 40), online_count: Math.round(600 / (i + 1)), activation_status: i < 8 ? 'active' : 'deactivated',
    messages: Math.round((1200 / (i + 1)) * f), active_chatters: Math.round((90 / (i + 1)) * Math.min(f, 1.5)), voice_hours: +((60 / (i + 1)) * f).toFixed(1), joins: Math.round((30 / (i + 1)) * f), leaves: Math.round((12 / (i + 1)) * f), net_members: Math.round((18 / (i + 1)) * f),
    tickets: { total: Math.round(40 / (i + 1)), open: Math.round(4 / (i + 1)), closed: Math.round(36 / (i + 1)), created: Math.round((9 / (i + 1)) * f) },
    applications: { total: Math.round(12 / (i + 1)), by_status: { accepted: 3, rejected: 1 }, submitted: Math.round((4 / (i + 1)) * f) },
    moderation: { total: Math.round(9 / (i + 1)), by_type: { warn: 3, timeout: 2 } },
    daily: series(Math.min(days, 30), (date) => ({ date, messages: Math.round(40 * rnd() + 40 / (i + 1)), voice_hours: +(rnd() * 3).toFixed(1), joins: Math.round(rnd() * 3), leaves: Math.round(rnd() * 2) })) };
}) });
const vol = (f) => series(90, (date) => ({ date, ...f() }));

const sources = {
  health: { ok: true, time: iso(now), dashboard: { ok: true, uptime_seconds: 93784, release: { version: '2026.10.20', date: '2026-10-20' } }, servers: { total: 10, running: 5, items: servers.map(({ name, state }) => ({ name, state })) }, maintenance },
  overview: { time: iso(now), release: { version: '2026.10.20', date: '2026-10-20' } },
  servers: { time: iso(now), total: 10, running: 5, items: servers },
  serversTop7: top(7), serversTop30: top(30), serversTop90: top(90),
  maintenance: { time: iso(now), items: maintenance },
  activations: { time: iso(now), total: 12, by_status: { active: 9, deactivated: 1 }, pending_count: 3, pending: [{ server: 'BaLuBB Treff', requested_at: iso(now - 2 * 3600e3), text: 'Aktivierung angefragt' }, { server: 'Neuer Clan', requested_at: iso(now - 3 * 3600e3), text: 'Aktivierung angefragt' }, { server: 'Kochfreunde', requested_at: iso(now - 26 * 3600e3), text: 'Aktivierung angefragt' }] },
  feedback: { time: iso(now), total: 8, new_count: 3, by_status: { erledigt: 7 }, by_kind: { feedback: 8 }, days: 90, volume: vol(() => ({ received: Math.round(rnd() * 2) })), new: [{ server: 'Test Bot 1', created_at: iso(now - 4 * 3600e3), text: 'Wird nie angezeigt.' }, { server: 'Bot Club', created_at: iso(now - 6 * 3600e3), text: 'Der Ticket-Button reagiert manchmal verzögert, ansonsten super Bot! Vielen Dank.' }, { server: 'Gaming Lounge', created_at: iso(now - 5 * 3600e3), text: 'Der Ticket-Button reagiert manchmal verzögert, ansonsten super Bot! Vielen Dank für die schnelle Hilfe beim letzten Mal.' }] },
  customBotRequests: { time: iso(now), total: 3, open_count: 0, by_status: { angenommen: 3 }, open: [] },
  automations: { time: iso(now), total: 36, active: 31, runs_today: 412, errors_today: 3, incomplete: false, items: Array.from({ length: 36 }, (_, i) => ({ name: i % 3 === 0 ? `BaLuBB Ablauf ${i + 1}` : i % 3 === 1 ? `Bot Ablauf ${i + 1}` : `Newsletter ${i + 1}`, active: i % 7 !== 0, runs_today: Math.round(rnd() * 30), errors_today: i === 4 ? 3 : 0, last_run: null, last_status: null })) },
  automationsHistory: { time: iso(now), days: 7, incomplete: true, runs: 2000, errors: 14, error_rate_percent: 0.7, daily: series(7, (date) => ({ date, runs: Math.round(250 + rnd() * 80), errors: Math.round(rnd() * 4) })), most_errors: [{ name: 'Bot Ablauf 5', errors: 9 }, { name: 'Newsletter 12', errors: 5 }], busiest: [{ name: 'BaLuBB Status-Abfrage', runs: 820 }, { name: 'Bot Ticket-Benachrichtigung', runs: 410 }, { name: 'Newsletter', runs: 300 }, { name: 'Social-Media-Import', runs: 190 }, { name: 'BaLuBB Backup', runs: 70 }] },
  tickets: { time: iso(now), total: 320, open: 12, closed: 308, servers_with_tickets: 7, days: 90, volume: vol(() => ({ created: Math.round(rnd() * 6), closed: Math.round(rnd() * 6) })) },
  applications: { time: iso(now), total: 64, by_status: { rejected: 14, accepted: 41, pending: 9 }, days: 90, volume: vol(() => ({ submitted: Math.round(rnd() * 3), accepted: Math.round(rnd() * 2) })) },
  moderation: { time: iso(now), days: 90, totals: { warn: 80, ban: 6, mute: 20, kick: 9, timeout: 33 }, volume: vol(() => ({ warn: Math.round(rnd() * 3), ban: Math.round(rnd() * 0.6), mute: Math.round(rnd() * 1.4), kick: Math.round(rnd()), timeout: Math.round(rnd() * 2) })) },
  statsGlobal: { time: iso(now), days: 90, servers_with_activity: 9, active_chatters: 214, totals: {}, daily: stats },
  dashboardActivity: { time: iso(now), days: 90, total: 500, note: 'Nur Zahlen je Art und Tag, nie Namen oder Details.', by_action: ['Einstellung geändert', 'Panel erstellt', 'Rolle verknüpft', 'Ticket-Kategorie geändert', 'Turnier erstellt', 'Anmeldung', 'Export', 'Status-Abo geändert'].map((action, i) => ({ action, count: 160 - i * 18 })), daily: series(90, (date) => ({ date, actions: Math.round(rnd() * 12) })) },
  system: { time: iso(now), dashboard: { node: 'v22.12.0', uptime_seconds: 604800, memory_mb: 312, heap_mb: 140, load: [0.42, 0.38, 0.31], cpus: 4 }, wings: { version: '1.11.13', os: 'linux', architecture: 'amd64', cpu_count: 8, kernel_version: '6.8.0' } },
  counts: { time: iso(now), ticket_categories: 18, ticket_panels: 11, ticket_buttons: 26, role_links: 42, tournaments: 3, tournament_entries: 56, status_subscribers: 91, server_settings_rows: 120 },
  releases: { time: iso(now), items: Array.from({ length: 10 }, (_, i) => ({ version: `2026.10.${20 - i}`, date: `2026-10-${20 - i}`, title: ['Neues Ticket-Panel', 'Statusseite überarbeitet', 'Bewerbungen mit Vorlagen', 'Turnier-Tabellen', 'Fehlerbehebungen'][i % 5], changes: 2, items: [{ kind: 'neu', text: 'Neue Funktion für Betreiber.' }, { kind: 'fix', text: 'Ein Anzeigefehler wurde behoben.' }] })) },
};
const keywords = parseKeywords(process.env.NAME_FILTER);
const wrap = applyNameFilter(Object.fromEntries(Object.entries(sources).map(([k, data]) => [k, { available: true, data }])), keywords);
wrap.feedback.data.by_kind = { feedback: 8 };

let history = emptyHistory();
for (let k = 400; k >= 1; k--) {
  const items = servers.map((s, i) => ({ name: s.name, state: i === 2 && k > 100 && k < 140 ? 'offline' : i === 8 && k > 20 ? 'offline' : s.state }));
  history = appendPoint(history, { data: { servers: { items } } }, now - k * 300e3);
}
history = filterHistory(appendPoint(history, { data: { servers: { items: servers } } }, now), keywords);

const cfDays = series(30, (date, i) => ({ date, requests: Math.round(900 + rnd() * 1500 + i * 20), uniques: Math.round(80 + rnd() * 150), threats: Math.round(rnd() * 10) }));
const cloudflare = { configured: true, fetchedAt: iso(now - 2 * 60e3), data: {
  totals: { requests: cfDays.reduce((a, d) => a + d.requests, 0), cached: 36000, bytes: 2.4e9, cachedBytes: 1.2e9, threats: 142, pageViews: 9000, cacheRate: 52 }, days: cfDays,
  status: [{ klass: '2xx', requests: 52000 }, { klass: '3xx', requests: 2100 }, { klass: '4xx', requests: 2600 }, { klass: '5xx', requests: 130 }],
  countries: [{ country: 'DE', requests: 41000 }, { country: 'US', requests: 8000 }, { country: 'AT', requests: 3100 }, { country: 'NL', requests: 2500 }, { country: 'CH', requests: 1800 }],
  browsers: [{ browser: 'Chrome', pageViews: 5000 }], threatTypes: [{ type: 'Bot', requests: 90 }, { type: 'Anonymizer', requests: 40 }],
  hourly: Array.from({ length: 24 }, (_, i) => ({ t: iso(now - (23 - i) * 3600e3), requests: Math.round(60 + 40 * Math.sin(i / 3) + 40), cached: 50, threats: 0 })),
  security: { actions: [{ action: 'keine', requests: 2300 }, { action: 'block', requests: 17 }, { action: 'managed_challenge', requests: 6 }], sources: [{ source: 'waf', requests: 15 }] },
  paths: [{ path: '/', requests: 900 }, { path: '/api/ext/v1/health', requests: 288 }, { path: '/status', requests: 120 }, { path: '/api/ext/v1/servers', requests: 288 }],
  web: { enabled: false, pageloads: 0, visits: 0, pages: [] }, partErrors: {} } };

const snap = { generatedAt: iso(now - 2 * 60e3), intervalMin: 5, filter: { keywords }, balubb: { configured: true, fetchedAt: iso(now - 2 * 60e3), sources: wrap }, cloudflare, history };
await mkdir(out, { recursive: true });
await writeFile(`${out}/snapshot.enc.json`, JSON.stringify(await encryptJson(snap, password)));
console.log(`Demo-Snapshot geschrieben (Passwort: ${password}).`);
