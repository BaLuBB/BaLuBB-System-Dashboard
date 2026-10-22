import React from 'react';
import { Columns, Donut, HBars, LegendList, Meter, TimeChart } from './charts.jsx';
import { SOURCE_LABEL, bytesText, compact, dataOf, durationText, isNum, lastN, num, pctText, relTime, source, sumBy } from './data.js';
import { sourceStates } from './status.js';
import { filterLabel } from './filter.js';
import { topServers } from './sectionsA.jsx';
import { Card, Empty, Pill, Section, Unavailable } from './ui.jsx';

/* ---------- Abläufe ---------- */
export function AutomationsSection({ snap }) {
  const auto = source(snap, 'automations'), hist = source(snap, 'automationsHistory');
  const a = auto.available ? auto.data : null, h = hist.available ? hist.data : null;
  // Fehlt ein Wert, wird nichts gerechnet: der Tag bleibt eine Lücke
  const daily = (h?.daily ?? []).map((d) => ({ date: d.date, values: [isNum(d.runs) && isNum(d.errors) ? Math.max(0, d.runs - d.errors) : null, isNum(d.errors) ? Number(d.errors) : null] }));
  const filterNote = snap.filter?.keywords?.length ? ` · Listen nur mit ${filterLabel(snap.filter.keywords)} im Namen` : '';
  const lastRuns = a ? [...(a.items ?? [])].sort((p, q) => (Date.parse(q.last_run) || 0) - (Date.parse(p.last_run) || 0)).slice(0, 4) : [];
  const runStatus = (x) => (!x.last_run || !x.last_status ? '–' : /(err|fail|fehl)/i.test(x.last_status) ? '✕ Fehler' : '✓ ok');
  return (
    <Section id="ablaeufe" title="Abläufe" sub={h ? `letzte ${num(h.days)} Tage (die API liefert höchstens 7)${filterNote}` : undefined}>
      <div className="cp-grid cols-3">
        <Card title="Läufe und Fehler je Tag" right={h?.incomplete ? <Pill state="warn">Untergrenze</Pill> : undefined}>
          {h ? (
            <>
              <p className="cp-hero">
                <span className="cp-big">{pctText(h.error_rate_percent)}</span>
                <span className="cp-unit">Fehlerquote · {num(h.runs)} Läufe, {num(h.errors)} Fehler{h.aggregate_all ? ' (alle Abläufe)' : ''}</span>
              </p>
              {daily.length ? <Columns data={daily} series={[{ label: 'Erfolgreich', color: 'var(--blue-line)' }, { label: 'Fehler', color: 'var(--crit)' }]} label="Läufe und Fehler je Tag" /> : <p className="cp-empty">– Keine Tagesdaten</p>}
              {h.incomplete && <p className="muted small">Hinweis: n8n liefert höchstens 2000 Läufe. Die Zahlen sind eine Untergrenze.</p>}
            </>
          ) : <Unavailable what="Verlauf" />}
        </Card>
        <Card title="Aktivste Abläufe">
          {h ? <HBars rows={(h.busiest ?? []).slice(0, 5).map((x) => ({ label: x.name, value: x.runs }))} empty={h.busiest == null ? '–' : snap.filter?.keywords?.length ? `Keine Läufe von Abläufen mit ${filterLabel(snap.filter.keywords)} im Namen.` : 'Keine Läufe im Zeitraum.'} /> : <Unavailable />}
          <hr className="cp-rule" />
          <h3>Fehleranfälligste Abläufe</h3>
          {h ? (h.most_errors == null
            ? <p className="cp-empty">–</p>
            : h.most_errors.length
              ? <HBars rows={h.most_errors.slice(0, 5).map((x) => ({ label: x.name, value: x.errors ?? x.count ?? null, color: 'var(--crit)' }))} />
              : <Empty>✓ Keine Fehler im Zeitraum.</Empty>) : <Unavailable />}
        </Card>
        <Card title="Heute">
          {a ? (
            <>
              <p className="cp-hero"><span className="cp-big">{num(a.runs_today)}</span><span className="cp-unit">Läufe heute</span></p>
              <p className="cp-hero"><span className="cp-big" style={{ color: a.errors_today > 0 ? 'var(--crit)' : undefined }}>{num(a.errors_today)}</span><span className="cp-unit">{!isNum(a.errors_today) ? 'Fehler heute' : a.errors_today > 0 ? '✕ Fehler heute' : '✓ keine Fehler heute'}</span></p>
              <p className="muted">{num(a.active)} von {num(a.total)} Abläufen aktiv</p>
              <hr className="cp-rule" />
              <h3>Zuletzt gelaufen</h3>
              <ul className="cp-lastruns">
                {lastRuns.length ? lastRuns.map((x) => (
                  <li key={x.name}><span>{x.name}</span><span className="muted">{x.last_run ? relTime(x.last_run, Date.now()) : '–'} · {runStatus(x)}</span></li>
                )) : <li><span className="muted">–</span></li>}
              </ul>
              <details className="cp-tableview">
                <summary>Alle Abläufe ({num(a.total)})</summary>
                <div className="scroll"><table className="cp-table"><thead><tr><th>Ablauf</th><th>Status</th><th className="num">Läufe</th><th className="num">Fehler</th></tr></thead>
                  <tbody>{(a.items ?? []).map((x) => <tr key={x.name}><td>{x.name}</td><td>{x.active == null ? '–' : x.active ? '✓ aktiv' : '– inaktiv'}</td><td className="num">{num(x.runs_today)}</td><td className="num">{num(x.errors_today)}</td></tr>)}</tbody></table></div>
              </details>
            </>
          ) : <Unavailable />}
        </Card>
      </div>
    </Section>
  );
}

