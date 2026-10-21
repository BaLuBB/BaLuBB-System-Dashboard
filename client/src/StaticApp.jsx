import React, { useCallback, useEffect, useState } from 'react';
import Overview from './Overview.jsx';
import TvView, { TvMessage } from './TvView.jsx';
import { decryptJson } from './crypto.js';
import { readOptions, tvLink } from './tvmode.js';

const REFRESH_MS = 2 * 60 * 1000;
const RETRY_MS = 30 * 1000;
const opts = readOptions();

async function load(password) {
  const res = await fetch(`./snapshot.enc.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Noch kein Snapshot veröffentlicht');
  try {
    return await decryptJson(await res.json(), password);
  } catch {
    throw new Error('Falsches Passwort');
  }
}

/** Statische GitHub-Pages-Variante: Daten liegen verschlüsselt vor und werden erst im Browser entschlüsselt. */
export default function StaticApp() {
  const [password, setPassword] = useState('');
  const [input, setInput] = useState('');
  const [snap, setSnap] = useState(null);
  const [error, setError] = useState(null);
  const [lostSince, setLostSince] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.documentElement.dataset.theme = opts.tv ? opts.theme : document.documentElement.dataset.theme ?? ''; }, []);

  const refresh = useCallback(async (pw) => {
    try { setSnap(await load(pw)); setError(null); setLostSince(null); return true; }
    catch (e) { setError(e.message); setLostSince((t) => t ?? Date.now()); return false; }
  }, []);

  // Automatische Anmeldung über #pw=... (Fernseher ohne Tastatur)
  useEffect(() => {
    if (!opts.pw) return undefined;
    let stop = false;
    (async () => { if (await refresh(opts.pw) && !stop) setPassword(opts.pw); })();
    return () => { stop = true; };
  }, [refresh]);

  // Regelmäßig aktualisieren; im TV-Modus ohne Daten alle 30 s erneut versuchen
  useEffect(() => {
    const pw = password || (opts.tv ? opts.pw : '');
    if (!pw) return undefined;
    const t = setInterval(async () => { if (await refresh(pw) && !password) setPassword(pw); }, snap ? REFRESH_MS : RETRY_MS);
    return () => clearInterval(t);
  }, [password, snap, refresh]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await refresh(input);
    if (ok) setPassword(input);
    setBusy(false);
  };
  const logout = () => { setSnap(null); setPassword(''); setInput(''); };
  const copyTv = async () => {
    const link = tvLink(password);
    try { await navigator.clipboard.writeText(link); window.alert('TV-Link kopiert. Er enthält das Passwort, bitte nur auf dem Fernseher verwenden.'); }
    catch { window.prompt('TV-Link (enthält das Passwort):', link); }
  };

  if (opts.tv) {
    if (snap) return <TvView snap={snap} connLostSince={lostSince} slideSec={opts.slideSec} />;
    if (!opts.pw) return <TvMessage title="BaLuBB Status" text="Im TV-Link fehlt das Passwort (…#tv&pw=…). Den Link im normalen Modus über „TV-Link“ erzeugen." />;
    if (error === 'Falsches Passwort') return <TvMessage title="Passwort im Link falsch" text="Bitte den TV-Link neu erzeugen." />;
    return <TvMessage title="BaLuBB Status" text={error ? `${error} – neuer Versuch alle 30 Sekunden …` : 'Lade Daten …'} />;
  }

  if (!snap) {
    return (
      <main className="center">
        <form className="card login" onSubmit={submit}>
          <h1>BaLuBB Status</h1>
          <p className="muted">Bitte Passwort eingeben. Die Daten werden erst in deinem Browser entschlüsselt.</p>
          <input type="password" autoFocus autoComplete="current-password" placeholder="Passwort"
            value={input} onChange={(e) => setInput(e.target.value)} />
          <button disabled={busy || !input}>{busy ? 'Entschlüssle …' : 'Anmelden'}</button>
          {error && <p className="err">{error}</p>}
        </form>
      </main>
    );
  }

  return <Overview snap={snap} error={error} onLogout={logout} onTvLink={copyTv} />;
}
