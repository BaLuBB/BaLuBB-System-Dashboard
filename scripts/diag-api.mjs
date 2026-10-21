// Diagnose: liest die dokumentierten BaLuBB-Endpunkte und gibt NUR die Struktur aus (Typen, Anzahl), nie Werte.
// Logs öffentlicher Repos sind öffentlich: keine Namen, Zahlen oder Texte ausgeben.
const base = 'https://bot.balubb.de/api/ext/v1/';
const auth = { Authorization: `Bearer ${process.env.BALUBB_API_KEY}` };
const paths = [
  'health', 'overview', 'servers', 'servers/top', 'maintenance', 'activations', 'feedback', 'custom-bot-requests',
  'automations', 'automations/history?days=7', 'tickets', 'applications', 'moderation',
  'stats/global?days=30', 'dashboard-activity?days=30', 'system', 'counts', 'releases?full=1',
];

const shape = (v, d = 0) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return v.length ? `[${v.length}× ${shape(v[0], d + 1)}]` : '[leer]';
  if (typeof v === 'object') return d > 6 ? '{…}' : `{ ${Object.entries(v).map(([k, x]) => `${k}: ${shape(x, d + 1)}`).join(', ')} }`;
  return typeof v === 'string' ? (v.length > 30 ? 'string(lang)' : 'string') : typeof v;
};

for (const p of paths) {
  try {
    const res = await fetch(base + p, { headers: auth, signal: AbortSignal.timeout(20_000) });
    const type = res.headers.get('content-type') ?? '';
    console.log(`\n## /${p} -> HTTP ${res.status}`);
    if (res.ok && type.includes('json')) console.log(shape(await res.json()));
    else if (!res.ok) console.log('(kein Inhalt ausgegeben)');
  } catch (err) {
    console.log(`\n## /${p} -> Fehler: ${err.name}`);
  }
}
