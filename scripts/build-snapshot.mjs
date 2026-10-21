// Holt BaLuBB-Status und Cloudflare-Analytics und schreibt sie VERSCHLÜSSELT nach dist-pages/snapshot.enc.json.
// Ohne DASHBOARD_PASSWORD wird nichts geschrieben: es darf nie Klartext veröffentlicht werden.
import { mkdir, writeFile } from 'node:fs/promises';
import { createBalubbClient } from '../server/balubb.js';
import { createCloudflareClient } from '../server/cloudflare.js';
import { encryptJson } from '../client/src/crypto.js';

const password = process.env.DASHBOARD_PASSWORD ?? '';
if (password.length < 12) {
  console.error('DASHBOARD_PASSWORD fehlt oder ist zu kurz (mindestens 12 Zeichen). Abbruch, es wird nichts veröffentlicht.');
  process.exit(1);
}

const out = process.argv[2] ?? 'dist-pages';
const [balubb, cloudflare] = await Promise.all([
  createBalubbClient({ ttlMs: 0 })(),
  createCloudflareClient({ ttlMs: 0 })(),
]);

const snapshot = { generatedAt: new Date().toISOString(), balubb, cloudflare };
await mkdir(out, { recursive: true });
await writeFile(`${out}/snapshot.enc.json`, JSON.stringify(await encryptJson(snapshot, password)));

// Nur Zustände ausgeben, nie Daten oder Schlüssel
const state = (r) => (r.configured === false ? 'nicht konfiguriert' : r.error ? `Fehler: ${r.error}` : 'ok');
console.log(`Snapshot verschlüsselt geschrieben. BaLuBB: ${state(balubb)} · Cloudflare: ${state(cloudflare)}`);
