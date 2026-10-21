import React, { useEffect, useMemo, useRef, useState } from 'react';
import { computeAlerts } from './alerts.js';
import { ago, dt } from './format.js';
import { HistoryCard, KpiBar, Maintenance, SecurityCard, ServerBoard, TrafficCard, WebCard } from './sections.jsx';

const W = 1920, H = 1080, RELOAD_MS = 6 * 3600 * 1000;

/** Skaliert die feste 1920x1080-Bühne auf jede Bildschirmgröße (Letterbox, zentriert). */
function useStageTransform() {
  const [t, setT] = useState('');
  useEffect(() => {
    const fit = () => {
      const s = Math.min(window.innerWidth / W, window.innerHeight / H);
      setT(`translate(${(window.innerWidth - W * s) / 2}px, ${(window.innerHeight - H * s) / 2}px) scale(${s})`);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return t;
}

/** Hält den Bildschirm wach (wo der Browser es erlaubt) und lädt die Seite regelmäßig neu, damit neue Versionen ankommen. */
function useKiosk() {
  const lock = useRef(null);
  useEffect(() => {
    document.body.classList.add('tv');
    const request = async () => { try { lock.current = await navigator.wakeLock?.request('screen'); } catch { /* nicht unterstützt */ } };
    request();
    const onVis = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVis);
    const reload = setTimeout(() => location.reload(), RELOAD_MS);
    return () => { document.body.classList.remove('tv'); document.removeEventListener('visibilitychange', onVis); clearTimeout(reload); lock.current?.release?.(); };
  }, []);
}

const useNow = (ms) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
};

export function TvMessage({ title, text }) {
  useKiosk();
  return <div className="tvmsg"><div><h1>{title}</h1><p className="muted">{text}</p></div></div>;
}

/** Fernseher-Ansicht: keine Bedienung nötig, wechselt automatisch zwischen den Seiten. */
export default function TvView({ snap, connLostSince, slideSec = 20 }) {
  useKiosk();
  const transform = useStageTransform();
  const now = useNow(10_000);
  const alerts = computeAlerts(snap, now);
  const worst = alerts[0]?.level;

  const slides = useMemo(() => {
    const list = [];
    if (snap.balubb && snap.balubb.configured !== false) {
      list.push({ name: 'Server', body: <><KpiBar snap={snap} /><ServerBoard snap={snap} /></> });
    }
    if (snap.cloudflare?.data) {
      list.push({ name: 'Traffic & Sicherheit', body: <div className="grid four"><TrafficCard snap={snap} /><SecurityCard snap={snap} /></div> });
    }
    list.push({ name: 'Verlauf & Wartung', body: <div className="grid two-col"><HistoryCard snap={snap} /><WebCard snap={snap} /><Maintenance snap={snap} /></div> });
    return list;
  }, [snap]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => setIdx((i) => i + 1), slideSec * 1000);
    return () => clearInterval(t);
  }, [slides.length, slideSec]);
  const current = slides[idx % slides.length];
  const d = new Date(now);

  return (
    <div className="tvstage" style={{ transform }}>
      <header className="tv-head">
        <div>
          <h1>BaLuBB Status</h1>
          <p className="muted">
            Stand {dt(snap.generatedAt)} ({ago(snap.generatedAt, now)})
            {connLostSince && <span className="tv-link-lost"> · Verbindung gestört seit {new Date(connLostSince).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}, zeige letzte Daten</span>}
          </p>
        </div>
        <span className={`pill ${worst ?? 'ok'}`}>{worst === 'crit' ? 'Störung' : worst === 'warn' ? 'Auffälligkeiten' : 'Alles ok'}</span>
        <div className="tv-clock">
          {d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          <small>{d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</small>
        </div>
      </header>
      <div className="tv-alerts">
        {alerts.length === 0 && <div className="banner ok">✅ Alles in Ordnung – keine Auffälligkeiten.</div>}
        {alerts.slice(0, 4).map((a, i) => <div key={i} className={`banner ${a.level}`}>{{ crit: '⛔', warn: '⚠️', info: 'ℹ️' }[a.level]} {a.text}</div>)}
        {alerts.length > 4 && <div className="banner info">+ {alerts.length - 4} weitere Hinweise</div>}
      </div>
      <div className="tv-slide" key={idx % slides.length}>{current.body}</div>
      <footer className="tv-foot">
        <span>{current.name}</span>
        <span className="tv-dots">{slides.map((s, i) => <i key={s.name} className={i === idx % slides.length ? 'on' : ''} />)}</span>
        <span>wechselt alle {slideSec} s</span>
      </footer>
    </div>
  );
}
