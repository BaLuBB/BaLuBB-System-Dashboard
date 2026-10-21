// Optionen aus dem URL-Fragment (#tv&pw=...&slide=20&theme=dark). Das Fragment wird nie an einen Server gesendet.
const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

export function readOptions(hash = typeof location === 'undefined' ? '' : location.hash) {
  const map = new Map();
  for (const part of hash.replace(/^#/, '').split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    map.set(decode(i < 0 ? part : part.slice(0, i)), i < 0 ? '' : decode(part.slice(i + 1)));
  }
  const slide = Number(map.get('slide'));
  return {
    tv: map.has('tv'),
    pw: map.get('pw') ?? '',
    slideSec: Number.isFinite(slide) && slide >= 3 ? slide : 20,
    theme: map.get('theme') === 'light' ? 'light' : 'dark',
  };
}

/** Erzeugt den Link für den Fernseher; das Passwort wird dafür URL-kodiert (+, &, # usw. sind damit sicher). */
export const tvLink = (password, base = `${location.origin}${location.pathname}`) =>
  `${base}#tv&pw=${encodeURIComponent(password)}`;
