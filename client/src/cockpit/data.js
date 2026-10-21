// Hilfsfunktionen für das Cockpit: Zugriff auf die Quellen, Zeiträume, Summen, Formatierung.
export const RANGES = [7, 30, 90];

export const source = (snap, name) => snap?.balubb?.sources?.[name] ?? { available: false, error: 'keine Daten' };
export const dataOf = (snap, name) => { const s = source(snap, name); return s.available ? s.data : null; };

export const lastN = (arr, n) => (Array.isArray(arr) ? arr.slice(-n) : []);
export const sumBy = (arr, pick) => (arr ?? []).reduce((a, x) => a + (Number(pick(x)) || 0), 0);

export const num = (n, digits = 0) => (n == null || Number.isNaN(n) ? '–' : Number(n).toLocaleString('de-DE', { maximumFractionDigits: digits }));
export const compact = (n) => {
  const v = Number(n) || 0, a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio.`;
  if (a >= 1e4) return `${(v / 1e3).toLocaleString('de-DE', { maximumFractionDigits: 0 })} Tsd.`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Tsd.`;
  return v.toLocaleString('de-DE', { maximumFractionDigits: 1 });
};
export const pctText = (v, digits = 1) => (v == null || Number.isNaN(v) ? '–' : `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: digits })} %`);
export const pctOf = (used, limitBytes) => (limitBytes > 0 ? Math.min(100, (used / limitBytes) * 100) : null);
export const mbToBytes = (mb) => (Number(mb) || 0) * 1024 * 1024;

export function bytesText(n) {
  if (n == null) return '–';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = Number(n);
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: v < 10 && i ? 1 : 0 })} ${u[i]}`;
}

export function durationText(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d} Tg. ${h} Std.`;
  if (h) return `${h} Std. ${m} Min.`;
  return `${m} Min.`;
}

export function relTime(iso, now = Date.now()) {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const m = Math.round(Math.abs(ms) / 60000);
  const text = m < 1 ? 'gerade eben' : m < 60 ? `${m} Min.` : m < 1440 ? `${Math.floor(m / 60)} Std.` : `${Math.floor(m / 1440)} Tg.`;
  return m < 1 ? text : ms >= 0 ? `vor ${text}` : `in ${text}`;
}

export const truncate = (s, n = 90) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** Zeigt einen Eintrag aus „Zu erledigen“ (Server, Text, Zeit). Feldnamen sind nicht festgelegt, daher mehrere Kandidaten. */
export function entryView(e) {
  if (e == null || typeof e !== 'object') return { server: '', text: truncate(e), time: '' };
  const pick = (...keys) => keys.map((k) => e[k]).find((v) => typeof v === 'string' && v.trim());
  const strings = Object.values(e).filter((v) => typeof v === 'string' && v.trim());
  return {
    server: pick('server', 'server_name', 'guild_name', 'guild', 'name') ?? '',
    text: truncate(pick('text', 'message', 'title', 'description', 'content', 'summary', 'kind', 'status') ?? strings[0] ?? ''),
    time: pick('created_at', 'createdAt', 'at', 'date', 'time', 'requested_at', 'submitted_at', 'received_at') ?? '',
  };
}

/** Phase und Text für Wartungen: läuft / geplant / vorbei. */
export function maintenancePhase(m, now = Date.now()) {
  const start = Date.parse(m.startsAt), end = Date.parse(m.endsAt);
  if (now >= start && now <= end) return { phase: 'running', text: `läuft, noch ${durationText((end - now) / 1000)}` };
  if (now < start) return { phase: 'upcoming', text: `beginnt in ${durationText((start - now) / 1000)}` };
  return { phase: 'past', text: 'beendet' };
}
