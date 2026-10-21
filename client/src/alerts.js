// Leitet aus dem Snapshot Warnungen ab. Reihenfolge: crit vor warn vor info.
const ORDER = { crit: 0, warn: 1, info: 2 };
const fmt = (ms) => new Date(ms).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });

export function computeAlerts(snap, nowMs = Date.now()) {
  const out = [];
  const add = (level, text) => out.push({ level, text });

  const interval = snap.intervalMin ?? 5;
  const ageMin = (nowMs - Date.parse(snap.generatedAt)) / 60000;
  if (ageMin > interval * 3 + 2) add('warn', `Daten veraltet: Stand vor ${Math.round(ageMin)} Minuten (erwartet: alle ${interval} Minuten).`);

  const b = snap.balubb;
  if (b && b.configured !== false) {
    if (b.error) add('crit', `BaLuBB-API nicht abrufbar: ${b.error}`);
    else if (b.data) {
      const d = b.data;
      if (d.ok === false || d.dashboard?.ok === false) add('crit', 'BaLuBB meldet ein Problem (ok = false).');
      const items = d.servers?.items ?? [];
      const offline = items.filter((s) => s.state === 'offline').map((s) => s.name);
      const starting = items.filter((s) => s.state === 'starting').map((s) => s.name);
      if (offline.length) add('warn', `${offline.length} von ${items.length} Servern offline: ${offline.join(', ')}.`);
      if (starting.length) add('info', `Startet gerade: ${starting.join(', ')}.`);
      for (const m of d.maintenance ?? []) {
        const start = Date.parse(m.startsAt), end = Date.parse(m.endsAt);
        if (nowMs >= start && nowMs <= end) add('warn', `Wartung läuft: ${m.title} (bis ${fmt(end)}).`);
        else if (start > nowMs && start - nowMs < 24 * 3600 * 1000) add('info', `Wartung geplant: ${m.title} ab ${fmt(start)}.`);
      }
    }
  }

  const c = snap.cloudflare;
  if (c && c.configured !== false) {
    if (c.error) add('warn', `Cloudflare nicht abrufbar: ${c.error}`);
    else if (c.data) {
      const total = c.data.totals?.requests ?? 0;
      const e5 = (c.data.status ?? []).find((s) => s.klass === '5xx')?.requests ?? 0;
      if (total > 0 && e5 / total > 0.01) add('warn', `${((e5 / total) * 100).toFixed(1)} % der Anfragen endeten mit einem 5xx-Serverfehler.`);
    }
  }
  return out.sort((a, z) => ORDER[a.level] - ORDER[z.level]);
}
