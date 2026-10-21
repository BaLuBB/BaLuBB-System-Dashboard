const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

const QUERY = `query ($zone: String!, $from: Date!, $to: Date!) {
  viewer {
    zones(filter: { zoneTag: $zone }) {
      httpRequests1dGroups(limit: 31, orderBy: [date_ASC], filter: { date_geq: $from, date_leq: $to }) {
        dimensions { date }
        sum {
          requests cachedRequests bytes cachedBytes threats pageViews
          responseStatusMap { edgeResponseStatus requests }
          countryMap { clientCountryName requests }
        }
        uniq { uniques }
      }
    }
  }
}`;

const isoDay = (d) => d.toISOString().slice(0, 10);
const addTo = (map, key, n) => map.set(key, (map.get(key) ?? 0) + n);

/** Fasst die Tagesgruppen zu Summen, Statusklassen und Top-Ländern zusammen. */
export function summarize(groups) {
  const t = { requests: 0, cached: 0, bytes: 0, cachedBytes: 0, threats: 0, pageViews: 0 };
  const status = new Map();
  const countries = new Map();
  const days = groups.map((g) => {
    const s = g.sum;
    t.requests += s.requests; t.cached += s.cachedRequests; t.bytes += s.bytes;
    t.cachedBytes += s.cachedBytes; t.threats += s.threats; t.pageViews += s.pageViews;
    for (const r of s.responseStatusMap) addTo(status, `${String(r.edgeResponseStatus)[0]}xx`, r.requests);
    for (const c of s.countryMap) addTo(countries, c.clientCountryName, c.requests);
    return { date: g.dimensions.date, requests: s.requests, uniques: g.uniq?.uniques ?? 0 };
  });
  return {
    totals: { ...t, cacheRate: t.requests ? (t.cached / t.requests) * 100 : 0 },
    days,
    status: [...status].map(([klass, requests]) => ({ klass, requests })).sort((a, b) => a.klass.localeCompare(b.klass)),
    countries: [...countries].map(([country, requests]) => ({ country, requests })).sort((a, b) => b.requests - a.requests).slice(0, 10),
  };
}

/**
 * Cloudflare-Analytics der Zone (GraphQL). Der Token braucht nur "Zone > Analytics > Read".
 * Ergebnis wird gecacht, die Tageswerte ändern sich ohnehin nur langsam.
 */
export function createCloudflareClient({
  token = process.env.CLOUDFLARE_API_TOKEN,
  zone = process.env.CLOUDFLARE_ZONE_ID,
  days = Number(process.env.CLOUDFLARE_DAYS ?? 7),
  ttlMs = Number(process.env.CLOUDFLARE_TTL_MS ?? 300_000),
  fetchImpl = fetch,
} = {}) {
  let cache = null;

  async function load() {
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    try {
      const res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { zone, from: isoDay(from), to: isoDay(to) } }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { error: `Cloudflare antwortet mit HTTP ${res.status}` };
      const body = await res.json();
      if (body.errors?.length) return { error: `Cloudflare: ${body.errors[0].message}` };
      const groups = body.data?.viewer?.zones?.[0]?.httpRequests1dGroups;
      if (!groups) return { error: 'Zone nicht gefunden oder Token ohne Zugriff (Zone-ID und Token-Rechte prüfen)' };
      return { data: { days, ...summarize(groups) } };
    } catch (err) {
      return { error: `Cloudflare nicht erreichbar: ${err.message}` };
    }
  }

  return async function get() {
    if (!token || !zone) return { configured: false };
    if (!cache || Date.now() - cache.at > ttlMs) cache = { at: Date.now(), ...(await load()) };
    const { at, ...result } = cache;
    return { configured: true, fetchedAt: new Date(at).toISOString(), ...result };
  };
}