/* ---------- Tickets, Bewerbungen, Moderation ---------- */
const MOD = [['warn', 'Verwarnungen', 'var(--ramp-1)'], ['mute', 'Stummschaltungen', 'var(--ramp-2)'], ['timeout', 'Timeouts', 'var(--ramp-3)'], ['kick', 'Kicks', 'var(--ramp-4)'], ['ban', 'Banns', 'var(--ramp-5)']];

/** Bei aktivem Namensfilter: Tickets, Bewerbungen, Moderation je passendem Server (die API liefert Tagesverläufe nur über alle Server). Fehlt ein Wert, steht „–“. */
export function SupportByServer({ snap }) {
  const t = topServers(snap, 30, 'messages', 10);
  const items = t.available ? t.items : [];
  const sum = (f) => sumBy(items, f);
  const val = (f) => (s) => { const v = f(s); return isNum(v) ? Number(v) : null; };
  const rows = (f) => items.map((s) => ({ label: s.name, value: val(f)(s) })).sort((a, z) => (z.value ?? -1) - (a.value ?? -1));
  return (
    <Section id="support" title="Tickets, Bewerbungen, Moderation" sub="je Server mit passendem Namen, letzte 30 Tage">
      <div className="cp-grid cols-4">
        <Card title="Tickets">
          <p className="cp-hero"><span className="cp-big">{num(sum((s) => s.tickets?.open))}</span><span className="cp-unit">offen · {num(sum((s) => s.tickets?.total))} gesamt · {num(sum((s) => s.tickets?.created))} neu</span></p>
          <HBars rows={rows((s) => s.tickets?.total)} empty="–" />
        </Card>
        <Card title="Bewerbungen">
          <p className="cp-hero"><span className="cp-big">{num(sum((s) => s.applications?.submitted))}</span><span className="cp-unit">neu · {num(sum((s) => s.applications?.total))} gesamt</span></p>
          <HBars rows={rows((s) => s.applications?.total)} empty="–" />
        </Card>
        <Card title="Moderation">
          <p className="cp-hero"><span className="cp-big">{num(sum((s) => s.moderation?.total))}</span><span className="cp-unit">Aktionen</span></p>
          <HBars rows={rows((s) => s.moderation?.total)} empty="–" />
        </Card>
        <FeedbackCard snap={snap} range={30} />
      </div>
    </Section>
  );
}

/** Feedback pro Tag; ohne Daten bleibt die Karte stehen, mit „–“. */
function FeedbackCard({ snap, range }) {
  const fb = source(snap, 'feedback');
  const vol = fb.available && Array.isArray(fb.data.volume) ? lastN(fb.data.volume, range) : [];
  return (
    <Card title="Feedback" right={`${num(fb.available ? fb.data.total : null)} gesamt`}>
      <p className="cp-hero"><span className="cp-big">{vol.length ? num(sumBy(vol, (x) => x.received)) : '–'}</span><span className="cp-unit">erhalten in {vol.length || '–'} Tagen</span></p>
      {vol.length
        ? <Columns data={vol.map((x) => ({ date: x.date, values: [x.received] }))} series={[{ label: 'Erhalten', color: 'var(--blue-line)' }]} label="Feedback pro Tag" />
        : <p className="cp-empty">{!fb.available ? '– gerade nicht verfügbar' : snap.filter?.keywords?.length ? '– nach Namen nicht filterbar' : '– Keine Tagesdaten'}</p>}
    </Card>
  );
}

