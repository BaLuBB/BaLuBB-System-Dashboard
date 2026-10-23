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

const NAME_KEYS = new Set(['name', 'server', 'server_name', 'guild_name', 'guild']);
const LIST_KEYS = new Set(['items', 'servers', 'by_server', 'top_servers', 'top']);
/** Entfernt Namen und Listen je Server: übrig bleiben nur Summen, die sich nicht auf einen Servernamen zurückführen lassen. */
export function stripNames(v) {
  if (Array.isArray(v)) return v.map(stripNames);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (NAME_KEYS.has(k)) continue;
      if (LIST_KEYS.has(k) && Array.isArray(x) && x.some((e) => e && typeof e === 'object')) continue;
      o[k] = stripNames(x);
    }
    return o;
  }
  return v;
}

/** Quellen mit Summen über alle Server: nach Namen nicht aufteilbar. Bei aktivem Filter bleiben nur die Summen (ohne Namen), gekennzeichnet mit allServers; Zahlen je Server gibt es nur in der Top-Server-Liste. */
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
  // Die API ordnet Tickets, Bewerbungen und Moderation keinem Dienstnamen zu: es bleiben die echten Summen über alle Server, ohne Namen und klar gekennzeichnet
  if (keywords.length) {
    for (const k of ALL_SERVER_SOURCES) {
      const raw = sources[k];
      if (!raw) continue;
      out[k] = k === 'statsGlobal' ? hide() : raw.available ? { available: true, data: { ...stripNames(raw.data), allServers: true } } : raw;
    }
  }
  const edit = (key, fn) => { const s = out[key]; if (s?.available) out[key] = { ...s, data: fn(structuredClone(s.data)) }; };
  const serverTotals = (items) => ({ total: items.length, running: items.filter((x) => x.state === 'running').length });

  edit('servers', (d) => { d.items = d.items.filter((x) => match(x.name)); return Object.assign(d, serverTotals(d.items)); });
  edit('health', (d) => { if (d.servers) { d.servers.items = d.servers.items.filter((x) => match(x.name)); Object.assign(d.servers, serverTotals(d.servers.items)); } return d; });
  for (const k of ['serversTop7', 'serversTop30', 'serversTop90']) {
    edit(k, (d) => {
      const all = d.items ?? [];
      let items = all.filter((x) => match(x.name));
      // Die API liefert nur die 10 aktivsten Server und ordnet sie keinem Dienst zu: passt keiner zum Filter, bleibt die echte Liste (ohne Ausschlussnamen), gekennzeichnet
      if (!items.length && keywords.length) { { const any = makeMatcher([]); items = all.filter((x) => any(x.name)); } if (items.length) d.allServers = true; }
      d.items = items.map((x, i) => ({ ...x, rank: i + 1 }));
      if (!d.allServers) d.servers_with_data = d.items.length;
      return d;
    });
  }
  edit('automations', (d) => {
    d.items = d.items.filter((x) => match(x.name));
    Object.assign(d, { total: d.items.length, active: d.items.filter((x) => x.active).length, runs_today: sumBy(d.items, (x) => x.runs_today), errors_today: sumBy(d.items, (x) => x.errors_today) }); // fehlt ein Wert: null („–“), keine erfundene Summe
    return d;
  });
  edit('automationsHistory', (d) => { d.busiest = (d.busiest ?? []).filter((x) => match(x.name)); d.most_errors = (d.most_errors ?? []).filter((x) => match(x.name)); d.aggregate_all = true; return d; });
  // „Zu erledigen“ (Aktivierungen, Feedback, Custom-Bot-Anfragen) sind Aufgaben und werden NIE nach Namen gefiltert: ein neuer Server ohne „BaLuBB“ oder „Bot“
  // im Namen muss trotzdem erscheinen. Nur die Ausschlussliste (z. B. „Test Bot 1“) gilt; der Zähler der API bleibt, abzüglich der ausgeschlossenen Einträge.
  const notExcluded = makeMatcher([]);
  for (const [key, countKey, listKey] of [['activations', 'pending_count', 'pending'], ['feedback', 'new_count', 'new'], ['customBotRequests', 'open_count', 'open']]) {
    edit(key, (d) => {
      if (Array.isArray(d[listKey])) {
        const kept = d[listKey].filter((x) => notExcluded(entryName(x)));
        const removed = d[listKey].length - kept.length;
        d[listKey] = kept;
        d[countKey] = isNum(d[countKey]) ? Math.max(0, Number(d[countKey]) - removed) : kept.length;
      } else { delete d[listKey]; d[countKey] = isNum(d[countKey]) ? Number(d[countKey]) : null; } // ohne Liste: Zähler der API, sonst unbekannt statt 0
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
  // Gesamtlage nicht verstecken: aus den passenden Servern neu zusammensetzen. Geht das nicht (die API liefert Tagesverläufe nur für die 10 aktivsten Server),
  // bleiben die echten Zahlen über alle Server stehen, ausdrücklich so gekennzeichnet (allServers) – nichts wird erfunden oder umgerechnet.
  if (keywords.length && out.statsGlobal) {
    const raw = sources.statsGlobal;
    const top = out.serversTop90?.available ? out.serversTop90 : out.serversTop30;
    const derived = top?.data?.allServers ? null : statsFromServers(top);
    const reason = top?.available && (top.data.allServers || !(top.data.items ?? []).length)
      ? `Für Server mit ${filterLabel(keywords)} im Namen liefert die API keine Tageswerte`
      : 'Tagesverläufe je Server fehlen in der API';
    if (derived) out.statsGlobal = { available: true, data: derived };
    else if (raw.available && Array.isArray(raw.data?.daily) && raw.data.daily.length) out.statsGlobal = { available: true, data: { ...raw.data, allServers: true, filterNote: reason } };
    else out.statsGlobal = { available: false, error: reason, reason };
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

/** Dauerhafter Hinweis, welche Listen gefiltert sind und was alle Server zählt (leer ohne Filter). */
export const filterHint = (snap) => (snap.filter?.keywords?.length
  ? `Server, Container und Abläufe: nur mit ${filterLabel(snap.filter.keywords)} im Namen. Aufgaben, Tickets, Bewerbungen und Moderation: alle Server.`
  : '');
