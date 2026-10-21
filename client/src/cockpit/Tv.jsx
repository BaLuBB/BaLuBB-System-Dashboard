import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { OverviewSection, topServers } from './sectionsA.jsx';
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

/** Symbole der Kategorien (Linien, 24 px) */
const Ico = ({ children }) => (
  <svg className="ico" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const CAT_ICON = {
  Überblick: <Ico><rect x="3" y="3" width="8" height="9" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="11" width="8" height="10" rx="2" /><rect x="3" y="15" width="8" height="6" rx="2" /></Ico>,
  Server: <Ico><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></Ico>,
  Aktivität: <Ico><path d="M3 17l6-6 4 4 8-9" /><path d="M15 6h6v6" /></Ico>,
  'Top-Server': <Ico><path d="M5 20v-7M12 20V4M19 20v-10" /></Ico>,
  Abläufe: <Ico><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 013-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 01-3 3H3" /></Ico>,
  Support: <Ico><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" /></Ico>,
  Cloudflare: <Ico><path d="M7 18a4.5 4.5 0 010-9 6 6 0 0111.4 1.6A3.7 3.7 0 0118 18H7z" /></Ico>,
  System: <Ico><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></Ico>,
  Dashboard: <Ico><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="17" r="2" /></Ico>,
};

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
/** Uhr mit eigenem Sekundentakt: unabhängig vom Seitenwechsel und von den Daten der API. */
function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setT(new Date());
    const i = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick); // nach Standby/Hintergrund sofort korrigieren
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return (
    <div className="tv-clock" role="timer" aria-label="Uhrzeit">
      {t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
      <small>{t.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</small>
    </div>
  );
}

export default function Tv({ snap, connLostSince, slideSec = 20, theme = 'dark' }) {
  useKiosk(theme);
  const transform = useStageTransform();
  const now = useNow(10_000);
  const st = overallStatus(snap, now);
  const hasCf = snap.cloudflare && snap.cloudflare.configured !== false;
  // Eine leere Kategorie (kein Server passt zum Namensfilter) läuft nicht in der Diashow mit
  const topNow = topServers(snap, 30, 'messages', 1);
  const topEmpty = topNow.available && topNow.items.length === 0;
  const hidden = (...keys) => keys.every((k) => snap.balubb?.sources?.[k]?.hidden); // Gesamtstatistiken sind bei aktivem Namensfilter ausgeblendet

  const slides = useMemo(() => {
    const list = [
      { name: 'Überblick', hf: 0.7, body: <OverviewSlide snap={snap} now={now} /> },
      { name: 'Server', hf: 0.62, body: <ServerSlide snap={snap} now={now} /> },
      { name: 'Aktivität', hf: 0.5, body: <div className="tv-lage"><OverviewSection snap={snap} range={30} /></div>, skip: hidden('statsGlobal') },
      { name: 'Top-Server', hf: 0.7, body: <TopBarsSlide snap={snap} />, skip: topEmpty },
      { name: 'Abläufe', hf: 0.95, body: <AutomationsSection snap={snap} /> },
      { name: 'Support', hf: hidden('tickets', 'applications', 'moderation') ? 0.6 : 0.8, body: <SupportSection snap={snap} range={30} />, skip: topEmpty && hidden('tickets', 'applications', 'moderation') },
    ];
    if (hasCf) list.push({ name: 'Cloudflare', hf: 0.5, body: <CloudflareSection snap={snap} range={30} /> });
    list.push({ name: 'System', hf: 0.7, body: <div className="tv-stack"><SystemSection snap={snap} /><ReleasesSection snap={snap} limit={4} /></div> });
    list.push({ name: 'Dashboard', hf: 1.1, body: <ActivitySection snap={snap} range={30} /> });
    return list.filter((x) => !x.skip);
  }, [snap, now, hasCf, topEmpty]);

  const [idx, setIdx] = useState(0);
  // Läuft nach jedem Wechsel (auch nach einem Klick) neu, so bekommt jede Seite die volle Zeit
  useEffect(() => {
    const t = setTimeout(() => setIdx((i) => i + 1), slideSec * 1000);
    return () => clearTimeout(t);
  }, [slideSec, idx]);
  const at = idx % slides.length, cur = slides[at];
  // Jede Seite wird so weit vergrößert, wie sie in die Bühne passt: besser lesbar auf dem Fernseher
  const outer = useRef(null), inner = useRef(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      const o = outer.current, i = inner.current;
      if (!o || !i) return;
      i.style.minHeight = '0';
      let best = 0.88;
      for (const z of [1.6, 1.5, 1.4, 1.3, 1.2, 1.12, 1.06, 1, 0.94, 0.88]) {
        i.style.zoom = z;
        if (i.getBoundingClientRect().height <= o.getBoundingClientRect().height - 24) { best = z; break; }
      }
      i.style.zoom = best;
      // Restliche Höhe füllen: die Karten werden gestreckt, die Unterkanten schließen bündig ab
      i.style.minHeight = `${Math.floor((o.offsetHeight - 2) / best)}px`;
      setZoom(best);
    };
    fit();
    const t = setTimeout(fit, 500); // nochmal messen, wenn Schriften und Diagramme fertig sind
    return () => clearTimeout(t);
  }, [at, snap, slides.length]);
  const states = categoryStates(snap, st);
  const clock = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <ScaleContext.Provider value={{ s: S, h: cur.hf ?? 0.7 }}>
      <div className="cp cp-tv">
        <div className="tv-stage" style={{ transform }}>
          <header className="tv-head">
            <div className="tv-title">
              <h1>BaLuBB System</h1>
              <p className="muted"><span className="live" aria-hidden="true" />Stand {clock(Date.parse(snap.generatedAt))} Uhr
                {connLostSince && <span className="tv-lost"> · Verbindung gestört seit {clock(connLostSince)}, zeige letzte Daten</span>}</p>
            </div>
            <div className="tv-state" data-state={st.state}><Pill state={st.state} /><span className="sentence">{st.text}</span></div>
            <Clock />
          </header>
          <div className="tv-slide" key={at} ref={outer}><div className="tv-zoom" ref={inner} style={{ zoom }}>{cur.body}</div></div>
          <nav className="tv-cats" aria-label="Kategorien">
            {slides.map((s, i) => {
              const state = states[s.name];
              const on = i === at;
              return (
                <button type="button" key={s.name} className={`tv-cat${on ? ' on' : ''}`} aria-current={on ? 'true' : undefined} onClick={() => setIdx(i)}>
                  {on && <span className="fill" key={idx} style={{ animationDuration: `${slideSec}s` }} />}
                  {CAT_ICON[s.name]}
                  <span className="name">{s.name}</span>
                  {state && <i className="ind" data-state={state} role="img" aria-label={state === 'crit' ? 'Fehler' : 'Warnung'}>{ICON[state]}</i>}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </ScaleContext.Provider>
  );
}
