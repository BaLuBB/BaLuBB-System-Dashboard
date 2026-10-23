import React, { useState } from 'react';
import { Columns, HBars, Legend, Spark, TimeChart } from './charts.jsx';
import { compact, dataOf, diff, durationText, entryView, isNum, lastN, maintenancePhase, num, pctOf, pctText, mbToBytes, bytesText, relTime, source, sumBy } from './data.js';
import { overallStatus } from './status.js';
import { Card, Empty, Pill, Section, Skeleton, Slim, Unavailable } from './ui.jsx';
import { uptimeByServer } from '../history.js';
import { filterLabel } from './filter.js';
import { serverName } from './labels.js';

const filtered = (snap) => (snap.filter?.keywords?.length ? filterLabel(snap.filter.keywords) : '');

/* ---------- Zu erledigen ---------- */
const STATUS_LABEL = { active: 'aktiv', deactivated: 'deaktiviert', pending: 'offen', accepted: 'angenommen', rejected: 'abgelehnt', erledigt: 'erledigt', new: 'neu', open: 'offen', feedback: 'Feedback' };
const distribution = (o) => Object.entries(o ?? {}).filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => `${STATUS_LABEL[k] ?? k} ${num(v)}`).join(' · ');

function TodoBlock({ title, src, countKey, listKey, now, filtered: byName }) {
  if (!src.available) return <Card title={title}><Unavailable /></Card>;
  const d = src.data, items = (d[listKey] ?? []).slice(0, 5);
  const count = isNum(d[countKey]) ? Number(d[countKey]) : null; // fehlt die Zahl, steht „–“ und nicht „nichts offen“
  const kinds = distribution(d.by_kind), states = distribution(d.by_status);
  return (
    <Card title={title} data-open={count > 0 ? 'true' : 'false'}>
      {count === null
        ? <p className="cp-hero"><span className="cp-big muted">–</span><span className="cp-unit">keine Angabe</span></p>
        : count === 0
          ? <p className="cp-hero"><span className="cp-big muted">0</span><span className="cp-unit">✓ Nichts offen</span></p>
          : <p className="cp-hero"><span className="cp-big">{num(count)}</span><span className="cp-unit">offen</span></p>}
      <p className="muted small">{isNum(d.total) ? `${num(d.total)} gesamt${d.allServers ? ' (alle Server)' : ''}` : '– gesamt'}{!isNum(d.total) && byName ? '' : ` · ${states || '–'}`}{kinds ? ` · ${kinds}` : ''}</p>
      {items.length > 0 && (
        <ul>
          {items.map((raw, i) => {
            const e = entryView(raw);
            return (
              <li key={i}>
                <div className="meta"><b>{e.server || '–'}</b>{e.time ? <time dateTime={e.time}>{relTime(e.time, now)}</time> : <span>–</span>}</div>
                <div>{e.text || '–'}</div>
              </li>
            );
          })}
        </ul>
      )}
      {count != null && count > items.length && <p className="muted small">und {count - items.length} weitere</p>}
    </Card>
  );
}

export function TodoSection({ snap, now }) {
  return (
    <Section id="todo" title="Zu erledigen">
      <div className="cp-todo">
        <TodoBlock filtered={Boolean(snap.filter?.keywords?.length)} title="Neue Server zum Aktivieren" src={source(snap, 'activations')} countKey="pending_count" listKey="pending" now={now} />
        <TodoBlock filtered={Boolean(snap.filter?.keywords?.length)} title="Neues Feedback" src={source(snap, 'feedback')} countKey="new_count" listKey="new" now={now} />
        <TodoBlock filtered={Boolean(snap.filter?.keywords?.length)} title="Offene Custom-Bot-Anfragen" src={source(snap, 'customBotRequests')} countKey="open_count" listKey="open" now={now} />
      </div>
    </Section>
  );
}

/* ---------- Gesamtzustand und Server ---------- */
const SERVER_STATE = { running: ['ok', 'läuft'], starting: ['warn', 'startet'], offline: ['crit', 'offline'] };
const NOTE_TAG = { crit: 'Fehler', warn: 'Warnung', maint: 'Wartung', info: 'Hinweis' };

