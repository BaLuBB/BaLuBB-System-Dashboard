// Die Adresse .../tv zeigt die Diashow, die Startseite das interaktive Cockpit.
// Optionen aus dem URL-Fragment: #pw=...&slide=20&theme=dark. Das Fragment wird nie an einen Server gesendet.
const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

const KEYWORDS = new Set(['tv', 'cockpit']);
const SAFE_PASSWORD = /^[\w.~-]+$/; // Buchstaben, Ziffern, Punkt, Tilde, Bindestrich, Unterstrich: ohne Kodierung tippbar

/**
 * Link-Formen für den Fernseher, von kurz nach lang:
 *   .../tv            Passwort einmal im Eingabefeld tippen, danach merkt sich der Browser es
 *   .../tv#passwort   Kurzform: ein einzelnes Wort nach dem # ist das Passwort
 *   .../tv#pw=passwort&slide=30&theme=light   mit Optionen
 * Die Startseite (.../) zeigt das interaktive Cockpit; #tv an der Startseite öffnet ebenfalls die Diashow.
 */
export const isTvPath = (pathname) => /\/tv\/?$/.test(pathname);

export function readOptions(hash = typeof location === 'undefined' ? '' : location.hash, pathname = typeof location === 'undefined' ? '/' : location.pathname) {
  const map = new Map();
  let bare = '';
  for (const part of hash.replace(/^#/, '').split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i < 0) { if (KEYWORDS.has(decode(part))) map.set(decode(part), ''); else if (!bare) bare = decode(part); continue; }
    map.set(decode(part.slice(0, i)), decode(part.slice(i + 1)));
  }
  const slide = Number(map.get('slide'));
  const tv = !map.has('cockpit') && (isTvPath(pathname) || map.has('tv')); // true = Diashow
  return {
    cockpit: !tv,
    tv,
    explicitTv: tv,
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
