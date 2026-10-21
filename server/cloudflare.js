const API = 'https://api.cloudflare.com/client/v4';
const HOUR = 3_600_000;
const iso = (ms) => new Date(ms).toISOString();
const day = (ms) => iso(ms).slice(0, 10);
const addTo = (map, key, n) => map.set(key, (map.get(key) ?? 0) + n);
const top = (map, keyName, n = 10) =>
  [...map].map(([k, requests]) => ({ [keyName]: k, requests })).sort((a, b) => b.requests - a.requests).slice(0, n);

const DAILY = `query ($zone: String!, $from: Date!, $to: Date!) {
  viewer { zones(filter: { zoneTag: $zone }) {
    httpRequests1dGroups(limit: 31, orderBy: [date_ASC], filter: { date_geq: $from, date_leq: $to }) {
      dimensions { date }
      sum {
        requests cachedRequests bytes cachedBytes threats pageViews
        responseStatusMap { edgeResponseStatus requests }
        countryMap { clientCountryName requests }
        browserMap { uaBrowserFamily pageViews }
        threatPathingMap { threatPathingName requests }
      }
      uniq { uniques }
    }
  } }
}`;
const HOURLY = `query ($zone: String!, $from: Time!, $to: Time!) {
  viewer { zones(filter: { zoneTag: $zone }) {
    httpRequests1hGroups(limit: 48, orderBy: [datetime_ASC], filter: { datetime_geq: $from, datetime_leq: $to }) {
      dimensions { datetime } sum { requests bytes cachedRequests threats }
    }
  } }
}`;
const ADAPTIVE = (dims) => `query ($zone: String!, $from: Time!, $to: Time!) {
  viewer { zones(filter: { zoneTag: $zone }) {
    httpRequestsAdaptiveGroups(limit: 50, orderBy: [count_DESC], filter: { datetime_geq: $from, datetime_leq: $to }) {
      count dimensions { ${dims} }
    }
  } }
}`;
const WEB = `query ($account: String!, $from: Time!, $to: Time!) {
  viewer { accounts(filter: { accountTag: $account }) {
    rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC], filter: { datetime_geq: $from, datetime_leq: $to }) {
      count sum { visits } dimensions { requestPath }
    }
  } }
}`;

/** Fasst die Tagesgruppen zu Summen, Statusklassen, Ländern, Browsern und Bedrohungsarten zusammen. */
export function summarize(groups) {
  const t = { requests: 0, cached: 0, bytes: 0, cachedBytes: 0, threats: 0, pageViews: 0 };
  const status = new Map(), countries = new Map(), browsers = new Map(), threatTypes = new Map();
  const days = groups.map((g) => {
    const s = g.sum;
    t.requests += s.requests; t.cached += s.cachedRequests; t.bytes += s.bytes;
    t.cachedBytes += s.cachedBytes; t.threats += s.threats; t.pageViews += s.pageViews;
    for (const r of s.responseStatusMap ?? []) addTo(status, `${String(r.edgeResponseStatus)[0]}xx`, r.requests);
    for (const c of s.countryMap ?? []) addTo(countries, c.clientCountryName, c.requests);
    for (const b of s.browserMap ?? []) addTo(browsers, b.uaBrowserFamily, b.pageViews);
    for (const x of s.threatPathingMap ?? []) addTo(threatTypes, x.threatPathingName, x.requests);
    return { date: g.dimensions.date, requests: s.requests, uniques: g.uniq?.uniques ?? 0, threats: s.threats };
  });
  return {
    totals: { ...t, cacheRate: t.requests ? (t.cached / t.requests) * 100 : 0 },
    days,
    status: top(status, 'klass', 10).sort((a, b) => a.klass.localeCompare(b.klass)),
    countries: top(countries, 'country'),
    browsers: top(browsers, 'browser').map(({ browser, requests }) => ({ browser, pageViews: requests })),
    threatTypes: top(threatTypes, 'type'),
  };
}

/**
 * Cloudflare-Analytics der Zone. Token: "Zone > Analytics > Read" (Free-Plan genügt).
 * Der Hauptteil (Tageswerte) ist Pflicht; Stunden, Sicherheit, Pfade und Web-Analytics sind optional
 * und melden Fehler einzeln in `partErrors`, ohne die Kachel zu blockieren.
 */
