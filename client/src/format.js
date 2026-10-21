export const bytes = (n) => {
  if (n == null) return '–';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}`;
};
export const rate = (n) => `${bytes(n)}/s`;
export const pct = (n) => (n == null ? '–' : `${n.toFixed(1)} %`);
export const duration = (s) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return [d && `${d} d`, (d || h) && `${h} h`, `${m} min`].filter(Boolean).join(' ');
};
export const num = (n) => (n == null ? '–' : Number(n).toLocaleString('de-DE'));
export const ago = (iso, now = Date.now()) => {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  return m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} min` : `vor ${Math.floor(m / 60)} h ${m % 60} min`;
};
export const dt = (iso) => new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
