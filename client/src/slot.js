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
