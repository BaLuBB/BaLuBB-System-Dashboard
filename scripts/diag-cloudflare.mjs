// Diagnose: testet Cloudflare-Abfragen und gibt NUR die Struktur aus (Typen, Anzahl), nie Werte oder Token.
const token = process.env.CLOUDFLARE_API_TOKEN;
const zone = process.env.CLOUDFLARE_ZONE_ID;
let account = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const shape = (v, d = 0) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return v.length ? `[${v.length}× ${shape(v[0], d + 1)}]` : '[leer]';
  if (typeof v === 'object') return d > 5 ? '{…}' : `{ ${Object.entries(v).map(([k, x]) => `${k}: ${shape(x, d + 1)}`).join(', ')} }`;
  return typeof v;
};
const iso = (ms) => new Date(Date.now() - ms).toISOString();
const day = (ms) => iso(ms).slice(0, 10);

async function rest(label, path) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, { headers: H });
  const body = await res.json().catch(() => ({}));
  console.log(`\n## ${label}: HTTP ${res.status}, success=${body.success}`);
  if (body.errors?.length) console.log('Fehler:', body.errors.map((e) => `${e.code} ${e.message}`).join(' | '));
  return body;
}
async function gql(label, query, variables) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: H, body: JSON.stringify({ query, variables }) });
  const body = await res.json().catch(() => ({}));
  console.log(`\n## ${label}: HTTP ${res.status}`);
  if (body.errors?.length) console.log('GraphQL-Fehler:', body.errors.map((e) => e.message).join(' | '));
  else console.log('Struktur:', shape(body.data));
  return body;
}


// Sicherheit auf dem Free-Plan: welche Dimensionen/Felder sind erlaubt?
const base = (extra) => `query($z:String!,$f:Time!,$t:Time!){viewer{zones(filter:{zoneTag:$z}){httpRequestsAdaptiveGroups(limit:10,orderBy:[count_DESC],filter:{datetime_geq:$f,datetime_leq:$t}){count dimensions{${extra}}}}}}`;
const V = { z: zone, f: iso(24 * 36e5), t: iso(0) };
await gql('Adaptive: securityAction', base('securityAction'), V);
await gql('Adaptive: securitySource', base('securitySource'), V);
await gql('Adaptive: clientCountryName edgeResponseStatus', base('clientCountryName edgeResponseStatus'), V);
await gql('Adaptive: userAgent clientRequestHTTPHost', base('userAgent clientRequestHTTPHost'), V);
await gql('Adaptive: cacheStatus', base('cacheStatus'), V);
await gql('Tageswerte: threatPathingMap, browserMap', `query($z:String!,$f:Date!,$t:Date!){viewer{zones(filter:{zoneTag:$z}){httpRequests1dGroups(limit:7,filter:{date_geq:$f,date_leq:$t}){sum{threats threatPathingMap{threatPathingName requests} browserMap{uaBrowserFamily pageViews} contentTypeMap{edgeResponseContentTypeName requests} ipClassMap{ipType requests}}}}}}`, { z: zone, f: day(6 * 864e5), t: day(0) });
