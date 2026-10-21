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

const verify = await rest('Token prüfen', '/user/tokens/verify');
console.log('Token-Status:', verify.result?.status);
if (verify.result?.id) {
  const t = await rest('Token-Rechte', `/user/tokens/${verify.result.id}`);
  for (const p of t.result?.policies ?? []) {
    console.log(`Policy ${p.effect}:`, (p.permission_groups ?? []).map((g) => g.name).join(', '));
  }
}
const z = await rest('Zone lesen', `/zones/${zone}`);
if (!account) account = z.result?.account?.id ?? '';
console.log('Zone-Name bekannt:', Boolean(z.result?.name), '· Account-ID ermittelt:', Boolean(account), '· Plan:', z.result?.plan?.name ?? 'unbekannt');

await gql('Tageswerte (httpRequests1dGroups)', `query($z:String!,$f:Date!,$t:Date!){viewer{zones(filter:{zoneTag:$z}){httpRequests1dGroups(limit:31,orderBy:[date_ASC],filter:{date_geq:$f,date_leq:$t}){dimensions{date} sum{requests bytes threats pageViews responseStatusMap{edgeResponseStatus requests} countryMap{clientCountryName requests} browserMap{uaBrowserFamily pageViews} threatPathingMap{threatPathingName requests}} uniq{uniques}}}}}`, { z: zone, f: day(6 * 864e5), t: day(0) });
await gql('Stundenwerte 24h (httpRequests1hGroups)', `query($z:String!,$f:Time!,$t:Time!){viewer{zones(filter:{zoneTag:$z}){httpRequests1hGroups(limit:48,orderBy:[datetime_ASC],filter:{datetime_geq:$f,datetime_leq:$t}){dimensions{datetime} sum{requests bytes cachedRequests threats}}}}}`, { z: zone, f: iso(24 * 36e5), t: iso(0) });
await gql('Sicherheit (firewallEventsAdaptiveGroups)', `query($z:String!,$f:Time!,$t:Time!){viewer{zones(filter:{zoneTag:$z}){firewallEventsAdaptiveGroups(limit:20,orderBy:[count_DESC],filter:{datetime_geq:$f,datetime_leq:$t}){count dimensions{action source clientCountryName}}}}}`, { z: zone, f: iso(24 * 36e5), t: iso(0) });
await gql('Top-Pfade (httpRequestsAdaptiveGroups)', `query($z:String!,$f:Time!,$t:Time!){viewer{zones(filter:{zoneTag:$z}){httpRequestsAdaptiveGroups(limit:10,orderBy:[count_DESC],filter:{datetime_geq:$f,datetime_leq:$t}){count dimensions{clientRequestPath edgeResponseStatus}}}}}`, { z: zone, f: iso(24 * 36e5), t: iso(0) });
if (account) {
  await gql('Web-Analytics (rumPageloadEventsAdaptiveGroups)', `query($a:String!,$f:Time!,$t:Time!){viewer{accounts(filter:{accountTag:$a}){rumPageloadEventsAdaptiveGroups(limit:10,orderBy:[count_DESC],filter:{datetime_geq:$f,datetime_leq:$t}){count sum{visits} dimensions{requestPath}}}}}`, { a: account, f: iso(24 * 36e5), t: iso(0) });
} else {
  console.log('\n## Web-Analytics übersprungen: keine Account-ID');
}

// BaLuBB-API: nur Struktur, keine Werte
const r = await fetch('https://bot.balubb.de/api/ext/v1/health', { headers: { Authorization: `Bearer ${process.env.BALUBB_API_KEY}` } });
console.log(`\n## BaLuBB health: HTTP ${r.status}`);
if (r.ok) console.log('Struktur:', shape(await r.json()));
for (const p of ['', '/servers', '/status', '/maintenance', '/stats', '/metrics']) {
  const x = await fetch(`https://bot.balubb.de/api/ext/v1${p || '/'}`, { headers: { Authorization: `Bearer ${process.env.BALUBB_API_KEY}` } });
  console.log(`GET /api/ext/v1${p || '/'} -> ${x.status}`);
}