export function SupportSection({ snap, range }) {
  const t = source(snap, 'tickets'), ap = source(snap, 'applications'), mo = source(snap, 'moderation');
  if (t.hidden && ap.hidden && mo.hidden) return <SupportByServer snap={snap} />;
  return (
    <Section id="support" title="Tickets, Bewerbungen, Moderation" sub={`letzte ${range} Tage`}>
      <div className="cp-grid cols-4">
        <Card title="Tickets">
          {!t.available ? <Unavailable /> : (() => {
            const d = t.data, vol = lastN(d.volume, range);
            return (
              <>
                <p className="cp-hero"><span className="cp-big">{num(d.open)}</span><span className="cp-unit">offen · {num(d.total)} gesamt · {num(d.closed)} geschlossen</span></p>
                <p className="muted small">{num(d.servers_with_tickets)} Server mit Tickets</p>
                {vol.length ? <Columns data={vol.map((x) => ({ date: x.date, values: [x.created, x.closed] }))} series={[{ label: 'Erstellt', color: 'var(--blue-line)' }, { label: 'Geschlossen', color: 'var(--muted)' }]} label="Tickets pro Tag" /> : <Empty>Keine Tickets im Zeitraum.</Empty>}
              </>
            );
          })()}
        </Card>
        <Card title="Bewerbungen">
          {!ap.available ? <Unavailable /> : (() => {
            const d = ap.data, vol = lastN(d.volume, range), st = d.by_status ?? {};
            return (
              <>
                <p className="cp-hero"><span className="cp-big">{num(st.pending)}</span><span className="cp-unit">offen · {num(d.total)} gesamt</span></p>
                <HBars rows={[['accepted', 'Angenommen'], ['pending', 'Offen'], ['rejected', 'Abgelehnt']].map(([k, l]) => ({ label: l, value: isNum(st[k]) ? Number(st[k]) : null }))} />
                {vol.length ? <Columns data={vol.map((x) => ({ date: x.date, values: [x.submitted, x.accepted] }))} series={[{ label: 'Eingereicht', color: 'var(--blue-line)' }, { label: 'Angenommen', color: 'var(--muted)' }]} label="Bewerbungen pro Tag" /> : <Empty>Keine Bewerbungen im Zeitraum.</Empty>}
              </>
            );
          })()}
        </Card>
        <Card title="Moderation">
          {!mo.available ? <Unavailable /> : (() => {
            const vol = lastN(mo.data.volume, range);
            const totals = MOD.map(([k, l, c]) => ({ label: l, value: sumBy(vol, (x) => x[k]), color: c }));
            const total = sumBy(totals, (x) => x.value);
            return (
              <>
                <p className="cp-hero"><span className="cp-big">{num(total)}</span><span className="cp-unit">Aktionen im Zeitraum</span></p>
                <HBars rows={totals} empty="Keine Aktionen." />
                {vol.length ? <Columns data={vol.map((x) => ({ date: x.date, values: MOD.map(([k]) => x[k]) }))} series={MOD.map(([, l, c]) => ({ label: l, color: c }))} label="Moderation pro Tag" /> : <Empty>Keine Aktionen im Zeitraum.</Empty>}
              </>
            );
          })()}
        </Card>
        <FeedbackCard snap={snap} range={range} />
      </div>
    </Section>
  );
}

