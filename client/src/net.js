/**
 * Abruf mit Zeitgrenze für Anfrage UND Antworttext. Ein hängender Abruf (Fernseher mit wackeliger Verbindung, stehengebliebene Leitung)
 * darf nie dazu führen, dass die Seite für immer auf „läuft noch“ steht und keinen neuen Versuch mehr startet.
 * Rückgabe: { ok, status, headers, json } (json nur bei ok); bei Zeitüberschreitung ein Fehler „Zeitüberschreitung“.
 */
export async function getJson(url, { ms = 12_000, fetchFn = (...a) => fetch(...a), init = {} } = {}) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, ms);
  try {
    const res = await fetchFn(url, { ...init, signal: ctrl.signal });
    const json = res.ok ? await res.json() : undefined;
    return { ok: res.ok, status: res.status, headers: res.headers, json };
  } catch (e) {
    if (timedOut) throw new Error('Zeitüberschreitung beim Abruf');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
