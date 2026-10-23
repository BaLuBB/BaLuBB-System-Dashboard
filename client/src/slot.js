// Zeitraster der Aktualisierung: der Snapshot trägt den Beginn seines Intervalls (bei 2 Minuten immer eine gerade Minute),
// die Seite holt ihn kurz danach, wenn die Veröffentlichung durch ist.
export const SETTLE_MS = 75_000; // so lange dauern Bauen und Veröffentlichen etwa nach dem Takt

export const slotMs = (intervalMin) => Math.max(1, Number(intervalMin) || 5) * 60_000;
export const slotStart = (ms, intervalMin) => Math.floor(ms / slotMs(intervalMin)) * slotMs(intervalMin);

/** Ist der Snapshot älter als der Stand, den es jetzt geben müsste? Ohne gültige Zeit: ja. */
export function isBehind(generatedAt, nowMs, intervalMin) {
  const g = Date.parse(generatedAt);
  return !Number.isFinite(g) || g < slotStart(nowMs - SETTLE_MS, intervalMin);
}

// Selbstheilung für Seiten, die ohne Eingriff laufen (Fernseher, offener Tab)
export const STALE_RELOAD_MS = 10 * 60_000; // so lange ohne neuen Stand, dann lädt die Seite sich komplett neu
export const RELOAD_GAP_MS = 5 * 60_000; // frühestens alle 5 Minuten ein Neuladen, damit nichts in einer Schleife hängt

/** Läuft ein älterer Code als der, der den Snapshot erzeugt hat? Ohne Kennung (lokal) nie. */
export const isOutdatedCode = (running, snapApp) => Boolean(running && snapApp && running !== 'dev' && snapApp !== 'dev' && running !== snapApp);

/** Kommt seit langer Zeit kein neuer Stand an, obwohl die Seite sichtbar läuft? Dann hilft nur ein sauberes Neuladen. */
export function isStuck(generatedAt, nowMs, intervalMin, lastReloadMs = 0) {
  const g = Date.parse(generatedAt);
  const stale = !Number.isFinite(g) || nowMs - g > Math.max(STALE_RELOAD_MS, 5 * slotMs(intervalMin));
  return stale && nowMs - lastReloadMs >= RELOAD_GAP_MS;
}
