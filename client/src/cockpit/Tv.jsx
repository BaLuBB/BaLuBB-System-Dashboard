import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OverviewSection } from './sectionsA.jsx';
import { OverviewSlide, ServerSlide, TopBarsSlide } from './tvSlides.jsx';
import { AutomationsSection, ActivitySection, CloudflareSection, ReleasesSection, SupportSection, SystemSection } from './sectionsB.jsx';
import { dataOf } from './data.js';
import { overallStatus } from './status.js';
import { Pill, ScaleContext } from './ui.jsx';
import { useNow } from './Cockpit.jsx';
import './cockpit.css';

const W = 1920, H = 1080, RELOAD_MS = 6 * 3600 * 1000, FONT = 22;
const S = FONT / 14;

/** Skaliert die feste 1920x1080-Bühne auf jede Bildschirmgröße (zentriert, mit Rand). */
function useStageTransform() {
  const [t, setT] = useState('');
  useEffect(() => {
    const fit = () => {
      const k = Math.min(window.innerWidth / W, window.innerHeight / H);
      setT(`translate(${(window.innerWidth - W * k) / 2}px, ${(window.innerHeight - H * k) / 2}px) scale(${k})`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return t;
}

/** Bildschirm wach halten (wo erlaubt) und regelmäßig neu laden, damit neue Versionen ankommen. Der Mauszeiger bleibt sichtbar. */
function useKiosk(theme) {
  const lock = useRef(null);
  useEffect(() => {
    document.body.classList.add('cp-kiosk');
    document.documentElement.dataset.cpTheme = theme;
    const request = async () => { try { lock.current = await navigator.wakeLock?.request('screen'); } catch { /* nicht unterstützt */ } };
    request();
    const onVis = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVis);
    const reload = setTimeout(() => location.reload(), RELOAD_MS);
    return () => { document.body.classList.remove('cp-kiosk'); document.removeEventListener('visibilitychange', onVis); clearTimeout(reload); lock.current?.release?.(); };
  }, [theme]);
}

export function TvMessage({ title, text, theme = 'dark' }) {
  useKiosk(theme);
  return <div className="cp cp-tvmsg"><div><h1>{title}</h1><p className="muted">{text}</p></div></div>;
}

const ICON = { warn: '▲', crit: '✕', maint: '◆' };

/** Kennzeichen je Kategorie: nur bei Auffälligkeiten ein Symbol (nie Farbe allein). */
function categoryStates(snap, st) {
  const servers = dataOf(snap, 'servers')?.items ?? dataOf(snap, 'health')?.servers?.items ?? [];
  const off = servers.filter((x) => x.state === 'offline').length, starting = servers.filter((x) => x.state === 'starting').length;
  const auto = dataOf(snap, 'automations');
  const cf = snap.cloudflare;
  const e5 = cf?.data ? (cf.data.status.find((x) => x.klass === '5xx')?.requests ?? 0) / (cf.data.totals.requests || 1) : 0;
  return {
    Überblick: st.state === 'ok' ? null : st.state,
    Server: servers.length && off === servers.length ? 'crit' : off || starting ? 'warn' : null,
    Abläufe: auto?.errors_today > 0 ? 'warn' : null,
    Cloudflare: cf?.error || e5 > 0.01 ? 'warn' : null,
  };
}

/** Diashow: eine Seite, wechselt automatisch zwischen Kategorien; unten die Kategorien, keine Bedienung. */
export default function Tv({ snap, connLostSince, slideSec = 20, theme = 'dark' }) {
  useKiosk(theme);
  const transform = useStageTransform();
  const now = useNow(10_000);
  const st = overallStatus(snap, now);
  const hasCf = snap.cloudflare && snap.cloudflare.configured !== false;

  const slides = useMemo(() => {
    const list = [
      { name: 'Überblick', hf: 0.7, body: <OverviewSlide snap={snap} now={now} /> },
      { name: 'Server', hf: 0.62, body: <ServerSlide snap={snap} now={now} /> },
      { name: 'Aktivität', hf: 1.25, body: <OverviewSection snap={snap} range={30} /> },
      { name: 'Top-Server', hf: 0.7, body: <TopBarsSlide snap={snap} /> },
      { name: 'Abläufe', hf: 0.95, body: <AutomationsSection snap={snap} /> },
      { name: 'Support', hf: 0.85, body: <SupportSection snap={snap} range={30} /> },
    ];
    if (hasCf) list.push({ name: 'Cloudflare', hf: 0.7, body: <CloudflareSection snap={snap} range={30} /> });
    list.push({ name: 'System', hf: 0.7, body: <div className="tv-stack"><SystemSection snap={snap} /><ReleasesSection snap={snap} limit={4} /></div> });
    list.push({ name: 'Dashboard', hf: 1.1, body: <ActivitySection snap={snap} range={30} /> });
    return list;
  }, [snap, now, hasCf]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => i + 1), slideSec * 1000);
    return () => clearInterval(t);
  }, [slideSec]);
  const at = idx % slides.length, cur = slides[at];
  const states = categoryStates(snap, st);
  const d = new Date(now);
  const clock = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <ScaleContext.Provider value={{ s: S, h: cur.hf ?? 0.7 }}>
      <div className="cp cp-tv">
        <div className="tv-stage" style={{ transform }}>
          <header className="tv-head">
            <div className="tv-title">
              <h1>BaLuBB System</h1>
              <p className="muted">Stand {clock(Date.parse(snap.generatedAt))} Uhr
                {connLostSince && <span className="tv-lost"> · Verbindung gestört seit {clock(connLostSince)}, zeige letzte Daten</span>}</p>
            </div>
            <div className="tv-state" data-state={st.state}><Pill state={st.state} /><span className="sentence">{st.text}</span></div>
            <div className="tv-clock">{clock(now)}<small>{d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</small></div>
          </header>
          <div className="tv-slide" key={at}>{cur.body}</div>
          <nav className="tv-cats" aria-label="Kategorien">
            {slides.map((s, i) => {
              const state = states[s.name];
              return (
                <div key={s.name} className={`tv-cat${i === at ? ' on' : ''}`} aria-current={i === at ? 'true' : undefined}>
                  <span className="num">{i + 1}</span>
                  <span className="name">{s.name}</span>
                  {state && <i className="ind" data-state={state} aria-label={state === 'crit' ? 'Fehler' : 'Warnung'}>{ICON[state]}</i>}
                  {i === at && <span className="prog" key={idx} style={{ animationDuration: `${slideSec}s` }} />}
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    </ScaleContext.Provider>
  );
}
