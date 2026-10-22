import React, { useCallback, useEffect, useRef, useState } from 'react';
import './cockpit/fonts.js';
import Cockpit, { Loading, useTheme } from './cockpit/Cockpit.jsx';
import Tv, { TvMessage } from './cockpit/Tv.jsx';
import { decryptJson } from './crypto.js';
import { readOptions, tvLink } from './tvmode.js';
import { isBehind } from './slot.js';

const RETRY_MS = 30 * 1000;
const opts = readOptions();

// Passwort im Browser-Speicher (localStorage) merken, damit der Fernseher nicht jedes Mal fragt.
// Zugriffe sind abgesichert: im privaten Modus oder bei gesperrtem Speicher läuft die Seite einfach ohne.
const KEY = 'balubb-status-pw';
const store = {
  get: () => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } },
  set: (v) => { try { localStorage.setItem(KEY, v); } catch { /* Speicher nicht verfügbar */ } },
  clear: () => { try { localStorage.removeItem(KEY); } catch { /* ignorieren */ } },
};
const candidate = opts.pw || store.get(); // Link-Passwort gewinnt und überschreibt danach den gespeicherten Wert

// Der Snapshot liegt an der Wurzel der Seite, die Skripte unter assets/: so findet ihn auch die Seite /tv/
const SNAPSHOT_PATH = '../snapshot.enc.json';
const snapshotUrl = () => { try { return new URL(SNAPSHOT_PATH, import.meta.url).href; } catch { return './snapshot.enc.json'; } };

async function load(password) {
  const res = await fetch(`${snapshotUrl()}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Noch kein Snapshot veröffentlicht');
  try {
    return await decryptJson(await res.json(), password);
  } catch {
    throw new Error('Falsches Passwort');
  }
}

/** Statische GitHub-Pages-Variante: Daten liegen verschlüsselt vor und werden erst im Browser entschlüsselt. */
export default function StaticApp() {
  useTheme(); // setzt Hell/Dunkel (Standard dunkel)
  const [password, setPassword] = useState('');
  const [input, setInput] = useState('');
  const [snap, setSnap] = useState(null);
  const [error, setError] = useState(null);
  const [lostSince, setLostSince] = useState(null);
  const [busy, setBusy] = useState(false);
  const [trying, setTrying] = useState(Boolean(candidate)); // automatische Anmeldung läuft
  const [remember, setRemember] = useState(true);

  const refresh = useCallback(async (pw) => {
    try { const next = await load(pw); setSnap(next); setError(null); setLostSince(null); return next; }
    catch (e) { setError(e.message); setLostSince((t) => t ?? Date.now()); return null; }
  }, []);

  // Automatische Anmeldung mit dem Passwort aus dem Link (#pw=...) oder aus dem Browser-Speicher
  useEffect(() => {
    if (!candidate) return undefined;
    let stop = false;
    (async () => {
      const ok = await refresh(candidate);
      if (stop) return;
      setTrying(false);
      if (ok) { setPassword(candidate); store.set(candidate); }
      else if (!opts.pw) store.clear(); // gespeichertes Passwort stimmt nicht mehr (z. B. geändert)
    })();
    return () => { stop = true; };
  }, [refresh]);

  // Aktualisierung im Takt des Snapshots: er trägt den Beginn seines Intervalls (gerade Minute). Kurz danach, wenn die Veröffentlichung durch ist,
  // holt die Seite den neuen Stand; ist er noch nicht da, folgt ein Wiederholversuch (15 s, dann 30 s, dann 60 s, damit eine falsch gehende Uhr nicht ständig lädt).
  // Browser bremsen Timer im Hintergrund: ein kurzer Wächter-Takt prüft deshalb nach Zeitpunkt, und beim Zurückkehren (sichtbar, Fokus, online, Seite aus dem Cache) wird sofort geprüft.
  // Ohne Daten (TV-Modus ohne Verbindung) gilt weiter alle 30 s ein neuer Versuch.
  const last = useRef({ at: 0, busy: false, misses: 0 });
  useEffect(() => {
    const pw = password || (opts.tv ? candidate : '');
    if (!pw) return undefined;
    const RETRY = [15_000, 30_000, 60_000];
    const due = () => {
      const since = Date.now() - last.current.at;
      if (!snap) return since >= RETRY_MS;
      if (!isBehind(snap.generatedAt, Date.now(), snap.intervalMin)) return false;
      return since >= RETRY[Math.min(last.current.misses, RETRY.length - 1)];
    };
    const run = async () => {
      if (last.current.busy) return;
      const before = snap?.generatedAt;
      last.current = { ...last.current, at: Date.now(), busy: true };
      let next = null;
      try { next = await refresh(pw); if (next && !password) setPassword(pw); }
      finally { last.current = { at: Date.now(), busy: false, misses: next && next.generatedAt === before ? last.current.misses + 1 : next ? 0 : last.current.misses + 1 }; }
    };
    const check = () => { if (due()) run(); };
    const wake = () => { if (document.visibilityState !== 'hidden') check(); };
    const t = setInterval(check, 5 * 1000);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    window.addEventListener('pageshow', wake);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('pageshow', wake);
    };
  }, [password, snap, refresh]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await refresh(input);
    if (ok) { setPassword(input); if (remember) store.set(input); else store.clear(); }
    setBusy(false);
  };
  const logout = () => { store.clear(); setSnap(null); setPassword(''); setInput(''); setTrying(false); };
  const copyTv = async () => {
    const link = tvLink(password);
    try { await navigator.clipboard.writeText(link); window.alert('Link für die Diashow kopiert. Er enthält das Passwort, bitte nur auf dem Fernseher verwenden.'); }
    catch { window.prompt('Link für die Diashow (enthält das Passwort):', link); }
  };

  if (opts.tv && snap) return <Tv snap={snap} connLostSince={lostSince} slideSec={opts.slideSec} theme={opts.theme} />;
  if (!opts.tv && snap) return <Cockpit snap={snap} error={error} onLogout={logout} onTvLink={copyTv} />;

  // Unbeaufsichtigt (Fernseher) mit Passwort aus Link oder Speicher: Meldungen statt Eingabefeld
  if (opts.tv && candidate && !(error === 'Falsches Passwort' && !opts.pw)) {
    if (error === 'Falsches Passwort') return <TvMessage theme={opts.theme} title="Passwort falsch" text="Bitte den Link mit dem aktuellen Passwort erneut öffnen." />;
    return <TvMessage theme={opts.theme} title="BaLuBB System" text={error ? `${error} – neuer Versuch alle 30 Sekunden …` : 'Lade Daten …'} />;
  }
  if (trying) return <Loading />;

  return (
    <div className="cp cp-login">
      <form className="cp-card" onSubmit={submit}>
        <h1>BaLuBB System</h1>
        <p className="muted">Bitte Passwort eingeben (einmalig, danach merkt sich der Browser es). Die Daten werden erst in deinem Browser entschlüsselt.</p>
        <label className="sr" htmlFor="pw">Passwort</label>
        <input id="pw" className="cp-input" type="password" autoFocus autoComplete="current-password" placeholder="Passwort" value={input} onChange={(e) => setInput(e.target.value)} />
        <label className="cp-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Auf diesem Gerät angemeldet bleiben</label>
        <button className="cp-btn primary" disabled={busy || !input}>{busy ? 'Entschlüssle …' : 'Anmelden'}</button>
        {error && <p role="alert" style={{ color: 'var(--crit)' }}>✕ {error}</p>}
      </form>
    </div>
  );
}