/* ---------- System ---------- */
function Def({ rows }) {
  return <dl className="cp-detail-grid">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? '–'}</dd></div>)}</dl>;
}
export function SystemSection({ snap }) {
  const sys = source(snap, 'system'), counts = source(snap, 'counts'), ov = source(snap, 'overview');
  const cb = ov.available ? ov.data.custom_bots : null;
  const filtered = Boolean(snap.filter?.keywords?.length);
  return (
    <Section id="system" title="System">
      <div className="cp-grid cols-3">
        <Card title="Dashboard-Prozess">
          {!sys.available ? <Unavailable /> : <Def rows={[
            ['Node-Version', sys.data.dashboard?.node], ['Laufzeit', durationText(sys.data.dashboard?.uptime_seconds)],
            ['Speicher', sys.data.dashboard ? `${num(sys.data.dashboard.memory_mb)} MB (Heap ${num(sys.data.dashboard.heap_mb)} MB)` : undefined],
            ['Last (1/5/15 Min.)', sys.data.dashboard?.load ? sys.data.dashboard.load.map((x) => num(x, 2)).join(' / ') : undefined], ['CPUs', num(sys.data.dashboard?.cpus)]]} />}
        </Card>
        <Card title="Wings">
          {!sys.available ? <Unavailable /> : <Def rows={[
            ['Version', sys.data.wings?.version], ['Betriebssystem', sys.data.wings?.os], ['Architektur', sys.data.wings?.architecture],
            ['CPUs', num(sys.data.wings?.cpu_count)], ['Kernel', sys.data.wings?.kernel_version]]} />}
        </Card>
        <Card title="Bestand" right={filtered ? 'alle Server (nicht nach Namen aufteilbar)' : undefined}>
          {!counts.available ? <Unavailable /> : <Def rows={[
            ['Ticket-Kategorien', num(counts.data.ticket_categories)], ['Panels', num(counts.data.ticket_panels)], ['Buttons', num(counts.data.ticket_buttons)],
            ['Rollen-Links', num(counts.data.role_links)], ['Turniere', `${num(counts.data.tournaments)} (${num(counts.data.tournament_entries)} Einträge)`],
            ['Status-Abonnenten', num(counts.data.status_subscribers)], ['Server-Einstellungen', num(counts.data.server_settings_rows)],
            ['Custom-Bots', cb && isNum(cb.total) ? `${num(cb.total)}${cb.by_status && Object.keys(cb.by_status).length ? ` (${Object.entries(cb.by_status).map(([k, v]) => `${k} ${num(v)}`).join(', ')})` : ''}` : filtered ? '– (nach Namen nicht filterbar)' : undefined]]} />}
        </Card>
      </div>
    </Section>
  );
}

/* ---------- Aktivität im Dashboard ---------- */
export function ActivitySection({ snap, range, compact = false }) {
  const act = source(snap, 'dashboardActivity');
  return (
    <Section id="aktivitaet" title="Aktivität im Dashboard" sub={`letzte ${range} Tage, nur Zahlen je Art und Tag${snap.filter?.keywords?.length ? ' · alle Server (nicht nach Namen aufteilbar)' : ''}`}>
      {(() => {
        const ok = act.available, daily = ok ? lastN(act.data.daily, range) : [], total = daily.length ? sumBy(daily, (d) => d.actions) : null;
        const actions = ok && Array.isArray(act.data.by_action) ? [...act.data.by_action].sort((a, z) => (z.count ?? -1) - (a.count ?? -1)).slice(0, compact ? 5 : 8) : null;
        return (
          <div className="cp-grid cols-2">
            <Card title="Häufigste Aktionen">
              {actions ? <HBars rows={actions.map((x) => ({ label: x.action, value: x.count }))} empty="Keine Aktionen protokolliert." /> : <p className="cp-empty">{ok ? '–' : '– gerade nicht verfügbar'}</p>}
              {ok && act.data.note && <p className="muted small">{act.data.note}</p>}
            </Card>
            <Card title="Verlauf pro Tag">
              <p className="cp-hero"><span className="cp-big">{num(total)}</span><span className="cp-unit">Aktionen in {daily.length || '–'} Tagen</span></p>
              {daily.length ? <TimeChart data={daily} series={[{ key: 'actions', label: 'Aktionen', color: 'var(--blue-line)' }]} label="Aktionen pro Tag" /> : <p className="cp-empty">{ok ? '– Keine Tagesdaten' : '– gerade nicht verfügbar'}</p>}
            </Card>
          </div>
        );
      })()}
    </Section>
  );
}

