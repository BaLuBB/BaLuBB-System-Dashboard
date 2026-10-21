import React from 'react';
import { Bars, Card, Kpi, Spark, Strip, Table } from './components.jsx';
import { ago, bytes, dt, duration, num, pct } from './format.js';
import { runningSeries, uptimeByServer } from './history.js';

const ICON = { crit: '⛔', warn: '⚠️', info: 'ℹ️' };

export const Banner = ({ alerts }) =>
  alerts.length === 0 ? (
    <div className="banner ok">✅ Alles in Ordnung – keine Auffälligkeiten.</div>
  ) : (
    <div className="banners">
      {alerts.map((a, i) => <div key={i} className={`banner ${a.level}`}>{ICON[a.level]} {a.text}</div>)}
    </div>
  );

const pctOr = (v) => (v == null ? '–' : `${v.toFixed(v === 100 || v === 0 ? 0 : 1)} %`);

export function KpiBar({ snap }) {
  const b = snap.balubb?.data, c = snap.cloudflare?.data;
  const up24 = uptimeByServer(snap.history, 86400);
  const known = up24.filter((s) => s.uptime != null);
  const avg24 = known.length ? known.reduce((a, s) => a + s.uptime, 0) / known.length : null;
  const e5 = c ? (c.status.find((s) => s.klass === '5xx')?.requests ?? 0) : 0;
  const offline = b ? b.servers.total - b.servers.running : 0;
  return (
    <div className="kpis">
      {b && <Kpi label="Server" value={`${b.servers.running} / ${b.servers.total}`} sub={offline ? `${offline} nicht aktiv` : 'alle laufen'} tone={offline ? 'warn' : 'ok'} />}
      {b && <Kpi label="Verfügbarkeit 24 h" value={pctOr(avg24)} sub="Ø aller Server" />}
      {b && <Kpi label="Release" value={b.dashboard.release.version} sub={`seit ${dt(b.dashboard.release.date)}`.replace(/, .*/, '')} />}
      {b && <Kpi label="Dashboard läuft seit" value={duration(b.dashboard.uptime_seconds)} sub={b.dashboard.ok ? 'ok' : 'Problem'} tone={b.dashboard.ok ? undefined : 'crit'} />}
      {c && <Kpi label={`Anfragen (${c.days.length} Tage)`} value={num(c.totals.requests)} sub={`${bytes(c.totals.bytes)} Daten`} />}
      {c && <Kpi label="Cache-Quote" value={pct(c.totals.cacheRate)} />}
      {c && <Kpi label="5xx-Fehler" value={num(e5)} tone={e5 ? 'warn' : undefined} sub={c.totals.requests ? pct((e5 / c.totals.requests) * 100) : undefined} />}
      {c && <Kpi label="Bedrohungen" value={num(c.totals.threats)} />}
      {c?.web?.enabled && <Kpi label="Besucher (Web-Analytics)" value={num(c.web.visits)} sub={`${num(c.web.pageloads)} Seitenaufrufe`} />}
    </div>
  );
}

const STATE = { running: ['🟢', 'läuft'], starting: ['🟡', 'startet'], offline: ['🔴', 'offline'] };

