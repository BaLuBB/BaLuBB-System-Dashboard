import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { compact, num } from './data.js';
import { useHeightFactor, useScale } from './ui.jsx';

/** Misst die Breite in Layout-Pixeln (bleibt auch bei skalierter TV-Bühne richtig). */
function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};
const shortDate = (iso) => { const [, m, d] = String(iso).split('-'); return d && m ? `${d}.${m}.` : String(iso); };
const longDate = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function Legend({ items, kind = 'swatch' }) {
  return (
    <div className="cp-legend" role="list">
      {items.map((it) => (
        <span className="item" role="listitem" key={it.label}>
          <i className={`cp-key${kind === 'line' ? ' line' : ''}`} style={{ background: it.color }} aria-hidden="true" />{it.label}
        </span>
      ))}
    </div>
  );
}

/** Werte als Tabelle (Barrierefreiheit): eingeklappt unter dem Diagramm. */
function TableView({ head, rows }) {
  return (
    <details className="cp-tableview">
      <summary>Werte als Tabelle</summary>
      <div className="scroll">
        <table className="cp-table"><thead><tr>{head.map((h) => <th key={h} className={h === head[0] ? '' : 'num'}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'num' : ''}>{c}</td>)}</tr>)}</tbody></table>
      </div>
    </details>
  );
}

/**
 * Zeitverlauf als Fläche (eine Reihe) oder Linien (mehrere Reihen). 2 px Linien, Raster nur als Haarlinie.
 * data: [{date, <key>: Zahl}], series: [{key, label, color, area?}]
 */
/** Indizes der Datumsangaben unter dem Diagramm: Anfang, Mitte, Ende; bei wenig Platz nur Anfang und Ende, damit nichts aneinanderstößt. */
function labelIndexes(n, plotW, fs) {
  if (n <= 0) return [];
  const need = fs * 3.9 * 1.5; // Breite eines Datums (z. B. „22.09.“) plus Abstand
  const idx = plotW >= need * 3 ? [0, Math.floor((n - 1) / 2), n - 1] : [0, n - 1];
  return idx.filter((v, i, a) => a.indexOf(v) === i);
}

