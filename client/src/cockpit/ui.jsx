import React, { createContext, useContext } from 'react';
import { source } from './data.js';

/** Skalierung für den TV-Modus: Diagramm-Schrift und -Abstände wachsen mit der Bühne. */
export const ScaleContext = createContext({ s: 1, h: 1 });
export const useScale = () => useContext(ScaleContext).s;
export const useHeightFactor = () => useContext(ScaleContext).h;

export const STATE_ICON = { ok: '✓', warn: '▲', crit: '✕', maint: '◆', info: 'i' };
export const STATE_WORD = { ok: 'Läuft', warn: 'Warnung', crit: 'Fehler', maint: 'Wartung' };

export const Pill = ({ state = 'ok', children }) => (
  <span className="cp-pill" data-state={state}><i aria-hidden="true">{STATE_ICON[state]}</i>{children ?? STATE_WORD[state]}</span>
);

export const Section = ({ id, title, sub, right, children }) => (
  <section className="cp-section" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
    <header><h2 id={id ? `${id}-h` : undefined}>{title}</h2>{(sub || right) && <span className="muted">{sub}{right}</span>}</header>
    {children}
  </section>
);

export const Card = ({ title, right, children, ...rest }) => (
  <div className="cp-card" {...rest}>
    {(title || right) && <header>{title && <h3>{title}</h3>}{right && <span className="muted">{right}</span>}</header>}
    {children}
  </div>
);

export const Empty = ({ children }) => <p className="cp-empty">{children}</p>;
export const Unavailable = ({ what }) => <p className="cp-unavail">{what ? `${what}: ` : ''}gerade nicht verfügbar</p>;
export const Skeleton = ({ h = 80 }) => <div className="cp-skel" style={{ height: h }} aria-hidden="true" />;

/** Schmaler Balken (z. B. CPU, Speicher, Platte); Ton wechselt bei hoher Auslastung, immer mit Zahl daneben. */
export function Slim({ label, value, text, sub, warnAt = 80, critAt = 92 }) {
  const known = value != null && !Number.isNaN(value);
  const tone = !known ? undefined : value >= critAt ? 'crit' : value >= warnAt ? 'warn' : undefined;
  return (
    <div className="cp-slim">
      <div className="row"><span>{label}</span><span>{text ?? (known ? `${Math.round(value)} %` : '–')}</span></div>
      <div className="track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={known ? Math.round(value) : undefined}>
        <div className="fill" data-tone={tone} style={{ width: `${known ? Math.min(100, Math.max(0, value)) : 0}%` }} />
      </div>
      <div className="sub" aria-hidden={sub ? undefined : 'true'}>{sub || '\u00a0'}</div>
    </div>
  );
}

/** Zeigt Inhalt nur, wenn die Quelle da ist; sonst die ruhige Fehlermeldung „gerade nicht verfügbar“. */
export function WithSource({ snap, name, what, children }) {
  const s = source(snap, name);
  if (!s.available) return <Unavailable what={what} />;
  return children(s.data);
}
