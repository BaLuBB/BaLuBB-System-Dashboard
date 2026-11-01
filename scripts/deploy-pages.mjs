// Veröffentlichung auf GitHub Pages mit einer eigenen Versionsnummer je Lauf.
// Die fertige Aktion „deploy-pages“ nimmt als Version immer den Commit. Läuft derselbe Commit hunderte Male (alle 2 Minuten ein neuer Stand),
// sieht Pages jedes Mal dieselbe Version; die gemessene Folge war eine Auslieferung, die stundenlang einen alten Stand zeigte, obwohl jeder Lauf „erfolgreich“ meldete.
// Hier bekommt jede Veröffentlichung eine eigene Version (Commit + Laufnummer). Schlägt das fehl, springt der Ablauf auf die fertige Aktion zurück.
import { appendFile } from 'node:fs/promises';

const env = process.env;
const need = ['GITHUB_REPOSITORY', 'GITHUB_RUN_ID', 'GITHUB_SHA', 'GITHUB_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN'];
const missing = need.filter((k) => !env[k]);
if (missing.length) { console.error(`Eigene Veröffentlichung nicht möglich, es fehlt: ${missing.join(', ')}`); process.exit(1); }

const api = (env.GITHUB_API_URL ?? 'https://api.github.com').replace(/\/$/, '');
const repo = env.GITHUB_REPOSITORY;
const version = `${env.GITHUB_SHA}-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT ?? 1}`;
const head = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'balubb-dashboard-deploy' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...head, ...init.headers }, signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keine JSON-Antwort */ }
  return { res, json, text };
}

// 1. Das gerade hochgeladene Seiten-Paket dieses Laufs finden.
const art = await call(`${api}/repos/${repo}/actions/runs/${env.GITHUB_RUN_ID}/artifacts?name=github-pages`);
const artifact = art.json?.artifacts?.find((a) => a.name === 'github-pages' && !a.expired);
if (!art.res.ok || !artifact) { console.error(`Seiten-Paket nicht gefunden (HTTP ${art.res.status})`); process.exit(1); }

// 2. Ausweis dieses Laufs (derselbe, den die fertige Aktion benutzt).
const tok = await fetch(env.ACTIONS_ID_TOKEN_REQUEST_URL, { headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }, signal: AbortSignal.timeout(30_000) });
const oidc = (await tok.json().catch(() => ({})))?.value;
if (!tok.ok || !oidc) { console.error(`Ausweis des Laufs nicht erhalten (HTTP ${tok.status})`); process.exit(1); }

// 3. Veröffentlichung anlegen.
const created = await call(`${api}/repos/${repo}/pages/deployments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ artifact_id: artifact.id, pages_build_version: version, oidc_token: oidc }),
});
if (!created.res.ok) { console.error(`Veröffentlichung abgelehnt (HTTP ${created.res.status}): ${String(created.text).slice(0, 300)}`); process.exit(1); }
const statusUrl = created.json?.status_url ?? `${api}/repos/${repo}/pages/deployments/${encodeURIComponent(created.json?.id ?? version)}`;
const pageUrl = created.json?.page_url ?? '';
console.log(`Veröffentlichung angelegt: Version ${version}, Kennung ${created.json?.id ?? '–'}`);

// 4. Warten, bis Pages sie als erledigt meldet.
const until = Date.now() + 5 * 60_000;
let last = '';
while (Date.now() < until) {
  await sleep(3000);
  const s = await call(statusUrl);
  const st = s.json?.status ?? `HTTP ${s.res.status}`;
  if (st !== last) { console.log(`Zustand: ${st}`); last = st; }
  if (st === 'succeed') {
    if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `page_url=${pageUrl}\n`);
    console.log('Veröffentlichung erfolgreich.');
    process.exit(0);
  }
  if (['deployment_failed', 'deployment_perms_error', 'deployment_content_failed', 'deployment_cancelled', 'deployment_lost', 'failed', 'error'].includes(st)) {
    console.error(`Veröffentlichung fehlgeschlagen: ${st}`);
    process.exit(1);
  }
}
console.error('Veröffentlichung nach 5 Minuten nicht abgeschlossen');
process.exit(1);
