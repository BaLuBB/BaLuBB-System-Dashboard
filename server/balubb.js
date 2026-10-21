const URL_DEFAULT = 'https://bot.balubb.de/api/ext/v1/health';

/**
 * Holt den BaLuBB-Health-Status. Ergebnis wird gecacht, weil die API auf
 * 60 Anfragen/Minute begrenzt ist und mehrere Browser dieselben Daten zeigen.
 */
export function createBalubbClient({
  key = process.env.BALUBB_API_KEY,
  url = process.env.BALUBB_API_URL ?? URL_DEFAULT,
  ttlMs = Number(process.env.BALUBB_TTL_MS ?? 30_000),
  fetchImpl = fetch,
} = {}) {
  let cache = null;

  async function load() {
    try {
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const challenged = res.headers.get('cf-mitigated') === 'challenge';
        return { error: `API antwortet mit HTTP ${res.status}${challenged ? ' (Cloudflare-Challenge)' : ''}` };
      }
      return { data: await res.json() };
    } catch (err) {
      return { error: `API nicht erreichbar: ${err.message}` };
    }
  }

  return async function get() {
    if (!key) return { configured: false };
    if (!cache || Date.now() - cache.at > ttlMs) {
      cache = { at: Date.now(), ...(await load()) };
    }
    const { at, ...result } = cache;
    return { configured: true, fetchedAt: new Date(at).toISOString(), ...result };
  };
}