export function TimeChart({ data, series, height = 170, format = compact, label }) {
  const s = useScale(), hf = useHeightFactor();
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const n = data.length;
  const H = height * s * hf;
  const max = useMemo(() => niceMax(Math.max(0, ...data.flatMap((d) => series.map((x) => Number(d[x.key]) || 0)))), [data, series]);
  const fs = 12.5 * s, padR = 12 * s, padT = 10 * s, padB = 26 * s;
  const padL = (Math.max(...[0, max / 2, max].map((t) => format(t).length)) * 7.6 + 14) * s;
  const plotW = Math.max(0, w - padL - padR), plotH = H - padT - padB;
  const X = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const Y = (v) => padT + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const path = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(Number(d[key]) || 0).toFixed(1)}`).join('');
  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const scale = box.width ? w / box.width : 1; // robust bei skalierter Bühne
    const x = (e.clientX - box.left) * scale;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((x - padL) / (plotW || 1)) * (n - 1)))));
  };
  const hv = hover != null ? data[hover] : null;
  return (
    <div className="cp-chart" ref={ref}>
      {w > 0 && n > 0 && (
        <svg width={w} height={H} role="img" aria-label={label ?? series.map((x) => x.label).join(', ')}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={Y(t)} y2={Y(t)} stroke="var(--grid)" strokeWidth="1" />
              <text x={padL - 8 * s} y={Y(t) + fs * 0.35} textAnchor="end" fontSize={fs} fill="var(--muted)" fontFamily="var(--font-mono)">{format(t)}</text>
            </g>
          ))}
          {labelIndexes(n, w - padL - padR, fs).map((i, k, a) => (
            <text key={i} x={X(i)} y={H - 6 * s} fontSize={fs} fill="var(--muted)" fontFamily="var(--font-mono)"
              textAnchor={k === 0 ? 'start' : k === a.length - 1 ? 'end' : 'middle'}>{shortDate(data[i].date)}</text>
          ))}
          {series.map((x) => (
            <g key={x.key}>
              {(x.area ?? series.length === 1) && n > 1 && <path d={`${path(x.key)}L${X(n - 1)},${Y(0)}L${X(0)},${Y(0)}Z`} fill={x.color} opacity="0.12" />}
              <path d={path(x.key)} fill="none" stroke={x.color} strokeWidth={2 * Math.max(1, s * 0.8)} strokeLinejoin="round" strokeLinecap="round" />
              {n === 1 && <circle cx={X(0)} cy={Y(Number(data[0][x.key]) || 0)} r={4 * s} fill={x.color} />}
            </g>
          ))}
          {hv && (
            <g pointerEvents="none">
              <line x1={X(hover)} x2={X(hover)} y1={padT} y2={padT + plotH} stroke="var(--muted)" strokeWidth="1" />
              {series.map((x) => <circle key={x.key} cx={X(hover)} cy={Y(Number(hv[x.key]) || 0)} r={4.5 * s} fill={x.color} stroke="var(--surface)" strokeWidth="2" />)}
            </g>
          )}
          <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent" />
        </svg>
      )}
      {hv && <div className="cp-tip" style={{ left: Math.min(Math.max(X(hover) + 12, 0), Math.max(0, w - 170)), top: 0 }}>
        <div className="muted">{longDate(hv.date)}</div>
        {series.map((x) => <div key={x.key}><i className="cp-key" style={{ background: x.color, marginRight: 6 }} />{x.label}: <b>{num(hv[x.key], 1)}</b></div>)}
      </div>}
      {series.length > 1 && <div style={{ marginTop: 6 }}><Legend items={series} kind="line" /></div>}
      <TableView head={['Datum', ...series.map((x) => x.label)]} rows={data.map((d) => [longDate(d.date), ...series.map((x) => num(d[x.key], 1))])} />
    </div>
  );
}

/**
 * Säulen, gestapelt, mit 2 px Lücke zwischen den Segmenten und 4 px Rundung am oberen Ende. Säulen höchstens 24 px breit.
 * data: [{date, values:[...]}], series: [{label, color}]
 */
export function Columns({ data, series, height = 170, label }) {
  const s = useScale(), hf = useHeightFactor();
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const H = height * s * hf, n = data.length;
  const totals = data.map((d) => d.values.reduce((a, b) => a + (Number(b) || 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  const fs = 12.5 * s, padR = 8 * s, padT = 10 * s, padB = 26 * s;
  const padL = (Math.max(...[0, max / 2, max].map((t) => compact(t).length)) * 7.6 + 14) * s;
  const plotW = Math.max(0, w - padL - padR), plotH = H - padT - padB, band = n ? plotW / n : 0;
  const bw = Math.min(24 * s, band * 0.7);
  const Y = (v) => padT + plotH - (v / max) * plotH;
  const gap = 2;
  const topPath = (x, y, w2, h) => { const r = Math.min(4, h / 2, w2 / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w2 - r}Q${x + w2},${y} ${x + w2},${y + r}V${y + h}Z`; };
  const labelIdx = labelIndexes(n, plotW, fs);
  const hv = hover != null ? data[hover] : null;
  return (
    <div className="cp-chart" ref={ref}>
      {w > 0 && n > 0 && (
        <svg width={w} height={H} role="img" aria-label={label ?? series.map((x) => x.label).join(', ')} onPointerLeave={() => setHover(null)}>
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={Y(t)} y2={Y(t)} stroke="var(--grid)" strokeWidth="1" />
              <text x={padL - 8 * s} y={Y(t) + fs * 0.35} textAnchor="end" fontSize={fs} fill="var(--muted)" fontFamily="var(--font-mono)">{compact(t)}</text>
            </g>
          ))}
          {labelIdx.map((i, k) => (
            <text key={i} x={padL + band * i + band / 2} y={H - 6 * s} fontSize={fs} fill="var(--muted)" fontFamily="var(--font-mono)"
              textAnchor={k === 0 ? 'start' : k === labelIdx.length - 1 ? 'end' : 'middle'}>{shortDate(data[i].date)}</text>
          ))}
          {data.map((d, i) => {
            const x = padL + band * i + (band - bw) / 2;
            let acc = 0;
            const segs = d.values.map((v, k) => {
              const val = Number(v) || 0;
              const y1 = Y(acc + val), y0 = Y(acc);
              acc += val;
              return { k, val, y: y1, h: Math.max(0, y0 - y1 - (k > 0 ? gap : 0)) };
            }).filter((g) => g.val > 0 && g.h > 0);
            return (
              <g key={d.date ?? i} onPointerEnter={() => setHover(i)} opacity={hover == null || hover === i ? 1 : 0.55}>
                <rect x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent" />
                {segs.map((g, idx) => idx === segs.length - 1
                  ? <path key={g.k} d={topPath(x, g.y, bw, g.h)} fill={series[g.k].color} />
                  : <rect key={g.k} x={x} y={g.y} width={bw} height={g.h} fill={series[g.k].color} />)}
              </g>
            );
          })}
        </svg>
      )}
      {hv && <div className="cp-tip" style={{ left: Math.min(Math.max(padL + band * hover, 0), Math.max(0, w - 180)), top: 0 }}>
        <div className="muted">{longDate(hv.date)}</div>
        {series.map((x, k) => <div key={x.label}><i className="cp-key" style={{ background: x.color, marginRight: 6 }} />{x.label}: <b>{num(hv.values[k], 1)}</b></div>)}
      </div>}
      {series.length > 1 && <div style={{ marginTop: 6 }}><Legend items={series} /></div>}
      <TableView head={['Datum', ...series.map((x) => x.label)]} rows={data.map((d) => [longDate(d.date), ...d.values.map((v) => num(v, 1))])} />
    </div>
  );
}

