// Diagnose nach jeder Veröffentlichung: was liefert die Seite von außen wirklich aus, und ist es der gerade gebaute Stand?
// Ausgegeben werden nur Zustände und Kopfzeilen (Alter, Zwischenspeicher), nie Daten. Bricht nie ab (der Schritt ist „continue-on-error“).
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

const base = (process.argv[2] ?? '').replace(/\/?$/, '/');
const dir = process.argv[3] ?? 'dist-pages';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 12);
const pick = (h) => ['age', 'cache-control', 'last-modified', 'x-cache', 'x-served-by', 'date'].map((k) => `${k}=${h.get(k) ?? '–'}`).join(' · ');

if (base === '/') { console.log('keine Adresse der Seite, Prüfung übersprungen'); process.exit(0); }
const localGeneric = sha(await readFile(`${dir}/snapshot.enc.json`));
const slots = (await readdir(`${dir}/s`)).sort();
const newest = slots.at(-1);
const localSlot = sha(await readFile(`${dir}/s/${newest}`));

await sleep(20_000); // Veröffentlichung und Verteilung abwarten
for (const [label, url, want] of [
  ['feste Datei (mit ?t=)', `${base}snapshot.enc.json?t=${Date.now()}`, localGeneric],
  ['feste Datei (ohne ?t=)', `${base}snapshot.enc.json`, localGeneric],
  ['Intervall-Datei', `${base}s/${newest}`, localSlot],
]) {
  try {
    const t0 = Date.now();
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    const got = sha(Buffer.from(await res.arrayBuffer()));
    console.log(`${label}: HTTP ${res.status} · ${got === want ? 'AKTUELL' : 'VERALTET'} · ${Date.now() - t0} ms · ${pick(res.headers)}`);
  } catch (e) {
    console.log(`${label}: Fehler ${e.name}`);
  }
}
console.log(`Intervall-Dateien im Bau: ${slots.length}`);
