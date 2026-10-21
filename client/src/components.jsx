import React from 'react';

export const Card = ({ title, wide, children, right }) => (
  <section className={`card${wide ? ' wide' : ''}`}>
    <header><h2>{title}</h2>{right && <span className="muted">{right}</span>}</header>
    {children}
  </section>
);

export const level = (p) => (p >= 90 ? 'crit' : p >= 70 ? 'warn' : 'ok');

export const Bar = ({ value, label }) => (
  <div className="bar" role="progressbar" aria-valuenow={Math.round(value ?? 0)} aria-valuemin="0" aria-valuemax="100">
    <div className={`fill ${level(value ?? 0)}`} style={{ width: `${Math.min(value ?? 0, 100)}%` }} />
    {label && <span>{label}</span>}
  </div>
);

export const Stat = ({ label, value }) => (
  <div className="stat"><div className="muted">{label}</div><div className="big">{value}</div></div>
);

/** Kleines SVG-Liniendiagramm; max=null skaliert automatisch. */
export const Spark = ({ data, max = 100, color = 'var(--accent)' }) => {
  const w = 300, h = 60;
  const top = max ?? Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * w},${h - (Math.min(v, top) / top) * h}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="spark" aria-hidden="true">
      {pts.length > 1 && <>
        <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={color} opacity="0.15" />
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </>}
    </svg>
  );
};

export const Table = ({ head, rows }) => (
  <div className="scroll">
    <table>
      <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);
