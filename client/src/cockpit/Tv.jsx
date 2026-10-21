import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MaintenanceBars, OverviewSection, StatusSection, TodoSection, TopServersSection } from './sectionsA.jsx';
import { AutomationsSection, ActivitySection, CloudflareSection, ReleasesSection, SupportSection, SystemSection } from './sectionsB.jsx';
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

/** Bildschirm wach halten (wo erlaubt), Cursor ausblenden und regelmäßig neu laden, damit neue Versionen ankommen. */
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

/** Fernseher-Ansicht: keine Bedienung, wechselt automatisch zwischen den Seiten. */
export default function Tv({ snap, connLostSince, slideSec = 20, theme = 'dark' }) {
  useKiosk(theme);
  const transform = useStageTransform();
  const now = useNow(10_000);
  const st = overallStatus(snap, now);

  const slides = useMemo(() => {
    const list = [];
    list.push({ name: 'Lage', hf: 0.72, body: (
      <div className="tv-cols tv-lage">
        <div className="tv-stack"><TodoSection snap={snap} now={now} /><MaintenanceBars snap={snap} now={now} /></div>
        <StatusSection snap={snap} now={now} compact />
      </div>) });
    list.push({ name: 'Gesamtlage', hf: 0.5, body: <div className="tv-stack"><OverviewSection snap={snap} range={30} /><TopServersSection snap={snap} range={30} expandable={false} fixedCount={5} fixedBy="messages" /></div> });
    list.push({ name: 'Abläufe und Support', hf: 0.52, body: <div className="tv-stack"><AutomationsSection snap={snap} /><SupportSection snap={snap} range={30} /></div> });
    if (snap.cloudflare && snap.cloudflare.configured !== false) list.push({ name: 'Cloudflare', hf: 0.7, body: <CloudflareSection snap={snap} range={30} /> });
    list.push({ name: 'System und Aktivität', hf: 0.5, body: <div className="tv-stack"><SystemSection snap={snap} /><ActivitySection snap={snap} range={30} compact /><ReleasesSection snap={snap} limit={4} compact /></div> });
    return list;
  }, [snap, now]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => i + 1), slideSec * 1000);
    return () => clearInterval(t);
  }, [slideSec]);
  const cur = slides[idx % slides.length];
  const d = new Date(now);
  const top = st.notes.filter((n) => n.level !== 'info').slice(0, 2);

  return (
    <ScaleContext.Provider value={{ s: S, h: cur.hf ?? 0.7 }}>
      <div className="cp cp-tv">
        <div className="tv-stage" style={{ transform }}>
          <header className="tv-head">
            <div className="tv-title">
              <h1>BaLuBB System</h1>
              <p className="muted">Stand {new Date(snap.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                {connLostSince && <span className="tv-lost"> · Verbindung gestört seit {new Date(connLostSince).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}, zeige letzte Daten</span>}</p>
            </div>
            <div className="tv-state" data-state={st.state}><Pill state={st.state} /><span className="sentence">{st.text}</span></div>
            <div className="tv-clock">{d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}<small>{d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</small></div>
          </header>
          {top.length > 0 && cur.name !== 'Lage' && (
            <div className="tv-notes">{top.map((n, i) => <span key={i}><Pill state={n.level === 'crit' ? 'crit' : n.level === 'maint' ? 'maint' : 'warn'}>{n.level === 'crit' ? 'Fehler' : n.level === 'maint' ? 'Wartung' : 'Warnung'}</Pill> {n.text}</span>)}</div>
          )}
          <div className="tv-slide" key={idx % slides.length}>{cur.body}</div>
          <footer className="tv-foot">
            <span>{cur.name}</span>
            <span className="tv-dots" aria-hidden="true">{slides.map((s, i) => <i key={s.name} className={i === idx % slides.length ? 'on' : ''} />)}</span>
            <span>wechselt alle {slideSec} s</span>
          </footer>
        </div>
      </div>
    </ScaleContext.Provider>
  );
}
