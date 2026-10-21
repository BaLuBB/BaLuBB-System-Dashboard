import React, { useEffect, useState } from 'react';
import { RANGES, relTime } from './data.js';
import { AutomationsSection, ActivitySection, CloudflareSection, Footer, ReleasesSection, SupportSection, SystemSection } from './sectionsB.jsx';
import { MaintenanceBars, OverviewSection, StatusSection, TodoSection, TopServersSection } from './sectionsA.jsx';
import { Skeleton } from './ui.jsx';
import './cockpit.css';

const safe = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* Speicher nicht verfügbar */ } },
};

export function useTheme() {
  const [theme, setTheme] = useState(() => (safe.get('balubb-theme', 'dark') === 'light' ? 'light' : 'dark'));
  useEffect(() => { document.documentElement.dataset.cpTheme = theme; safe.set('balubb-theme', theme); }, [theme]);
  return [theme, setTheme];
}

export const useNow = (ms = 30_000) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
};

export function Loading() {
  return (
    <div className="cp" aria-busy="true" aria-live="polite">
      <div className="cp-page">
        <h1>BaLuBB System</h1>
        <p className="muted">Lade und entschlüssele Daten …</p>
        <Skeleton h={120} /><Skeleton h={220} /><Skeleton h={160} />
      </div>
    </div>
  );
}

/** Betriebs-Cockpit: von oben nach unten das Wichtigste zuerst. */
export default function Cockpit({ snap, onLogout, onTvLink, error }) {
  const [theme, setTheme] = useTheme();
  const [range, setRangeState] = useState(() => { const r = Number(safe.get('balubb-range', '30')); return RANGES.includes(r) ? r : 30; });
  const setRange = (r) => { setRangeState(r); safe.set('balubb-range', String(r)); };
  const now = useNow();
  const ageMin = Math.max(0, Math.round((now - Date.parse(snap.generatedAt)) / 60000));
  const stale = ageMin > 15;
  return (
    <div className="cp">
      <div className="cp-page">
        <header className="cp-header">
          <div className="title">
            <h1>BaLuBB System</h1>
            <p>Aktualisiert {ageMin < 1 ? 'gerade eben' : `vor ${ageMin} Min.`}{stale ? ' · veraltet' : ''}{error ? ` · ${error}` : ''}</p>
          </div>
          <div className="cp-controls">
            <div className="cp-seg" role="group" aria-label="Zeitraum">
              {RANGES.map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>{r} Tage</button>)}
            </div>
            <button type="button" className="cp-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Darstellung wechseln, aktuell ${theme === 'dark' ? 'dunkel' : 'hell'}`}>{theme === 'dark' ? 'Hell' : 'Dunkel'}</button>
            {onTvLink && <button type="button" className="cp-btn" onClick={onTvLink} title="Link für die Diashow (enthält das Passwort)">Diashow-Link</button>}
            <button type="button" className="cp-btn" onClick={() => { location.hash = ''; location.reload(); }}>Diashow</button>
            <button type="button" className="cp-btn" onClick={onLogout}>Abmelden</button>
          </div>
        </header>
        <TodoSection snap={snap} now={now} />
        <StatusSection snap={snap} now={now} />
        <MaintenanceBars snap={snap} now={now} />
        <OverviewSection snap={snap} range={range} />
        <TopServersSection snap={snap} range={range} />
        <AutomationsSection snap={snap} />
        <SupportSection snap={snap} range={range} />
        <SystemSection snap={snap} />
        <ActivitySection snap={snap} range={range} />
        <ReleasesSection snap={snap} />
        <CloudflareSection snap={snap} range={range} />
        <Footer snap={snap} />
      </div>
    </div>
  );
}