/** Pro Server: Status, Verfügbarkeit 24 h/7 Tage und ein 24-Stunden-Streifen aus dem Verlauf. */
export function ServerBoard({ snap }) {
  const b = snap.balubb;
  if (!b || b.configured === false) return null;
  if (b.error) return <Card title="BaLuBB-Server" wide><p className="err">{b.error}</p></Card>;
  const { servers, dashboard, time } = b.data;
  const h = snap.history;
  const u24 = Object.fromEntries(uptimeByServer(h, 86400).map((s) => [s.name, s]));
  const u7 = Object.fromEntries(uptimeByServer(h, 7 * 86400).map((s) => [s.name, s]));
  const now = Math.floor(Date.now() / 1000), BUCKETS = 48, SPAN = 86400, step = SPAN / BUCKETS;
  const stripFor = (name) => {
    const i = h.names.indexOf(name);
    const cells = Array.from({ length: BUCKETS }, (_, k) => {
      const from = now - SPAN + k * step;
      let known = 0, up = 0;
      for (const [t, row] of h.points) {
        if (t < from || t >= from + step || i < 0) continue;
        const c = row[i] ?? '-';
        if (c === '-') continue;
        known++; if (c === 'r') up++;
      }
      return { ratio: known ? up / known : null, title: `${new Date((from) * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}: ${known ? `${Math.round((up / known) * 100)} % online` : 'keine Daten'}` };
    });
    return cells;
  };
  const order = { offline: 0, starting: 1, running: 2 };
  const items = [...servers.items].sort((a, z) => (order[a.state] ?? 3) - (order[z.state] ?? 3) || a.name.localeCompare(z.name));
  return (
    <Card title="BaLuBB-Server" wide right={`API-Zeit ${dt(time)} · Dashboard ${dashboard.ok ? 'ok' : 'Problem'}`}>
      <div className="servers">
        {items.map((s) => {
          const [dot, label] = STATE[s.state] ?? ['⚪', s.state];
          return (
            <div className="server" key={s.name}>
              <div className="server-head"><span className="server-name">{dot} {s.name}</span><span className={`chip ${s.state}`}>{label}</span></div>
              <Strip cells={stripFor(s.name)} />
              <div className="server-foot muted">
                <span>24 h: <b>{pctOr(u24[s.name]?.uptime)}</b></span>
                <span>7 Tage: <b>{pctOr(u7[s.name]?.uptime)}</b></span>
                <span>{u7[s.name]?.samples ?? 0} Messpunkte</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted small">Der Streifen zeigt die letzten 24 Stunden (je ca. 30 Minuten): grün = online, gelb = teils, rot = offline, grau = keine Daten. Der Verlauf sammelt sich ab dem ersten Lauf auf.</p>
    </Card>
  );
}

export function Maintenance({ snap }) {
  const list = snap.balubb?.data?.maintenance ?? [];
  if (!list.length) return null;
  return (
    <Card title="Wartungen" wide>
      {list.map((m) => (
        <div key={m.title + m.startsAt} className="maint">
          <strong>🛠 {m.title}</strong> <span className="muted">({m.state} · {dt(m.startsAt)} – {dt(m.endsAt)})</span>
          <p className="muted">{m.description}</p>
        </div>
      ))}
    </Card>
  );
}

export function HistoryCard({ snap }) {
  const series = runningSeries(snap.history);
  if (series.length < 2) {
    return <Card title="Verlauf: laufende Server"><p className="muted">Der Verlauf füllt sich mit jedem Lauf ({series.length} Messpunkt{series.length === 1 ? '' : 'e'} bisher).</p></Card>;
  }
  const total = Math.max(...series.map((p) => p.total));
  const first = new Date(series[0].t * 1000), last = new Date(series.at(-1).t * 1000);
  return (
    <Card title="Verlauf: laufende Server" right={`${series.length} Messpunkte`}>
      <Spark data={series.map((p) => p.running)} max={total} color="var(--accent2)" />
      <div className="axis muted"><span>{dt(first)}</span><span>max. {total} Server</span><span>{dt(last)}</span></div>
    </Card>
  );
}

const KLASS = { '2xx': '🟢 2xx Erfolg', '3xx': '🔵 3xx Weiterleitung', '4xx': '🟠 4xx Client-Fehler', '5xx': '🔴 5xx Server-Fehler' };

export function TrafficCard({ snap }) {
  const c = snap.cloudflare;
  if (!c || c.configured === false) return null;
  if (c.error) return <Card title="Cloudflare" wide><p className="err">{c.error}</p></Card>;
  const d = c.data;
  return (
    <>
      <Card title="Anfragen" right={`letzte ${d.days.length} Tage`}>
        <Bars data={d.days.map((x) => ({ value: x.requests, label: `${x.date}: ${num(x.requests)} Anfragen, ${num(x.uniques)} Besucher` }))} />
        <div className="axis muted"><span>{d.days[0]?.date.slice(5)}</span><span>pro Tag</span><span>{d.days.at(-1)?.date.slice(5)}</span></div>
        {d.hourly && <>
          <p className="muted small">Letzte 24 Stunden (pro Stunde)</p>
          <Bars color="var(--accent2)" height={50} data={d.hourly.map((x) => ({ value: x.requests, label: `${new Date(x.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}: ${num(x.requests)}` }))} />
        </>}
      </Card>
      <Card title="Antwortcodes & Länder">
        <Table head={['Antwort', 'Anfragen']} rows={d.status.map((s) => [KLASS[s.klass] ?? s.klass, num(s.requests)])} />
        <Table head={['Land', 'Anfragen']} rows={d.countries.map((x) => [x.country, num(x.requests)])} />
      </Card>
      <Card title="Top-Seiten (24 h)">
        {d.paths ? <Table head={['Pfad', 'Anfragen']} rows={d.paths.map((p) => [p.path, num(p.requests)])} /> : <p className="muted">Nicht verfügbar.</p>}
        {d.browsers?.length > 0 && <Table head={['Browser', 'Seitenaufrufe']} rows={d.browsers.map((x) => [x.browser, num(x.pageViews)])} />}
      </Card>
    </>
  );
}

export function SecurityCard({ snap }) {
  const d = snap.cloudflare?.data;
  if (!d) return null;
  const s = d.security;
  return (
    <Card title="Sicherheit" right={`${num(d.totals.threats)} Bedrohungen in ${d.days.length} Tagen`}>
      {s ? (
        <>
          <p className="muted small">Letzte 24 Stunden: Was Cloudflare mit Anfragen gemacht hat</p>
          <Table head={['Aktion', 'Anfragen']} rows={s.actions.map((a) => [a.action, num(a.requests)])} />
          <Table head={['Quelle', 'Anfragen']} rows={s.sources.map((a) => [a.source, num(a.requests)])} />
        </>
      ) : <p className="muted">Sicherheitsdetails nicht verfügbar{d.partErrors?.security ? `: ${d.partErrors.security}` : '.'}</p>}
      {d.threatTypes.length > 0 && <Table head={['Bedrohungsart', 'Anfragen']} rows={d.threatTypes.map((t) => [t.type, num(t.requests)])} />}
    </Card>
  );
}

export function WebCard({ snap }) {
  const d = snap.cloudflare?.data;
  if (!d) return null;
  const w = d.web;
  return (
    <Card title="Web-Analytics (Besucher)" right={w?.enabled ? `letzte ${d.days.length} Tage` : undefined}>
      {!w ? <p className="muted">Nicht verfügbar{d.partErrors?.web ? `: ${d.partErrors.web}` : '.'}</p>
        : !w.enabled ? <p className="muted">Noch keine Besucherdaten. In Cloudflare unter <b>Web-Analytics</b> die Website <b>balubb.de</b> aktivieren (bei Cloudflare-Proxy geht das per Klick). Die Zahlen erscheinen dann automatisch.</p>
        : <>
            <div className="stats"><div className="stat"><div className="muted">Besucher</div><div className="big">{num(w.visits)}</div></div>
              <div className="stat"><div className="muted">Seitenaufrufe</div><div className="big">{num(w.pageloads)}</div></div></div>
            <Table head={['Seite', 'Aufrufe', 'Besuche']} rows={w.pages.map((p) => [p.path, num(p.pageloads), num(p.visits)])} />
          </>}
    </Card>
  );
}

/** Alles, was die BaLuBB-API liefert, ungekürzt. */
export function RawData({ snap }) {
  const raw = snap.balubb?.data;
  if (!raw) return null;
  return (
    <details className="card wide raw">
      <summary>Rohdaten der BaLuBB-API (alle Felder)</summary>
      <pre>{JSON.stringify(raw, null, 2)}</pre>
    </details>
  );
}

export const AgeNote = ({ snap }) => <>Stand {dt(snap.generatedAt)} ({ago(snap.generatedAt)})</>;
