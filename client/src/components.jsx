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

export const Kpi = ({ label, value, sub, tone }) => (
  <div className={`kpi${tone ? ` ${tone}` : ''}`}>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
    {sub && <div className="kpi-sub">{sub}</div>}
  </div>
);

/** Einfache Balken (z. B. Anfragen pro Stunde/Tag); title liefert den Tooltip. */
export const Bars = ({ data, color = 'var(--accent)', height = 70 }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(data.length, 1);
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="bars" style={{ height }} role="img">
      {data.map((d, i) => (
        <rect key={i} x={i * w + w * 0.12} width={w * 0.76} y={height - (d.value / max) * height} height={(d.value / max) * height} fill={color} rx="0.4">
          <title>{d.label}</title>
        </rect>
      ))}
    </svg>
  );
};

/** Farbstreifen: ein Feld pro Zeitabschnitt, Farbe nach Anteil „läuft“ (ratio 0–1, null = keine Daten). */
export const Strip = ({ cells }) => (
  <div className="strip" aria-hidden="true">
    {cells.map((c, i) => (
      <span key={i} title={c.title} className={c.ratio == null ? 'none' : c.ratio >= 0.999 ? 'up' : c.ratio <= 0.001 ? 'down' : 'part'} />
    ))}
  </div>
);