/** „genutzt / Grenze“ wie im Panel (z. B. 38 MB / 589 MB); ohne Grenze (0) nur der genutzte Wert, ohne Angabe „–“. */
const usedOfLimit = (m) => {
  const used = bytesText(m?.used_bytes);
  const limit = isNum(m?.limit_mb) && Number(m.limit_mb) > 0 ? bytesText(mbToBytes(m.limit_mb)) : null;
  return limit ? `${used} / ${limit}` : used;
};


/** Anzeige für den Fernseher: je Container eine Karte mit Name, Zustand, Laufzeit und vier gleich aufgebauten Feldern. */
function Gauge({ label, pct, big, detail }) {
  const known = isNum(pct);
  const tone = !known ? undefined : pct >= 92 ? 'crit' : pct >= 80 ? 'warn' : undefined;
  return (
    <div className="tvc-gauge">
      <span className="lab">{label}</span>
      <b className="big">{big}</b>
      <div className="track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={known ? Math.round(pct) : undefined}>
        <div className="fill" data-tone={tone} style={{ width: `${known ? Math.min(100, Math.max(0, pct)) : 0}%` }} />
      </div>
      <span className="det">{detail}</span>
    </div>
  );
}

const vonLimit = (m) => {
  const used = bytesText(m?.used_bytes);
  return isNum(m?.limit_mb) && Number(m.limit_mb) > 0 ? `${used} von ${bytesText(mbToBytes(m.limit_mb))}` : `${used}, ohne Grenze`;
};

function ContainerCard({ s }) {
  const [state, word] = SERVER_STATE[s.state] ?? ['warn', s.state];
  const memPct = s.memory ? pctOf(s.memory.used_bytes, mbToBytes(s.memory.limit_mb)) : null;
  const diskPct = s.disk ? pctOf(s.disk.used_bytes, mbToBytes(s.disk.limit_mb)) : null;
  const cpu = isNum(s.cpu_percent) ? Number(s.cpu_percent) : null;
  return (
    <div className="tvc" data-state={state}>
      <div className="tvc-head">
        <i className="dot" aria-hidden="true" />
        <b className="name">{s.name ?? '–'}</b>
        {s.suspended && <Pill state="warn">gesperrt</Pill>}
        <Pill state={state}>{word}</Pill>
        <span className="since">{s.state === 'running' ? `läuft seit ${isNum(s.uptime_seconds) ? durationText(s.uptime_seconds) : '–'}` : ''}</span>
      </div>
      <div className="tvc-grid">
        <Gauge label="Prozessor" pct={cpu} big={cpu == null ? '–' : `${Math.round(cpu)} %`} detail="Auslastung" />
        <Gauge label="Arbeitsspeicher" pct={memPct} big={memPct == null ? '–' : `${Math.round(memPct)} %`} detail={vonLimit(s.memory)} />
        <Gauge label="Speicherplatz" pct={diskPct} big={diskPct == null ? bytesText(s.disk?.used_bytes) : `${Math.round(diskPct)} %`} detail={diskPct == null ? 'ohne Grenze' : vonLimit(s.disk)} />
        <div className="tvc-gauge net">
          <span className="lab">Netzwerk (gesamt)</span>
          <b className="big sm">↓ {bytesText(s.network?.rx_bytes)}</b>
          <b className="big sm">↑ {bytesText(s.network?.tx_bytes)}</b>
          <span className="det">empfangen und gesendet</span>
        </div>
      </div>
    </div>
  );
}

