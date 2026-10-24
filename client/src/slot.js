// Zeitraster der Aktualisierung: der Snapshot trägt den Beginn seines Intervalls (bei 2 Minuten immer eine gerade Minute),
// die Seite holt ihn kurz danach, wenn die Veröffentlichung durch ist.
export const SETTLE_MS = 120_000; // so lange dauern Bauen, Veröffentlichen und Verteilen höchstens nach dem Takt (Läufe enden 80 bis 100 s nach Intervallbeginn)

export const slotMs = (intervalMin) => Math.max(1, Number(intervalMin) || 5) * 60_000;
export const slotStart = (ms, intervalMin) => Math.floor(ms / slotMs(intervalMin)) * slotMs(intervalMin);

/** Ist der Snapshot älter als der Stand, den es jetzt geben müsste? Ohne gültige Zeit: ja. */
export function isBehind(generatedAt, nowMs, intervalMin) {
  const g = Date.parse(generatedAt);
  return !Number.isFinite(g) || g < slotStart(nowMs - SETTLE_MS, intervalMin);
}

// Selbstheilung für Seiten, die ohne Eingriff laufen (Fernseher, offener Tab)
export const STALE_RELOAD_MS = 6 * 60_000; // so lange ohne neuen Stand, dann lädt die Seite sich komplett neu
export const RELOAD_GAP_MS = 3 * 60_000; // frühestens alle 3 Minuten ein Neuladen, damit nichts in einer Schleife hängt

/** Läuft ein älterer Code als der, der den Snapshot erzeugt hat? Ohne Kennung (lokal) nie. */
export const isOutdatedCode = (running, snapApp) => Boolean(running && snapApp && running !== 'dev' && snapApp !== 'dev' && running !== snapApp);

/** Kommt seit langer Zeit kein neuer Stand an, obwohl die Seite sichtbar läuft? Dann hilft nur ein sauberes Neuladen. */
export function isStuck(generatedAt, nowMs, intervalMin, lastReloadMs = 0) {
  const g = Date.parse(generatedAt);
  const stale = !Number.isFinite(g) || nowMs - g > Math.max(STALE_RELOAD_MS, 3 * slotMs(intervalMin));
  return stale && nowMs - lastReloadMs >= RELOAD_GAP_MS;
}

// Eigener Dateiname je Intervall: ein fester Name (snapshot.enc.json) darf im Zwischenspeicher von GitHub Pages bis zu 10 Minuten alt bleiben
// (alle Dateien dort tragen max-age=600), ein Name, der nie zuvor abgerufen wurde, nicht. Die Seite fragt erst, wenn Bauen und Veröffentlichen sicher
// durch sind (sonst bliebe ein „nicht gefunden“ im Zwischenspeicher hängen), und nur Dateien, die es schon gibt: der Bau nimmt die letzten Dateien mit.
export const SLOT_FILE_DELAY_MS = SETTLE_MS;
export const SLOT_FILES_KEPT = 6; // so viele Intervall-Dateien (je 2 Minuten) liegen gleichzeitig auf der Seite
/** Dateien in Reihenfolge der Wahl: die des gerade fälligen Intervalls, dann die davor. */
export const slotFilesFor = (nowMs, intervalMin) => {
  const s = slotStart(nowMs - SLOT_FILE_DELAY_MS, intervalMin);
  return [s, s - slotMs(intervalMin), s - 2 * slotMs(intervalMin)].map((x) => `s/${x}.json`);
};
export const slotFileFor = (nowMs, intervalMin) => slotFilesFor(nowMs, intervalMin)[0];
