// Kompakter Status-Verlauf: names = alle je gesehenen Server (nur anhängen), points = [Unix-Sekunden, Zustandsstring].
// Im Zustandsstring steht pro Server (Index in names) ein Zeichen: r läuft, s startet, o offline, x anderes, - unbekannt.
export const MAX_AGE_S = 7 * 86400;
const CODE = { running: 'r', starting: 's', offline: 'o' };

export const emptyHistory = () => ({ names: [], points: [] });

/** Hängt einen Messpunkt an und entfernt alles, was älter als MAX_AGE_S ist. Ohne Daten (API-Fehler) wird nichts angehängt. */
export function appendPoint(history, balubb, nowMs = Date.now()) {
  const items = balubb?.data?.servers?.items;
  if (!items) return history;
  const names = [...history.names];
  for (const { name } of items) if (!names.includes(name)) names.push(name);
  const state = new Map(items.map((s) => [s.name, CODE[s.state] ?? 'x']));
  const row = names.map((n) => state.get(n) ?? '-').join('');
  const t = Math.floor(nowMs / 1000);
  const points = [...history.points, [t, row]].filter(([ts]) => ts >= t - MAX_AGE_S);
  return { names, points };
}

/** Anteil „läuft“ pro Server im Zeitfenster (0–100) und Zahl der Messpunkte; null, wenn es keine Messpunkte gibt. */
export function uptimeByServer(history, windowS, nowMs = Date.now()) {
  const since = Math.floor(nowMs / 1000) - windowS;
  const pts = history.points.filter(([t]) => t >= since);
  return history.names.map((name, i) => {
    let known = 0, up = 0;
    for (const [, row] of pts) {
      const c = row[i] ?? '-';
      if (c === '-') continue;
      known++;
      if (c === 'r') up++;
    }
    return { name, uptime: known ? (up / known) * 100 : null, samples: known };
  });
}

/** Zeitreihe „laufende Server“ für das Diagramm. */
export function runningSeries(history) {
  return history.points.map(([t, row]) => ({ t, running: [...row].filter((c) => c === 'r').length, total: [...row].filter((c) => c !== '-').length }));
}