export function StatusSection({ snap, now, compact = false }) {
  const st = overallStatus(snap, now);
  const serversSrc = source(snap, 'servers');
  const health = dataOf(snap, 'health');
  const items = serversSrc.available ? serversSrc.data.items : (health?.servers?.items ?? []);
  const up24 = Object.fromEntries(uptimeByServer(snap.history ?? { names: [], points: [] }, 86400, now).map((u) => [u.name, u]));
  const release = dataOf(snap, 'overview')?.release ?? health?.dashboard?.release;
  return (
    <Section id="zustand" title="Gesamtzustand" right={release ? `Version ${release.version}` : undefined}>
      <div className="cp-card">
        {!compact && (
          <div className="cp-status" data-state={st.state}>
            <Pill state={st.state} />
            <span className="sentence" role="status">{st.text}</span>
          </div>
        )}
        {st.notes.length > 0 && (
          <ul className="cp-notes">
            {(compact ? st.notes.filter((n) => n.level !== 'info').slice(0, 2) : st.notes).map((n, i) => <li key={i} className={n.level}><span className="tag">{NOTE_TAG[n.level]}</span><span>{n.text}</span></li>)}
          </ul>
        )}
        <hr className="cp-rule" />
        {!serversSrc.available && !health ? <Unavailable what="Server" /> : items.length === 0 ? <Empty>{filtered(snap) ? `Kein Dienst mit ${filtered(snap)} im Namen gefunden.` : 'Es sind keine Server hinterlegt.'}</Empty> : (
          compact ? (
            <div className="tv-containers">
              {[...items].sort((a, z) => ({ offline: 0, starting: 1, running: 2 }[a.state] ?? 3) - ({ offline: 0, starting: 1, running: 2 }[z.state] ?? 3) || String(a.name).localeCompare(String(z.name))).map((s) => <ContainerCard key={s.name} s={s} />)}
            </div>
          ) : (
          <div className="cp-servers">
            {[...items].sort((a, z) => ({ offline: 0, starting: 1, running: 2 }[a.state] ?? 3) - ({ offline: 0, starting: 1, running: 2 }[z.state] ?? 3) || a.name.localeCompare(z.name)).map((s) => {
              const [state, word] = SERVER_STATE[s.state] ?? ['warn', s.state];
              const memPct = s.memory ? pctOf(s.memory.used_bytes, mbToBytes(s.memory.limit_mb)) : null;
              const diskPct = s.disk ? pctOf(s.disk.used_bytes, mbToBytes(s.disk.limit_mb)) : null;
              const u = up24[s.name]?.uptime;
              return (
                <div className="cp-srv" key={s.name}>
                  <div className="name"><b>{s.name}</b>{s.suspended && <Pill state="warn">gesperrt</Pill>}</div>
                  <div><Pill state={state}>{word}</Pill>{s.state === 'running' && <div className="up since">Laufzeit {isNum(s.uptime_seconds) ? durationText(s.uptime_seconds) : '–'}</div>}<div className="up">24 h: {pctText(u, 0)}</div><div className="up net" title="Netzwerk gesamt">↓ {bytesText(s.network?.rx_bytes)} · ↑ {bytesText(s.network?.tx_bytes)}</div></div>
                  <div className="vals">
                      <Slim label="CPU" value={isNum(s.cpu_percent) ? Number(s.cpu_percent) : null} />
                      <Slim label="Speicher" value={memPct} text={memPct == null ? '–' : `${Math.round(memPct)} %`} sub={usedOfLimit(s.memory)} />
                      <Slim label="Platte" value={diskPct} text={diskPct == null ? '–' : `${Math.round(diskPct)} %`} sub={usedOfLimit(s.disk)} />
                  </div>
                </div>
              );
            })}
          </div>
          )
        )}
      </div>
    </Section>
  );
}