/* ---------- Versionen ---------- */
export function ReleasesSection({ snap, limit = 6, compact = false }) {
  const rel = source(snap, 'releases');
  return (
    <Section id="versionen" title="Versionen">
      <div className="cp-card">
        {!rel.available ? <Unavailable /> : (rel.data.items ?? []).length === 0 ? <Empty>Noch keine Versionen veröffentlicht.</Empty> : (
          (rel.data.items ?? []).slice(0, limit).map((r, i) => (
            <details className="cp-rel" key={r.version} open={!compact && i === 0}>
              <summary><span className="v">{r.version}</span><span className="muted">{r.date}</span><span>{r.title}</span><span className="muted small">{num(r.changes)} Änderungen</span></summary>
              <ul>{(r.items ?? []).map((c, j) => <li key={j}><span className="cp-kind">{c.kind}</span>{c.text}</li>)}</ul>
            </details>
          ))
        )}
      </div>
    </Section>
  );
}

/* ---------- Cloudflare ---------- */
const ACTION = { block: 'Blockiert', managed_challenge: 'Prüfung (Challenge)', challenge: 'Prüfung (Challenge)', js_challenge: 'Prüfung (JS)', log: 'Nur protokolliert', allow: 'Erlaubt', skip: 'Übersprungen', jschallenge: 'Prüfung (JS)' };
const THREAT = { Bot: 'Bots', Anonymizer: 'Anonymisierer', 'Search Engine': 'Suchmaschinen', 'Known Bot': 'Bekannte Bots' };
const CODE = { '2xx': ['var(--ok)', '✓', 'Erfolg 2xx'], '3xx': ['var(--blue-line)', '→', 'Umleitung 3xx'], '4xx': ['var(--warn)', '▲', 'Client 4xx'], '5xx': ['var(--crit)', '✕', 'Server 5xx'] };

