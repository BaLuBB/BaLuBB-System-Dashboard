// Namensfilter: nur Dinge anzeigen, deren Name eines der Stichwörter enthält (ohne Beachtung der Groß-/Kleinschreibung).
// Wird beim Erzeugen des Snapshots angewendet, damit andere Namen gar nicht erst veröffentlicht werden.
import { isNum, sumBy } from './data.js';

export const DEFAULT_KEYWORDS = ['BaLuBB', 'Bot'];
// Diese Namen (exakt, ohne Beachtung der Groß-/Kleinschreibung) werden nie angezeigt, auch wenn sie ein Stichwort enthalten.
export const DEFAULT_EXCLUDE = ['Test Bot 1'];

/** NAME_FILTER: leer = Standard, "*" oder "off" = kein Filter, sonst kommagetrennte Stichwörter. */
export function parseKeywords(value) {
  const v = String(value ?? '').trim();
  if (!v) return [...DEFAULT_KEYWORDS];
  if (v === '*' || v.toLowerCase() === 'off') return [];
  return v.split(',').map((k) => k.trim()).filter(Boolean);
}

export const makeMatcher = (keywords, exclude = DEFAULT_EXCLUDE) => {
  const ks = keywords.map((k) => k.toLowerCase());
  const ex = new Set(exclude.map((k) => k.trim().toLowerCase()));
  return (name) => {
    const n = String(name ?? '').trim().toLowerCase();
    return !ex.has(n) && (ks.length === 0 || ks.some((k) => n.includes(k)));
  };
};

// Namensfeld eines Listeneintrags (wie im Cockpit, damit Filter und Anzeige dasselbe meinen)
const entryName = (e) => {
  if (e == null || typeof e !== 'object') return '';
  const v = ['server', 'server_name', 'guild_name', 'guild', 'name'].map((k) => e[k]).find((x) => typeof x === 'string' && x.trim());
  return v ?? '';
};

/** Quellen mit Summen über alle Server: nach Namen nicht aufteilbar, deshalb bei aktivem Filter nicht veröffentlicht. Pro Server gibt es die Zahlen in der Top-Server-Liste. */
export const ALL_SERVER_SOURCES = ['statsGlobal', 'tickets', 'applications', 'moderation'];
export const OVERVIEW_ALL_SERVER_BLOCKS = ['tickets', 'applications', 'moderation', 'custom_bots', 'to_do'];
export const HIDDEN_NOTE = 'wegen Namensfilter nicht angezeigt';

/**
 * Gesamtlage aus den Tagesverläufen der passenden Server (summiert je Tag). Fehlt bei einem Server der Verlauf oder ein Wert,
 * wird nichts ergänzt: die Summe des Tages ist dann unbekannt (null, die Anzeige zeigt „–“) und die Zahl der Server ohne Verlauf wird mitgegeben.
 */
export function statsFromServers(topSource) {
  const items = topSource?.available ? (topSource.data.items ?? []) : [];
  const withDaily = items.filter((it) => Array.isArray(it.daily) && it.daily.length);
  if (!withDaily.length) return null;
  const FIELDS = ['messages', 'voice_hours', 'joins', 'leaves'];
  const byDate = new Map();
  for (const it of withDaily) for (const d of it.daily) {
    const row = byDate.get(d.date) ?? { date: d.date, ...Object.fromEntries(FIELDS.map((f) => [f, 0])), _bad: new Set() };
    for (const f of FIELDS) { if (isNum(d[f])) row[f] += Number(d[f]); else row._bad.add(f); }
    byDate.set(d.date, row);
  }
  const daily = [...byDate.values()].sort((a, z) => a.date.localeCompare(z.date)).map(({ _bad, ...row }) => { for (const f of _bad) row[f] = null; return row; });
  return {
    days: topSource.data.days, derived: true, totals: {},
    servers_total: items.length, servers_without_daily: items.length - withDaily.length,
    servers_with_activity: items.every((x) => isNum(x.messages)) ? items.filter((x) => Number(x.messages) > 0).length : null,
    active_chatters: sumBy(items, (x) => x.active_chatters),
    daily,
  };
}