/** Waagerechte Balken mit Wert an der Spitze (passt der Wert nicht daneben, steht er im Balken). */
export function HBars({ rows, format = num, color = 'var(--blue-line)', max, empty = 'Keine Daten.' }) {
  if (!rows.length) return <p className="cp-empty">{empty}</p>;
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="cp-hbars" role="list">
      {rows.map((r) => {
        const p = Math.max(0, Math.min(100, (r.value / top) * 100));
        const inside = p > 82;
        return (
          <div className="cp-hbar" role="listitem" key={r.label} title={`${r.label}: ${format(r.value)}`}>
            <span className="label">{r.label}</span>
            <span className="track">
              <span className="bar" style={{ width: `${p}%`, background: r.color ?? color }} />
              <span className={`val${inside ? ' in' : ''}`} style={inside ? { right: `calc(${100 - p}% + 6px)` } : { left: `calc(${p}% + 8px)` }}>{format(r.value)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Kreisdiagramm (Ring) für Anteile mit höchstens 6 Segmenten, immer mit Legende aus Farbe, Symbol, Name, Wert und Prozent. */
export function Donut({ data, centerValue, centerLabel, size = 150, format = num }) {
  const sc = useScale();
  const total = data.reduce((a, d) => a + d.value, 0);
  const D = size * sc, stroke = 20 * sc, r = (D - stroke) / 2, C = 2 * Math.PI * r, gap = total > 0 && data.filter((d) => d.value > 0).length > 1 ? 2 : 0;
  let offset = 0;
  const arcs = data.filter((d) => d.value > 0).map((d) => {
    const len = (d.value / total) * C;
    const arc = { ...d, dash: `${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`, off: -offset };
    offset += len;
    return arc;
  });
  return (
    <div className="cp-donut">
      <svg width={D} height={D} role="img" aria-label={data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}>
        <circle cx={D / 2} cy={D / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${D / 2} ${D / 2})`}>
          {arcs.map((a) => <circle key={a.label} cx={D / 2} cy={D / 2} r={r} fill="none" stroke={a.color} strokeWidth={stroke} strokeDasharray={a.dash} strokeDashoffset={a.off}><title>{`${a.label}: ${format(a.value)}`}</title></circle>)}
        </g>
        {centerValue != null && <>
          <text x={D / 2} y={D / 2 + 2 * sc} textAnchor="middle" fontSize={26 * sc} fontWeight="600" fill="var(--text)" fontFamily="var(--font-head)">{centerValue}</text>
          <text x={D / 2} y={D / 2 + 22 * sc} textAnchor="middle" fontSize={12.5 * sc} fill="var(--muted)">{centerLabel}</text>
        </>}
      </svg>
      <div className="legend"><LegendList data={data} total={total} format={format} /></div>
    </div>
  );
}

export function LegendList({ data, total, format = num }) {
  return (
    <div className="cp-legend-list" role="list">
      {data.map((d) => (
        <div className="row" role="listitem" key={d.label}>
          <i className="cp-key" style={{ background: d.color }} aria-hidden="true" />
          <span>{d.icon ? <span aria-hidden="true">{d.icon} </span> : null}{d.label}</span>
          <span className="val">{format(d.value)}</span>
          <span className="pct">{total > 0 ? `${Math.round((d.value / total) * 100)} %` : '–'}</span>
        </div>
      ))}
    </div>
  );
}

/** Ein einzelnes Verhältnis (z. B. Cache-Quote) als Balken statt als 2-Segment-Kreis. */
export function Meter({ label, value, text, sub }) {
  return (
    <div className="cp-meter">
      <div className="cp-slim"><div className="row"><span>{label}</span><span>{text ?? `${Math.round(value)} %`}</span></div></div>
      <div className="track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}><div className="fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
      {sub && <p className="muted small" style={{ marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

/** Kleiner Verlauf ohne Achsen für Tabellenzeilen. */
export function Spark({ values, width = 110, height = 28, color = 'var(--blue-line)' }) {
  const s = useScale();
  const W = width * s, H = height * s;
  const max = Math.max(1, ...values);
  if (values.length < 2) return null;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * W).toFixed(1)},${(H - 2 - (v / max) * (H - 4)).toFixed(1)}`).join('');
  return <svg width={W} height={H} aria-hidden="true"><path d={`${d}L${W},${H}L0,${H}Z`} fill={color} opacity="0.12" /><path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" /></svg>;
}