export function CloudflareSection({ snap, range }) {
  const c = snap.cloudflare;
  if (!c || c.configured === false) return <Section id="cloudflare" title="Cloudflare"><Card><p className="cp-hero"><span className="cp-big muted">–</span><span className="cp-unit">nicht eingerichtet</span></p></Card></Section>;
  const stand = c.fetchedAt ? `Stand ${relTime(c.fetchedAt)}` : undefined;
  if (c.error) return <Section id="cloudflare" title="Cloudflare" sub={stand}><Card><Unavailable what={c.error} /></Card></Section>;
  const d = c.data;
  const days = lastN(d.days, range);
  const req = sumBy(days, (x) => x.requests);
  const e5 = Array.isArray(d.status) ? (d.status.find((s) => s.klass === '5xx')?.requests ?? 0) : null; // Cloudflare liefert nur Klassen mit Anfragen, keine 5xx-Zeile heißt 0
  const rate = isNum(e5) && isNum(d.totals?.requests) && d.totals.requests > 0 ? (e5 / d.totals.requests) * 100 : null; // fehlende Gesamtzahl: keine Rate statt Rate durch 1
  const apiCalls = (d.paths ?? []).filter((p) => p.path.startsWith('/api/')).reduce((a, p) => a + p.requests, 0);
  const sec = d.security;
  const handled = sec ? sec.actions.filter((a) => a.action !== 'keine') : [];
  return (
    <Section id="cloudflare" title="Cloudflare" sub={`${stand ?? ''}${stand ? ' · ' : ''}letzte ${days.length} Tage (Cloudflare liefert je nach Tarif weniger)`}>
      <div className="cp-grid cols-3">
        <Card title="Verkehr">
          <p className="cp-hero"><span className="cp-big">{num(req)}</span><span className="cp-unit">Anfragen · {bytesText(d.totals.bytes)}</span></p>
          <Columns data={days.map((x) => ({ date: x.date, values: [x.requests] }))} series={[{ label: 'Anfragen', color: 'var(--blue-line)' }]} label="Anfragen pro Tag" />
          <Meter label="Cache-Quote" value={d.totals.cacheRate} text={pctText(d.totals.cacheRate, 0)} sub={`${num(d.totals.cached)} aus dem Cache, ${num(d.totals.requests - d.totals.cached)} vom Ursprung`} />
        </Card>
        <Card title="Antwortcodes" right={<Pill state={rate == null ? undefined : rate > 1 ? 'warn' : 'ok'}>Fehlerrate {pctText(rate)}</Pill>}>
          <Donut size={150} centerValue={pctText(rate == null ? null : 100 - rate, rate != null && 100 - rate > 99 && e5 > 0 ? 1 : 0)} centerLabel="ohne 5xx"
            data={(d.status ?? []).map((s) => ({ label: CODE[s.klass]?.[2] ?? s.klass, value: s.requests, color: CODE[s.klass]?.[0] ?? 'var(--muted)', icon: CODE[s.klass]?.[1] }))} />
        </Card>
        <Card title="Länder und Seiten">
          <HBars rows={d.countries.slice(0, 6).map((x) => ({ label: x.country, value: x.requests }))} empty="Keine Daten." />
          <hr className="cp-rule" />
          <h3>Top-Pfade (24 h)</h3>
          {d.paths ? <HBars rows={d.paths.slice(0, 6).map((p) => ({ label: p.path, value: p.requests }))} /> : <Unavailable />}
          {d.paths && <p className="muted small">Aufrufe der API darunter: <b className="mono">{num(apiCalls)}</b></p>}
        </Card>
        <Card title="Sicherheit" right={`${num(d.totals.threats)} Bedrohungen · ${d.days.length} Tage`}>
          {sec && <h3>Maßnahmen (24 h)</h3>}
          {sec ? (handled.length
            ? <HBars rows={handled.map((a) => ({ label: ACTION[a.action] ?? a.action, value: a.requests, color: 'var(--warn)' }))} />
            : <Empty>✓ Cloudflare musste keine Anfragen blockieren oder prüfen.</Empty>) : <Unavailable />}
          <hr className="cp-rule" /><h3>Bedrohungsarten ({d.days.length} Tage)</h3>
          {Array.isArray(d.threatTypes) ? <HBars rows={d.threatTypes.slice(0, 5).map((x) => ({ label: THREAT[x.type] ?? x.type, value: x.requests }))} empty="✓ Keine Bedrohungen." /> : <p className="cp-empty">–</p>}
        </Card>
        <Card title="Anfragen je Stunde (24 h)">
          {d.hourly ? <Columns data={d.hourly.map((x) => ({ date: x.t.slice(0, 10), values: [x.cached, Math.max(0, x.requests - x.cached)] }))} series={[{ label: 'Aus dem Cache', color: 'var(--blue-line)' }, { label: 'Vom Ursprung', color: 'var(--muted)' }]} label="Anfragen je Stunde" /> : <Unavailable />}
        </Card>
        <Card title="Besucher (Web-Analytics)">
          {!d.web ? <Unavailable /> : !d.web.enabled ? <Empty>Noch keine Besucherdaten. In Cloudflare unter Web-Analytics die Website aktivieren, die Zahlen erscheinen dann automatisch.</Empty> : (
            <>
              <p className="cp-hero"><span className="cp-big">{num(d.web.visits)}</span><span className="cp-unit">Besuche · {num(d.web.pageloads)} Seitenaufrufe</span></p>
              <HBars rows={d.web.pages.slice(0, 6).map((p) => ({ label: p.path, value: p.pageloads }))} />
            </>
          )}
        </Card>
      </div>
    </Section>
  );
}

/* ---------- Fußzeile ---------- */
const LABEL = SOURCE_LABEL;

export function Footer({ snap }) {
  const states = sourceStates(snap);
  const cf = snap.cloudflare;
  return (
    <footer className="cp-footer">
      {snap.filter?.keywords?.length > 0 && <div>Filter: Dienste, Abläufe und Top-Server nur mit {filterLabel(snap.filter.keywords)} im Namen. Gesamtlage, Tickets, Bewerbungen und Moderation stammen nur von diesen Servern; die Dashboard-Aktivität lässt sich nicht nach Namen aufteilen und zeigt alle Server.</div>}
      <div>Nur lesen · Datenquellen: BaLuBB-API und Cloudflare-Analysen · Version {typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '1'} · Stand {new Date(snap.generatedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</div>
      <div className="cp-sources" aria-label="Zustand der Datenquellen">
        {states.filter((s) => !s.hidden).map((s) => <span key={s.name} className={s.available ? 'ok' : 'bad'} title={s.error}>{LABEL[s.name] ?? s.name}{s.available ? '' : ' (gerade nicht verfügbar)'}</span>)}
        {cf && cf.configured !== false && <span className={cf.error ? 'bad' : 'ok'}>Cloudflare{cf.error ? ' (gerade nicht verfügbar)' : ''}</span>}
      </div>
    </footer>
  );
}
