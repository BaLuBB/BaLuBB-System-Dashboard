// Holt BaLuBB-Status (alle freigegebenen Endpunkte) und Cloudflare-Analytics und schreibt sie VERSCHLÜSSELT
// nach dist-pages/snapshot.enc.json. Der Verlauf stammt aus dem zuletzt veröffentlichten (verschlüsselten) Snapshot der Seite selbst.
// Ohne DASHBOARD_PASSWORD wird nichts geschrieben: es darf nie Klartext veröffentlicht werden.
// Die Logs öffentlicher Repos sind öffentlich: ausgegeben werden nur Zustände, nie Daten oder Schlüssel.
import { mkdir, writeFile } from 'node:fs/promises';
import { createBalubbSuite } from '../server/balubbApi.js';
import { createCloudflareClient } from '../server/cloudflare.js';
import { encryptJson, decryptJson } from '../client/src/crypto.js';
import { appendPoint, emptyHistory } from '../client/src/history.js';
import { applyNameFilter, filterHistory, parseKeywords } from '../client/src/cockpit/filter.js';

const password = process.env.DASHBOARD_PASSWORD ?? '';
if (password.length < 12) {
  console.error('DASHBOARD_PASSWORD fehlt oder ist zu kurz (mindestens 12 Zeichen). Abbruch, es wird nichts veröffentlicht.');
  process.exit(1);
}

const out = process.argv[2] ?? 'dist-pages';
// Nur Dinge mit diesen Stichwörtern im Namen anzeigen (Standard: BaLuBB, Bot). NAME_FILTER=off schaltet den Filter ab.
const keywords = parseKeywords(process.env.NAME_FILTER);
const INTERVAL_MIN = Number(process.env.SNAPSHOT_INTERVAL_MIN ?? 5);

function previousUrl() {
  if (process.env.PAGES_SNAPSHOT_URL) return process.env.PAGES_SNAPSHOT_URL;
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
  return owner && repo ? `https://${owner.toLowerCase()}.github.io/${repo}/snapshot.enc.json` : null;
}

async function loadPreviousHistory() {
  const url = previousUrl();
  if (!url) return { history: emptyHistory(), note: 'keine Pages-URL, Verlauf startet neu' };
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { history: emptyHistory(), note: `noch kein Snapshot (HTTP ${res.status}), Verlauf startet neu` };
    const prev = await decryptJson(await res.json(), password);
    const h = prev.history;
    if (!h || !Array.isArray(h.names) || !Array.isArray(h.points)) return { history: emptyHistory(), note: 'alter Snapshot ohne Verlauf, Verlauf startet neu' };
    return { history: h, note: `${h.points.length} Messpunkte übernommen` };
  } catch (err) {
    return { history: emptyHistory(), note: `Vorgänger nicht lesbar (${err.name}), Verlauf startet neu` };
  }
}

const [balubbRaw, cloudflare, prev] = await Promise.all([
  createBalubbSuite({ ttlMs: 0 })(),
  createCloudflareClient({ ttlMs: 0 })(),
  loadPreviousHistory(),
]);

// Namensfilter vor allem anderen: nicht passende Namen werden gar nicht erst veröffentlicht
const balubb = balubbRaw.sources ? { ...balubbRaw, sources: applyNameFilter(balubbRaw.sources, keywords) } : balubbRaw;

// Serverzustände (aus /servers, sonst /health) für den Verlauf; alte Spalten nicht passender Server entfallen
const items = balubb.sources?.servers?.data?.items ?? balubb.sources?.health?.data?.servers?.items;
const base = filterHistory(prev.history, keywords);
const history = items ? appendPoint(base, { data: { servers: { items } } }) : base;

const snapshot = { generatedAt: new Date().toISOString(), intervalMin: INTERVAL_MIN, filter: { keywords }, balubb, cloudflare, history };
await mkdir(out, { recursive: true });
await writeFile(`${out}/snapshot.enc.json`, JSON.stringify(await encryptJson(snapshot, password)));

const sources = Object.values(balubb.sources ?? {});
const okCount = sources.filter((s) => s.available).length;
const failed = Object.entries(balubb.sources ?? {}).filter(([, s]) => !s.available).map(([k, s]) => `${k} (${s.error})`);
const cf = cloudflare.configured === false ? 'nicht konfiguriert' : cloudflare.error ? `Fehler: ${cloudflare.error}` : `ok${Object.keys(cloudflare.data?.partErrors ?? {}).length ? ` (Teilfehler: ${Object.keys(cloudflare.data.partErrors).join(', ')})` : ''}`;
console.log(`Snapshot verschlüsselt geschrieben. BaLuBB: ${balubb.configured === false ? 'nicht konfiguriert' : `${okCount}/${sources.length} Quellen ok${failed.length ? `, ohne Antwort: ${failed.join(', ')}` : ''}`} · Cloudflare: ${cf} · Filter: ${keywords.length ? keywords.join(' oder ') : 'aus'} · Verlauf: ${prev.note}, jetzt ${history.points.length}`);
