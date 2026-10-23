import React, { useEffect, useState } from 'react';
import { isBehind } from './slot.js';

// Diagnose-Ansicht: Adresse mit ?debug=1 öffnen (z. B. …/tv/?debug=1#pw=…). Zeigt, was die Seite gerade wirklich weiß, ohne Passwort oder Daten.
export const DEBUG = (() => { try { return new URLSearchParams(location.search).has('debug'); } catch { return false; } })();

export const dbg = { build: '', fetch: null, snap: null, misses: 0, log: [] };
const HEADERS = ['date', 'age', 'last-modified', 'etag', 'cache-control', 'x-cache', 'x-served-by', 'cf-cache-status', 'x-github-request-id'];

export const pickHeaders = (h) => Object.fromEntries(HEADERS.map((k) => [k, h?.get?.(k)]).filter(([, v]) => v != null));
export function note(text) { dbg.log = [`${new Date().toLocaleTimeString('de-DE')} ${text}`, ...dbg.log].slice(0, 12); }
export function noteSnapshot(s) { dbg.snap = s ? { generatedAt: s.generatedAt, builtAt: s.builtAt, app: s.app, intervalMin: s.intervalMin } : null; }

const min = (ms) => (Number.isFinite(ms) ? `${(ms / 60000).toFixed(1)} Min.` : '–');

export function DebugPanel() {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const now = Date.now(), s = dbg.snap, f = dbg.fetch;
  const server = Date.parse(f?.headers?.date ?? '');
  let lastReload = '–';
  try { const r = Number(sessionStorage.getItem('balubb-reload') ?? 0); if (r) lastReload = `${new Date(r).toLocaleTimeString('de-DE')} (vor ${min(now - r)})`; } catch { /* ohne Speicher */ }
  const rows = [
    ['Code (Build)', dbg.build],
    ['Daten: Code-Stand', s?.app ?? '–'],
    ['Daten: Stand (generatedAt)', s ? `${new Date(s.generatedAt).toLocaleTimeString('de-DE')} · Alter ${min(now - Date.parse(s.generatedAt))}` : '–'],
    ['Daten: gebaut (builtAt)', s?.builtAt ? new Date(s.builtAt).toLocaleTimeString('de-DE') : '–'],
    ['hinkt hinterher?', s ? (isBehind(s.generatedAt, now, s.intervalMin) ? 'JA' : 'nein') : '–'],
    ['Uhr dieses Geräts', new Date(now).toLocaleTimeString('de-DE')],
    ['Uhr laut Server (Date)', Number.isFinite(server) ? `${new Date(server).toLocaleTimeString('de-DE')} · Abweichung ${min(now - server)}` : '–'],
    ['Letzter Abruf', f ? `${new Date(f.at).toLocaleTimeString('de-DE')} · HTTP ${f.status} · ${f.ms} ms` : '–'],
    ['Fehlversuche in Folge', String(dbg.misses)],
    ['Sichtbarkeit', document.visibilityState],
    ['Letztes Neuladen', lastReload],
  ];
  return (
    <aside className="cp-debug" aria-label="Diagnose">
      <b>Diagnose</b>
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {f?.headers && <pre>{Object.entries(f.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}</pre>}
      <pre>{dbg.log.join('\n') || '–'}</pre>
    </aside>
  );
}
