// Diagnose: Parameter von /servers/top (Anzahl, Rangfolge). Ausgegeben werden nur Anzahl und Rangfolge, keine Namen oder Werte.
const base = 'https://bot.balubb.de/api/ext/v1/';
const auth = { Authorization: `Bearer ${process.env.BALUBB_API_KEY}` };
const variants = ['servers/top?n=10', 'servers/top?size=10', 'servers/top?max=10', 'servers/top?take=10', 'servers/top?per_page=10', 'servers/top?top_n=10', 'servers/top?limit=5', 'servers/top?count=5&by=messages',
  'servers/top?by=tickets', 'servers/top?by=members', 'servers/top?by=member_count', 'servers/top?by=applications', 'servers/top?by=moderation', 'servers/top?by=joins'];
for (const p of variants) {
  try {
    const res = await fetch(base + p, { headers: auth, signal: AbortSignal.timeout(20_000) });
    const b = res.ok ? await res.json() : null;
    console.log(`/${p} -> HTTP ${res.status}${b ? ` · Einträge ${b.items?.length} · ranked_by=${b.ranked_by} · servers_with_data=${b.servers_with_data}` : ''}`);
  } catch (err) { console.log(`/${p} -> Fehler ${err.name}`); }
}
