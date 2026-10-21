// Optionen aus dem URL-Fragment (#pw=...&slide=20&theme=dark, #cockpit für die interaktive Ansicht).
// Das Fragment wird nie an einen Server gesendet. Ohne Angabe läuft die Diashow (ohne Bedienung).
const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

const KEYWORDS = new Set(['tv', 'cockpit']);
const SAFE_PASSWORD = /^[\w.~-]+$/; // Buchstaben, Ziffern, Punkt, Tilde, Bindestrich, Unterstrich: ohne Kodierung tippbar

/**
 * Link-Formen für den Fernseher, von kurz nach lang:
 *   .../            Passwort einmal im Eingabefeld tippen, danach merkt sich der Browser es
 *   .../#passwort   Kurzform: ein einzelnes Wort nach dem # ist das Passwort
 *   .../#pw=passwort&slide=30&theme=light   mit Optionen
 */
export function readOptions(hash = typeof location === 'undefined' ? '' : location.hash) {
  const map = new Map();
  let bare = '';
  for (const part of hash.replace(/^#/, '').split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i < 0) { if (KEYWORDS.has(decode(part))) map.set(decode(part), ''); else if (!bare) bare = decode(part); continue; }
    map.set(decode(part.slice(0, i)), decode(part.slice(i + 1)));
  }
  const slide = Number(map.get('slide'));
  return {
    cockpit: map.has('cockpit'),
    tv: !map.has('cockpit'), // true = Diashow
    explicitTv: map.has('tv'),
    pw: map.get('pw') ?? bare,
    slideSec: Number.isFinite(slide) && slide >= 3 ? slide : 20,
    theme: map.get('theme') === 'light' ? 'light' : 'dark',
  };
}

/** Wurzel der Seite aus dem Pfad: aus /Repo/ oder /Repo/tv/ wird /Repo/ (mit abschließendem Schrägstrich). */
export const siteRoot = (pathname = typeof location === 'undefined' ? '/' : location.pathname) =>
  `${pathname.replace(/\/?(tv\/?)?$/, '').replace(/\/$/, '')}/`;

/** Erzeugt den Link für den Fernseher (…/tv); das Passwort wird nur bei Sonderzeichen URL-kodiert (+, &, # usw.). */
export const tvLink = (password, root = `${location.origin}${siteRoot()}`) =>
  SAFE_PASSWORD.test(password) ? `${root}tv#${password}` : `${root}tv#pw=${encodeURIComponent(password)}`;
