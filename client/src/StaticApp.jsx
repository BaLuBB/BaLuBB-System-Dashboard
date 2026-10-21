import React, { useCallback, useEffect, useState } from 'react';
import { BalubbView } from './BalubbCard.jsx';
import { CloudflareView } from './CloudflareCard.jsx';
import { decryptJson } from './crypto.js';

const REFRESH_MS = 5 * 60 * 1000;
const fmt = (iso) => new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });

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
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (pw) => {
    try { setSnap(await load(pw)); setError(null); return true; }
    catch (e) { setError(e.message); return false; }
  }, []);

  useEffect(() => {
    if (!password) return undefined;
    const t = setInterval(() => refresh(password), REFRESH_MS);
    return () => clearInterval(t);
  }, [password, refresh]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await refresh(input);
    if (ok) setPassword(input);
    setBusy(false);
  };

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

  return (
    <main>
      <header className="top">
        <div>
          <h1>BaLuBB Status</h1>
          <p className="muted">Stand: {fmt(snap.generatedAt)} · wird alle paar Minuten aktualisiert</p>
        </div>
        <div className="right">
          {error && <div className="err">{error}</div>}
          <button onClick={() => { setSnap(null); setPassword(''); setInput(''); }}>Abmelden</button>
        </div>
      </header>
      <div className="grid">
        <BalubbView b={snap.balubb} />
        <CloudflareView c={snap.cloudflare} />
      </div>
    </main>
  );
}
