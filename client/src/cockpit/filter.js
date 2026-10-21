// Namensfilter: nur Dinge anzeigen, deren Name eines der Stichwörter enthält (ohne Beachtung der Groß-/Kleinschreibung).
// Wird beim Erzeugen des Snapshots angewendet, damit andere Namen gar nicht erst veröffentlicht werden.
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

const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

/** Filtert die Quellen nach Namen und berechnet davon abhängige Summen neu. Summen über alle (z. B. Gesamtstatistik) bleiben. */
export function applyNameFilter(sources, keywords) {
  const match = makeMatcher(keywords);
  const out = { ...sources };
  const edit = (key, fn) => { const s = out[key]; if (s?.available) out[key] = { ...s, data: fn(structuredClone(s.data)) }; };
  const serverTotals = (items) => ({ total: items.length, running: items.filter((x) => x.state === 'running').length });

  edit('servers', (d) => { d.items = d.items.filter((x) => match(x.name)); return Object.assign(d, serverTotals(d.items)); });
  edit('health', (d) => { if (d.servers) { d.servers.items = d.servers.items.filter((x) => match(x.name)); Object.assign(d.servers, serverTotals(d.servers.items)); } return d; });
  for (const k of ['serversTop7', 'serversTop30', 'serversTop90']) {
    edit(k, (d) => { d.items = (d.items ?? []).filter((x) => match(x.name)).map((x, i) => ({ ...x, rank: i + 1 })); d.servers_with_data = d.items.length; return d; });
  }
  edit('automations', (d) => {
    d.items = d.items.filter((x) => match(x.name));
    Object.assign(d, { total: d.items.length, active: d.items.filter((x) => x.active).length, runs_today: sum(d.items, (x) => x.runs_today), errors_today: sum(d.items, (x) => x.errors_today) });
    return d;
  });
  edit('automationsHistory', (d) => { d.busiest = (d.busiest ?? []).filter((x) => match(x.name)); d.most_errors = (d.most_errors ?? []).filter((x) => match(x.name)); d.aggregate_all = true; return d; });
  edit('overview', (d) => {
    const sv = out.servers?.available ? out.servers.data : null;
    if (sv && d.servers) d.servers = { total: sv.total, running: sv.running };
    const au = out.automations?.available ? out.automations.data : null;
    if (au && d.automations) d.automations = { total: au.total, active: au.active, runs_today: au.runs_today, errors_today: au.errors_today };
    return d;
  });
  return out;
};

/** Entfernt aus dem Verlauf die Spalten der Server, die nicht zum Filter passen (sonst zählen sie bei „laufende Server“ mit). */
export function filterHistory(history, keywords) {
  const match = makeMatcher(keywords);
  const keep = history.names.map((n, i) => (match(n) ? i : -1)).filter((i) => i >= 0);
  return { names: keep.map((i) => history.names[i]), points: history.points.map(([t, row]) => [t, keep.map((i) => row[i] ?? '-').join('')]) };
}

export const filterLabel = (keywords) => keywords.map((k) => `„${k}“`).join(' oder ');