/** Filtert die Quellen nach Namen und berechnet davon abhängige Summen neu. Summen über alle (z. B. Gesamtstatistik) bleiben. */
export function applyNameFilter(sources, keywords) {
  const match = makeMatcher(keywords);
  const out = { ...sources };
  const hide = () => ({ available: false, hidden: true, error: HIDDEN_NOTE });
  if (keywords.length) for (const k of ALL_SERVER_SOURCES) if (out[k]) out[k] = hide();
  const edit = (key, fn) => { const s = out[key]; if (s?.available) out[key] = { ...s, data: fn(structuredClone(s.data)) }; };
  const serverTotals = (items) => ({ total: items.length, running: items.filter((x) => x.state === 'running').length });

  edit('servers', (d) => { d.items = d.items.filter((x) => match(x.name)); return Object.assign(d, serverTotals(d.items)); });
  edit('health', (d) => { if (d.servers) { d.servers.items = d.servers.items.filter((x) => match(x.name)); Object.assign(d.servers, serverTotals(d.servers.items)); } return d; });
  for (const k of ['serversTop7', 'serversTop30', 'serversTop90']) {
    edit(k, (d) => { d.items = (d.items ?? []).filter((x) => match(x.name)).map((x, i) => ({ ...x, rank: i + 1 })); d.servers_with_data = d.items.length; return d; });
  }
  edit('automations', (d) => {
    d.items = d.items.filter((x) => match(x.name));
    Object.assign(d, { total: d.items.length, active: d.items.filter((x) => x.active).length, runs_today: sumBy(d.items, (x) => x.runs_today), errors_today: sumBy(d.items, (x) => x.errors_today) }); // fehlt ein Wert: null („–“), keine erfundene Summe
    return d;
  });
  edit('automationsHistory', (d) => { d.busiest = (d.busiest ?? []).filter((x) => match(x.name)); d.most_errors = (d.most_errors ?? []).filter((x) => match(x.name)); d.aggregate_all = true; return d; });
  // „Zu erledigen“: Einträge von anderen Servern fallen weg (Namen und Texte werden nicht veröffentlicht), der Zähler folgt der Liste.
  // Ein Eintrag ohne erkennbaren Servernamen wird nicht gezeigt.
  for (const [key, countKey, listKey] of [['activations', 'pending_count', 'pending'], ['feedback', 'new_count', 'new'], ['customBotRequests', 'open_count', 'open']]) {
    edit(key, (d) => {
      // Nur wenn die Liste da ist, folgt der Zähler ihr; fehlt sie, bleibt der Zähler unbekannt (null) statt 0
      if (Array.isArray(d[listKey])) { d[listKey] = d[listKey].filter((x) => match(entryName(x))); d[countKey] = d[listKey].length; } else { delete d[listKey]; d[countKey] = null; }
      if (keywords.length) for (const k of ['total', 'by_status', 'by_kind', 'volume', 'days']) delete d[k]; // Summen über alle Server nicht veröffentlichen
      return d;
    });
  }
  edit('overview', (d) => {
    const sv = out.servers?.available ? out.servers.data : null;
    if (sv && d.servers) d.servers = { total: sv.total, running: sv.running };
    const au = out.automations?.available ? out.automations.data : null;
    if (au && d.automations) d.automations = { total: au.total, active: au.active, runs_today: au.runs_today, errors_today: au.errors_today };
    // Diese Blöcke sind Summen über alle Server und lassen sich nicht nach Namen aufteilen: bei aktivem Filter nicht veröffentlichen
    if (keywords.length) for (const k of OVERVIEW_ALL_SERVER_BLOCKS) delete d[k];
    return d;
  });
  // Gesamtlage nicht verstecken, sondern aus den passenden Servern neu zusammensetzen
  if (keywords.length && out.statsGlobal) {
    const derived = statsFromServers(out.serversTop90?.available ? out.serversTop90 : out.serversTop30);
    out.statsGlobal = derived ? { available: true, data: derived } : { available: false, error: 'Tagesverläufe je Server fehlen in der API', reason: 'Tagesverläufe je Server fehlen in der API' };
  }
  return out;
};

/** Entfernt aus dem Verlauf die Spalten der Server, die nicht zum Filter passen (sonst zählen sie bei „laufende Server“ mit). */
export function filterHistory(history, keywords) {
  const match = makeMatcher(keywords);
  const keep = history.names.map((n, i) => (match(n) ? i : -1)).filter((i) => i >= 0);
  return { names: keep.map((i) => history.names[i]), points: history.points.map(([t, row]) => [t, keep.map((i) => row[i] ?? '-').join('')]) };
}

export const filterLabel = (keywords) => keywords.map((k) => `„${k}“`).join(' oder ');
