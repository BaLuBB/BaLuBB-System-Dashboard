// Holt alle freigegebenen BaLuBB-Endpunkte (nur lesend) und liefert je Quelle getrennt Daten oder einen Fehler.
// Die API enthält ausschließlich Summen, keine Nutzernamen oder Nachrichten.
const BASE = 'https://bot.balubb.de/api/ext/v1/';

/** Pro Quelle eine Liste von Pfaden: der erste, der klappt, gewinnt (z. B. 90 Tage, sonst Standardzeitraum). */
export const SOURCES = {
  health: ['health'],
  overview: ['overview'],
  servers: ['servers'],
  serversTop: ['servers/top?limit=10', 'servers/top'],
  maintenance: ['maintenance'],
  activations: ['activations'],
  feedback: ['feedback?days=90', 'feedback'],
  customBotRequests: ['custom-bot-requests'],
  automations: ['automations'],
  automationsHistory: ['automations/history?days=30', 'automations/history?days=7', 'automations/history'],
  tickets: ['tickets?days=90', 'tickets'],
  applications: ['applications?days=90', 'applications'],
  moderation: ['moderation?days=90', 'moderation'],
  statsGlobal: ['stats/global?days=90', 'stats/global?days=30', 'stats/global'],
  dashboardActivity: ['dashboard-activity?days=30', 'dashboard-activity'],
  system: ['system'],
  counts: ['counts'],
  releases: ['releases?full=1'],
};

export function createBalubbSuite({
  key = process.env.BALUBB_API_KEY,
  base = process.env.BALUBB_API_BASE ?? BASE,
  sources = SOURCES,
  ttlMs = Number(process.env.BALUBB_TTL_MS ?? 30_000),
  fetchImpl = fetch,
} = {}) {
  let cache = null;

  async function one(paths) {
    let lastError = 'unbekannt';
    for (const p of paths) {
      try {
        const res = await fetchImpl(base + p, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
        if (res.ok) return { available: true, data: await res.json() };
        lastError = `HTTP ${res.status}${res.headers.get('cf-mitigated') === 'challenge' ? ' (Cloudflare-Challenge)' : ''}`;
        if (res.status === 401 || res.status === 403) break; // Zugang abgelehnt: weitere Pfade bringen nichts
      } catch (err) {
        lastError = `nicht erreichbar (${err.name})`;
      }
    }
    return { available: false, error: lastError };
  }

  async function load() {
    const entries = await Promise.all(Object.entries(sources).map(async ([name, paths]) => [name, await one(paths)]));
    return { sources: Object.fromEntries(entries) };
  }

  return async function get() {
    if (!key) return { configured: false };
    if (!cache || Date.now() - cache.at > ttlMs) cache = { at: Date.now(), ...(await load()) };
    const { at, ...result } = cache;
    const anyOk = Object.values(result.sources).some((s) => s.available);
    return { configured: true, fetchedAt: new Date(at).toISOString(), ...(anyOk ? result : { error: Object.values(result.sources)[0]?.error ?? 'keine Antwort', sources: result.sources }) };
  };
}
