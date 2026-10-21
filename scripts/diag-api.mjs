// Diagnose: welche Parameter nimmt /servers/top? Ausgegeben werden nur Anzahl und Rangfolge, keine Namen oder Werte.
const base = 'https://bot.balubb.de/api/ext/v1/';
const auth = { Authorization: `Bearer ${process.env.BALUBB_API_KEY}` };
const variants = ['servers/top', 'servers/top?limit=10', 'servers/top?limit=10&days=7', 'servers/top?limit=10&by=voice', 'servers/top?limit=10&rank=voice', 'servers/top?limit=10&sort=voice', 'servers/top?limit=10&ranked_by=voice', 'servers/top?limit=10&metric=voice', 'servers/top?top=10', 'servers/top?count=10'];
for (const p of variants) {
  try {
    const res = await fetch(base + p, { headers: auth, signal: AbortSignal.timeout(20_000) });
    const body = res.ok ? await res.json() : null;
    console.log(`/${p} -> HTTP ${res.status}${body ? ` · Einträge ${body.items?.length} · ranked_by=${body.ranked_by} · days=${body.days}${body.error ? ' · Fehler=' + String(body.error).slice(0, 80) : ''}` : ''}`);
  } catch (err) { console.log(`/${p} -> Fehler ${err.name}`); }
}
// Zeiträume der Verlaufsendpunkte: nur Länge von "volume"/"daily"
for (const p of ['stats/global?days=90', 'tickets?days=90', 'applications?days=90', 'moderation?days=90', 'feedback?days=90', 'dashboard-activity?days=90', 'automations/history?days=30', 'automations/history?days=90']) {
  try {
    const res = await fetch(base + p, { headers: auth, signal: AbortSignal.timeout(20_000) });
    const b = res.ok ? await res.json() : null;
    console.log(`/${p} -> HTTP ${res.status}${b ? ` · days=${b.days} · Reihe=${(b.daily ?? b.volume ?? []).length}${b.incomplete !== undefined ? ' · incomplete=' + b.incomplete : ''}` : ''}`);
  } catch (err) { console.log(`/${p} -> Fehler ${err.name}`); }
}
