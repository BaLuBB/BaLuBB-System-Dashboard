// Gesamtzustand und Hinweise aus den Quellen. Zustände: ok (grün), warn (gelb), crit (rot), maint (violett).
import { dataOf, maintenancePhase, source } from './data.js';

export const STATE_LABEL = { ok: 'Läuft', warn: 'Warnung', crit: 'Fehler', maint: 'Wartung' };
const ORDER = { crit: 0, warn: 1, maint: 2, info: 3 };

export function computeNotes(snap, now = Date.now()) {
  const notes = [];
  const add = (level, text) => notes.push({ level, text });

  const interval = snap.intervalMin ?? 5;
  const ageMin = (now - Date.parse(snap.generatedAt)) / 60000;
  if (ageMin > 15) add('warn', `Daten veraltet: Stand vor ${Math.round(ageMin)} Minuten (erwartet: alle ${interval} Minuten).`);

  const b = snap.balubb;
  if (b && b.configured !== false) {
    if (b.error) add('crit', `BaLuBB-API nicht abrufbar: ${b.error}`);
    const health = dataOf(snap, 'health');
    const servers = dataOf(snap, 'servers');
    const items = servers?.items ?? health?.servers?.items ?? [];
    if (health && (health.ok === false || health.dashboard?.ok === false)) add('crit', 'BaLuBB meldet ein Problem (ok = false).');
    const offline = items.filter((s) => s.state === 'offline').map((s) => s.name);
    const starting = items.filter((s) => s.state === 'starting').map((s) => s.name);
    if (offline.length) add('warn', `${offline.length} von ${items.length} Servern offline: ${offline.join(', ')}.`);
    if (starting.length) add('info', `Startet gerade: ${starting.join(', ')}.`);
    const maint = dataOf(snap, 'maintenance')?.items ?? health?.maintenance ?? [];
    for (const m of maint) {
      const p = maintenancePhase(m, now);
      if (p.phase === 'running') add('maint', `Wartung läuft: ${m.title}.`);
      else if (p.phase === 'upcoming' && Date.parse(m.startsAt) - now < 24 * 3600 * 1000) add('info', `Wartung geplant: ${m.title} (${p.text}).`);
    }
    const auto = dataOf(snap, 'automations');
    if (auto && auto.errors_today > 0) add('warn', `${auto.errors_today} Fehler bei Abläufen heute.`);
  }

  const c = snap.cloudflare;
  if (c && c.configured !== false) {
    if (c.error) add('warn', `Cloudflare nicht abrufbar: ${c.error}`);
    else if (c.data) {
      const total = c.data.totals?.requests ?? 0;
      const e5 = (c.data.status ?? []).find((s) => s.klass === '5xx')?.requests ?? 0;
      if (total > 0 && e5 / total > 0.01) add('warn', `${((e5 / total) * 100).toFixed(1).replace('.', ',')} % der Anfragen endeten mit einem 5xx-Serverfehler.`);
    }
  }
  return notes.sort((a, z) => ORDER[a.level] - ORDER[z.level]);
}

/** Ein Satz für den Gesamtzustand plus Zustand für Farbe und Symbol. */
export function overallStatus(snap, now = Date.now()) {
  const notes = computeNotes(snap, now);
  const servers = dataOf(snap, 'servers')?.items ?? dataOf(snap, 'health')?.servers?.items ?? [];
  const offline = servers.filter((s) => s.state === 'offline').length;
  const starting = servers.filter((s) => s.state === 'starting').length;
  const crit = notes.some((n) => n.level === 'crit') || (servers.length > 0 && offline === servers.length);
  const maint = notes.some((n) => n.level === 'maint');
  if (crit) return { state: 'crit', text: offline === servers.length && servers.length ? 'Alle Dienste offline' : 'Störung', notes };
  if (maint) return { state: 'maint', text: 'Wartung läuft', notes };
  if (offline) return { state: 'warn', text: offline === 1 ? '1 Dienst gestört' : `${offline} Dienste gestört`, notes };
  if (starting || notes.some((n) => n.level === 'warn')) return { state: 'warn', text: starting ? 'Ein Dienst startet gerade' : 'Auffälligkeiten', notes };
  return { state: 'ok', text: 'Alles in Ordnung', notes };
}

export const sourceStates = (snap) => Object.entries(snap?.balubb?.sources ?? {}).map(([name, s]) => ({ name, available: s.available, error: s.error }));
export { source };
