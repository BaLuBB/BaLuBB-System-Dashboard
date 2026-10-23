/** Lesbare Namen für die technischen Aktionsschlüssel des Dashboard-Protokolls. Unbekannte Schlüssel werden zu Text ohne Unterstriche, bereits lesbare Namen bleiben unverändert. */
const ACTION_LABELS = {
  role_page_access_update: 'Seitenzugriff für Rollen geändert',
  guild_config: 'Server-Einstellungen geändert',
  custom_bot_assign: 'Eigenen Bot zugewiesen',
  statuspage_visibility: 'Sichtbarkeit der Statusseite geändert',
  infra_layout: 'Anordnung der Server-Übersicht geändert',
  feedback_status: 'Feedback-Status geändert',
  feedback_submit: 'Feedback abgeschickt',
  ticket_update: 'Ticket bearbeitet',
};

export function actionLabel(key) {
  if (key == null || key === '') return '–';
  const k = String(key);
  if (ACTION_LABELS[k]) return ACTION_LABELS[k];
  if (!/^[a-z0-9]+(_[a-z0-9]+)+$/.test(k)) return k;
  const t = k.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Name für einen Server, den die API ohne Namen liefert: mit den letzten Ziffern der Kennung, damit er sich wiedererkennen lässt. */
export function serverName(s) {
  if (s?.name != null && String(s.name).trim() !== '') return s.name;
  const id = s?.id != null ? String(s.id) : '';
  return id ? `Unbenannter Server (Kennung …${id.slice(-4)})` : 'Unbenannter Server';
}

/** Ländername auf Deutsch aus dem Länderkürzel (DE → Deutschland); Sonderfälle von Cloudflare und unbekannte Kürzel bleiben verständlich. */
const SPECIAL_COUNTRY = { XX: 'Unbekanntes Land', T1: 'Tor-Netzwerk', EU: 'Europa (nicht genauer)', AP: 'Asien-Pazifik (nicht genauer)' };
let regionNames = null;
export function countryLabel(code) {
  if (code == null || code === '') return 'Unbekanntes Land';
  const k = String(code).toUpperCase();
  if (SPECIAL_COUNTRY[k]) return SPECIAL_COUNTRY[k];
  try { regionNames ??= new Intl.DisplayNames(['de'], { type: 'region' }); const n = regionNames.of(k); if (n && n !== k) return n; } catch { /* kein Länderverzeichnis im Browser */ }
  return k;
}

/** Seitenpfade aus Cloudflare in Worten: bekannte Schnittstellen und Seiten benannt, Kennungen nicht ausgeschrieben. */
const PATHS = {
  '/': 'Startseite',
  '/status': 'Statusseite',
  '/api/ext/v1/health': 'Schnittstelle: Gesundheitsprüfung',
  '/api/ext/v1/servers/top': 'Schnittstelle: Top-Server',
  '/api/ext/v1/servers': 'Schnittstelle: Serverliste',
  '/api/ext/v1/system': 'Schnittstelle: Systemstatus',
  '/api/ext/v1/maintenance': 'Schnittstelle: Wartungen',
  '/api/ext/v1/counts': 'Schnittstelle: Zähler',
  '/api/system-notices': 'Schnittstelle: Systemhinweise',
  '/home/datatables': 'Datentabellen (Startbereich)',
  '/discopanel.v1.ServerService/GetServer': 'Panel: Server abrufen',
};
const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9]{14,}|\d{5,})$/;
const camel = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2');
export function pathLabel(path) {
  if (path == null || path === '') return '–';
  const p = String(path).split('?')[0];
  if (PATHS[p]) return PATHS[p];
  const seg = p.split('/').filter(Boolean);
  if (seg[0] === 'workflow' && seg.length === 2 && ID_SEGMENT.test(seg[1])) return 'Ablauf bearbeiten (n8n)';
  if (seg[0] === 'servers' && seg.length === 2 && ID_SEGMENT.test(seg[1])) return 'Server-Detailseite';
  if (seg[0] === 'api') return `Schnittstelle: ${seg.slice(1).filter((s) => !/^(ext|v\d+)$/.test(s)).map((s) => (ID_SEGMENT.test(s) ? '…' : s)).join(' / ') || '–'}`;
  if (/^[a-z]+\.v\d+\.\w+$/i.test(seg[0] ?? '') && seg[1]) return `Panel: ${camel(seg[1])}`;
  return `/${seg.map((s) => (ID_SEGMENT.test(s) ? '…' : s)).join('/')}`;
}

/** Technischer Schlüssel ohne Punkte und Unterstriche, erster Buchstabe groß (letzter Ausweg für unbekannte Cloudflare-Begriffe). */
export function humanKey(key) {
  const t = String(key ?? '').replace(/[._]+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '–';
}