export function MaintenanceBars({ snap, now }) {
  const items = dataOf(snap, 'maintenance')?.items ?? dataOf(snap, 'health')?.maintenance ?? null;
  if (items == null) return <section className="cp-section" aria-label="Wartungen"><Card title="Wartungen"><p className="cp-hero"><span className="cp-big muted">–</span><span className="cp-unit">gerade nicht verfügbar</span></p></Card></section>;
  const shown = items.map((m) => ({ m, p: maintenancePhase(m, now) })).filter((x) => x.p.phase !== 'past');
  if (!shown.length) return <section className="cp-section" aria-label="Wartungen"><Card title="Wartungen"><p className="cp-hero"><span className="cp-big muted">0</span><span className="cp-unit">✓ Keine Wartung geplant</span></p></Card></section>;
  return (
    <section className="cp-section" aria-label="Wartungen">
      {shown.map(({ m, p }) => (
        <div className="cp-maint" key={m.title + m.startsAt}>
          <div className="head"><Pill state="maint">Wartung</Pill><b>{m.title || '–'}</b><span className="muted small">{p.text}</span></div>
          <p>{new Date(m.startsAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} bis {new Date(m.endsAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</p>
          {m.description && <p>{m.description}</p>}
        </div>
      ))}
    </section>
  );
}

/* ---------- Gesamtlage ---------- */
export function OverviewSection({ snap, range }) {
  const g = source(snap, 'statsGlobal');
  const daily = g.available ? lastN(g.data.daily, range) : [];
  const has = daily.length > 0;
  const msgs = has ? sumBy(daily, (d) => d.messages) : null, voice = has ? sumBy(daily, (d) => d.voice_hours) : null;
  const joins = has ? sumBy(daily, (d) => d.joins) : null, leaves = has ? sumBy(daily, (d) => d.leaves) : null, net = diff(joins, leaves);
  const d0 = g.available ? g.data : {};
  const none = <p className="cp-empty">{g.available ? '– Keine Tagesdaten' : `– ${g.reason ?? 'gerade nicht verfügbar'}`}</p>;
  const missing = g.available && d0.derived && d0.servers_without_daily > 0 ? ` · Verlauf fehlt bei ${d0.servers_without_daily} von ${d0.servers_total} Servern` : '';
  return (
    <Section id="lage" title="Gesamtlage" sub={`${d0.allServers ? 'Summe aller Server' : d0.derived || snap.filter?.keywords?.length ? 'nur gefilterte Server' : 'alle Server'}, letzte ${range} Tage${missing}`}>
      {d0.allServers && <p className="cp-empty">Hinweis: {d0.filterNote}. Gezeigt werden die echten Zahlen über alle Server.</p>}
      <div className="cp-grid cols-3">
        <Card title="Nachrichten" right={`${num(d0.servers_with_activity)} aktive Server`}>
          <p className="cp-hero"><span className="cp-big">{num(msgs)}</span><span className="cp-unit">in {has ? daily.length : '–'} Tagen</span></p>
          {has ? <TimeChart data={daily} series={[{ key: 'messages', label: 'Nachrichten', color: 'var(--blue-line)' }]} label="Nachrichten pro Tag" /> : none}
        </Card>
        <Card title="Sprachstunden" right={`${num(d0.active_chatters)} aktive Schreiber`}>
          <p className="cp-hero"><span className="cp-big">{num(voice, 1)}</span><span className="cp-unit">Std. in {has ? daily.length : '–'} Tagen</span></p>
          {has ? <TimeChart data={daily} series={[{ key: 'voice_hours', label: 'Sprachstunden', color: 'var(--blue-line)' }]} format={(v) => compact(v)} label="Sprachstunden pro Tag" /> : none}
        </Card>
        <Card title="Beitritte und Abgänge">
          <p className="cp-hero"><span className="cp-big">{net != null && net > 0 ? '+' : ''}{num(net)}</span><span className="cp-unit">netto · {num(joins)} Beitritte, {num(leaves)} Abgänge</span></p>
          {has ? <TimeChart data={daily} series={[{ key: 'joins', label: 'Beitritte', color: 'var(--blue-line)' }, { key: 'leaves', label: 'Abgänge', color: 'var(--muted)' }]} label="Beitritte und Abgänge pro Tag" /> : none}
        </Card>
      </div>
    </Section>
  );
}

/* ---------- Top-Server ---------- */
const RANK = {
  messages: { label: 'Nachrichten', pick: (s) => s.messages },
  voice: { label: 'Sprachstunden', pick: (s) => s.voice_hours },
  tickets: { label: 'Tickets', pick: (s) => s.tickets?.total },
  members: { label: 'Mitgliedern', pick: (s) => s.member_count },
};

export function topServers(snap, range, by, count) {
  const src = source(snap, `serversTop${range}`);
  if (!src.available) return { available: false };
  const pick = RANK[by].pick;
  const items = [...(src.data.items ?? [])].map((s) => ({ ...s, name: serverName(s) })).sort((a, z) => (Number(pick(z)) || 0) - (Number(pick(a)) || 0)).slice(0, count);
  return { available: true, items, withData: src.data.servers_with_data ?? src.data.items?.length ?? 0, days: src.data.days, allServers: Boolean(src.data.allServers) };
}

function TopDetail({ s }) {
  const t = s.tickets ?? {}, a = s.applications ?? {}, m = s.moderation ?? {};
  const types = (o) => Object.entries(o ?? {}).map(([k, v]) => `${k}: ${num(v)}`).join(' · ') || '–';
  return (
    <div className="detail">
      <dl className="cp-detail-grid">
        <div><dt>Mitglieder</dt><dd>{num(s.member_count)} ({num(s.online_count)} online)</dd></div>
        <div><dt>Netto-Mitglieder</dt><dd>{s.net_members > 0 ? '+' : ''}{num(s.net_members)}</dd></div>
        <div><dt>Aktivierung</dt><dd>{s.activation_status ?? '–'}</dd></div>
        <div><dt>Tickets</dt><dd>{num(t.total)} gesamt · {num(t.open)} offen · {num(t.closed)} zu · {num(t.created)} neu</dd></div>
        <div><dt>Bewerbungen</dt><dd>{num(a.total)} gesamt · {num(a.submitted)} neu · {types(a.by_status)}</dd></div>
        <div><dt>Moderation</dt><dd>{num(m.total)} · {types(m.by_type)}</dd></div>
      </dl>
      {!(s.daily?.length > 1) && <p className="muted small">Verlauf je Tag: –</p>}
      {s.daily?.length > 1 && (
        <div className="cp-grid cols-2">
          <div><h3 className="small muted">Nachrichten pro Tag</h3><TimeChart data={s.daily} series={[{ key: 'messages', label: 'Nachrichten', color: 'var(--blue-line)' }]} height={120} /></div>
          <div><h3 className="small muted">Beitritte und Abgänge</h3><TimeChart data={s.daily} series={[{ key: 'joins', label: 'Beitritte', color: 'var(--blue-line)' }, { key: 'leaves', label: 'Abgänge', color: 'var(--muted)' }]} height={120} /></div>
        </div>
      )}
    </div>
  );
}

export function TopServersSection({ snap, range, expandable = true, fixedCount, fixedBy }) {
  const [count, setCount] = useState(5);
  const [by, setBy] = useState('messages');
  const [open, setOpen] = useState(null);
  const useCount = fixedCount ?? count, useBy = fixedBy ?? by;
  const top = topServers(snap, range, useBy, useCount);
  return (
    <Section id="top" title="Top-Server" sub={top.available ? `Rangfolge nach ${RANK[useBy].label}, ${top.days ?? range} Tage${top.allServers ? ` · alle Server, denn unter den aktivsten ist keiner mit ${filtered(snap)} im Namen` : ''}` : undefined}
      right={expandable ? undefined : undefined}>
      {expandable && (
        <div className="cp-controls" role="group" aria-label="Auswahl Top-Server">
          <label className="muted">Anzahl <select className="cp-select" value={count} onChange={(e) => setCount(Number(e.target.value))}>{[3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="muted">Rangfolge nach <select className="cp-select" value={by} onChange={(e) => setBy(e.target.value)}>{Object.entries(RANK).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        </div>
      )}
      <div className="cp-card">
        {!top.available ? <Unavailable what="Top-Server" /> : top.items.length === 0 ? <Empty>{filtered(snap) ? `Unter den 10 aktivsten Servern, die die API liefert, ist keiner mit ${filtered(snap)} im Namen.` : 'In diesem Zeitraum gab es keine Aktivität auf den Servern.'}</Empty> : (
          <div className="cp-top">
            {top.items.map((s, i) => {
              const isOpen = open === s.id || open === s.name;
              const key = s.id ?? s.name;
              const figs = (
                <span className="figs">
                  <span>Mitglieder <b>{num(s.member_count)}</b></span>
                  <span>Beitritte/Abgänge <b>{num(s.joins)}/{num(s.leaves)}</b></span>
                  <span>Nachrichten <b>{num(s.messages)}</b></span>
                  <span>Sprache <b>{num(s.voice_hours, 1)} Std.</b></span>
                  <span>Schreiber <b>{num(s.active_chatters)}</b></span>
                  <span>Tickets <b>{num(s.tickets?.total)}</b></span>
                  <span>Bewerbungen <b>{num(s.applications?.total)}</b></span>
                  <span>Moderation <b>{num(s.moderation?.total)}</b></span>
                </span>
              );
              const row = (
                <>
                  <span className="rank">{i + 1}.</span>
                  <span className="nm">{s.name}</span>
                  {figs}
                  <Spark values={(s.daily ?? []).map((d) => d.messages)} />
                  {expandable && <span className="chev" aria-hidden="true">▸</span>}
                </>
              );
              return (
                <div className="cp-toprow" key={key}>
                  {expandable
                    ? <button type="button" aria-expanded={isOpen} aria-controls={`top-${i}`} onClick={() => setOpen(isOpen ? null : key)}>{row}</button>
                    : <div className="static">{row}</div>}
                  {expandable && isOpen && <div id={`top-${i}`}><TopDetail s={s} /></div>}
                </div>
              );
            })}
          </div>
        )}
        {top.available && top.withData > top.items.length && <p className="muted small">{top.items.length} von {top.withData} Servern mit Daten.</p>}
      </div>
    </Section>
  );
}