export function createCloudflareClient({
  token = process.env.CLOUDFLARE_API_TOKEN,
  zone = process.env.CLOUDFLARE_ZONE_ID,
  account = process.env.CLOUDFLARE_ACCOUNT_ID,
  days = Number(process.env.CLOUDFLARE_DAYS ?? 30),
  ttlMs = Number(process.env.CLOUDFLARE_TTL_MS ?? 300_000),
  fetchImpl = fetch,
} = {}) {
  let cache = null;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function gql(query, variables) {
    const res = await fetchImpl(`${API}/graphql`, { method: 'POST', headers, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body.errors?.length) throw new Error(body.errors[0].message);
    return body.data?.viewer;
  }

  async function accountId() {
    if (account) return account;
    const res = await fetchImpl(`${API}/zones/${zone}`, { headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Zone nicht lesbar (HTTP ${res.status})`);
    return (await res.json()).result?.account?.id;
  }

  /** Der Tarif begrenzt, wie weit zurück Cloudflare Daten liefert: bei Ablehnung mit 7 Tagen erneut versuchen. */
  async function load(range = days) {
    const result = await loadRange(range);
    if (result.error && range > 7 && /days|range|time|older|limit|exceed|retention/i.test(result.error)) return loadRange(7);
    return result;
  }

  async function loadRange(days) {
    const now = Date.now();
    const range = { zone, from: day(now - (days - 1) * 24 * HOUR), to: day(now) };
    const last24 = { zone, from: iso(now - 24 * HOUR), to: iso(now) };
    const partErrors = {};
    const optional = async (name, fn) => {
      try { return await fn(); } catch (err) { partErrors[name] = err.message; return null; }
    };

    let main;
    try {
      const v = await gql(DAILY, range);
      const groups = v?.zones?.[0]?.httpRequests1dGroups;
      if (!groups) return { error: 'Zone nicht gefunden oder Token ohne Zugriff (Zone-ID und Token-Rechte prüfen)' };
      main = summarize(groups);
    } catch (err) {
      return { error: `Cloudflare: ${err.message}` };
    }

    const [hourly, security, paths, web] = await Promise.all([
      optional('hourly', async () => (await gql(HOURLY, last24)).zones[0].httpRequests1hGroups
        .map((g) => ({ t: g.dimensions.datetime, requests: g.sum.requests, cached: g.sum.cachedRequests, threats: g.sum.threats }))),
      optional('security', async () => {
        const rows = (await gql(ADAPTIVE('securityAction securitySource'), last24)).zones[0].httpRequestsAdaptiveGroups;
        const actions = new Map(), sources = new Map();
        for (const r of rows) {
          addTo(actions, r.dimensions.securityAction || 'keine', r.count);
          addTo(sources, r.dimensions.securitySource || 'keine', r.count);
        }
        return { actions: top(actions, 'action'), sources: top(sources, 'source') };
      }),
      optional('paths', async () => {
        const rows = (await gql(ADAPTIVE('clientRequestPath'), last24)).zones[0].httpRequestsAdaptiveGroups;
        return rows.slice(0, 10).map((r) => ({ path: r.dimensions.clientRequestPath, requests: r.count }));
      }),
      optional('web', async () => {
        const id = await accountId();
        if (!id) throw new Error('Account-ID nicht ermittelbar');
        const rows = (await gql(WEB, { account: id, from: iso(now - days * 24 * HOUR), to: iso(now) })).accounts[0].rumPageloadEventsAdaptiveGroups;
        return {
          enabled: rows.length > 0,
          pageloads: rows.reduce((a, r) => a + r.count, 0),
          visits: rows.reduce((a, r) => a + (r.sum?.visits ?? 0), 0),
          pages: rows.map((r) => ({ path: r.dimensions.requestPath, pageloads: r.count, visits: r.sum?.visits ?? 0 })),
        };
      }),
    ]);

    return { data: { ...main, hourly, security, paths, web, partErrors } };
  }

  return async function get() {
    if (!token || !zone) return { configured: false };
    if (!cache || Date.now() - cache.at > ttlMs) cache = { at: Date.now(), ...(await load()) };
    const { at, ...result } = cache;
    return { configured: true, fetchedAt: new Date(at).toISOString(), ...result };
  };
}
