// Eigene Inhalte für die Diashow-Kategorien (nur Anzeige, keine Bedienung).
import React from 'react';
import { Donut, HBars, TimeChart } from './charts.jsx';
import { dataOf, isNum, num, pctText, source } from './data.js';
import { MaintenanceBars, StatusSection, TodoSection, topServers } from './sectionsA.jsx';
import { overallStatus } from './status.js';
import { Card, Pill, Section } from './ui.jsx';
import { runningSeries, statusStrips, uptimeByServer } from '../history.js';
import { filterLabel } from './filter.js';

const emptyTop = (snap) => (snap.filter?.keywords?.length ? `Unter den aktivsten Servern ist keiner mit ${filterLabel(snap.filter.keywords)} im Namen.` : 'Keine Aktivität.');

const NOTE_TAG = { crit: 'Fehler', warn: 'Warnung', maint: 'Wartung', info: 'Hinweis' };
const serverItems = (snap) => dataOf(snap, 'servers')?.items ?? dataOf(snap, 'health')?.servers?.items ?? [];

/** Kategorie „Überblick“: Zu erledigen, Gesamtzustand als Satz, Zustand der Server als Ring, Hinweise, Wartungen. */
export function OverviewSlide({ snap, now }) {
  const st = overallStatus(snap, now);
  const items = serverItems(snap);
  const count = (s) => items.filter((x) => x.state === s).length;
  const ring = [
    { label: 'läuft', value: count('running'), color: 'var(--ok)', icon: '✓' },
    { label: 'startet', value: count('starting'), color: 'var(--warn)', icon: '▲' },
    { label: 'offline', value: count('offline'), color: 'var(--crit)', icon: '✕' },
  ];
  return (
    <div className="tv-cols tv-overview">
      <TodoSection snap={snap} now={now} />
      <div className="tv-stack">
        <Section id="zustand" title="Gesamtzustand">
          <div className="cp-card">
            <div className="cp-status" data-state={st.state}><Pill state={st.state} /><span className="sentence" role="status">{st.text}</span></div>
            {items.length === 0 && <p className="cp-empty">– Keine Serverdaten</p>}
            {items.length > 0 && <Donut data={ring} size={170} centerValue={`${count('running')}/${items.length}`} centerLabel="Server laufen" />}
            {st.notes.length > 0 && (
              <ul className="cp-notes">{st.notes.slice(0, 5).map((n, i) => <li key={i} className={n.level}><span className="tag">{NOTE_TAG[n.level]}</span><span>{n.text}</span></li>)}</ul>
            )}
          </div>
        </Section>
        <MaintenanceBars snap={snap} now={now} />
      </div>
    </div>
  );
}

/** Kategorie „Server“: links je Container eine Karte, rechts wie viele laufen und der Zustand der letzten 24 Stunden als Streifen. */
const STRIP_WORD = { r: 'läuft', s: 'startet', o: 'offline', x: 'anderer Zustand', '-': 'keine Messung' };
function Strip({ cells }) {
  return (
    <div className="tvs-strip" role="img" aria-label="Zustand der letzten 24 Stunden">
      {[...cells].map((c, i) => <i key={i} data-c={c} title={STRIP_WORD[c]} />)}
    </div>
  );
}

export function ServerSlide({ snap, now }) {
  const hist = snap.history ?? { names: [], points: [] };
  const items = serverItems(snap);
  const upMap = new Map(uptimeByServer(hist, 86400, now).map((u) => [u.name, u.uptime]));
  const strips = new Map(statusStrips(hist, 86400, 48, now).map((x) => [x.name, x.cells]));
  const running = items.filter((x) => x.state === 'running').length;
  const rows = [...items].sort((a, z) => String(a.name).localeCompare(String(z.name)));
  return (
    <div className="tv-cols tv-servers">
      <StatusSection snap={snap} now={now} compact />
      <Section id="verfuegbarkeit" title="Zustand im Überblick" sub="letzte 24 Stunden">
        <Card title="Jetzt">
          <p className="cp-hero"><span className="cp-big">{items.length ? `${running} von ${items.length}` : '–'}</span><span className="cp-unit">Containern laufen</span></p>
        </Card>
        <Card title="Zustand der letzten 24 Stunden" right="links ältester, rechts neuester Stand">
          <div className="tvs-rows">
            {rows.length === 0 && <p className="cp-empty">–</p>}
            {rows.map((s) => (
              <div className="tvs-row" key={s.name}>
                <span className="n">{s.name ?? '–'}</span>
                <Strip cells={strips.get(s.name) ?? '-'.repeat(48)} />
                <span className="p">{pctText(upMap.get(s.name), 0)}</span>
              </div>
            ))}
          </div>
          <p className="tvs-legend"><i data-c="r" /> läuft <i data-c="s" /> startet <i data-c="o" /> offline <i data-c="-" /> keine Messung · rechts: Anteil „läuft“</p>
        </Card>
      </Section>
    </div>
  );
}

/** Kategorie „Top-Server“: Rangliste und je ein Balkendiagramm für Nachrichten und Sprachstunden. */
export function TopBarsSlide({ snap }) {
  const by = (key) => topServers(snap, 30, key, 8);
  const msg = by('messages'), voice = by('voice');
  const rows = (t, f) => (t.available ? t.items.map((s) => ({ label: s.name, value: isNum(f(s)) ? Number(f(s)) : null })) : []);
  return (
    <div className="tv-cols tv-top">
      <div className="tv-stack">
        <Card title="Nachrichten je Server" right="letzte 30 Tage"><HBars rows={rows(msg, (s) => s.messages)} empty={emptyTop(snap)} /></Card>
        <Card title="Sprachstunden je Server" right="letzte 30 Tage"><HBars rows={rows(voice, (s) => s.voice_hours)} format={(v) => `${num(v, 1)} Std.`} empty={emptyTop(snap)} /></Card>
      </div>
      <TopTable snap={snap} />
    </div>
  );
}

function TopTable({ snap }) {
  const t = topServers(snap, 30, 'messages', 8);
  if (!source(snap, 'serversTop30').available) return <Card title="Top-Server"><p className="cp-unavail">gerade nicht verfügbar</p></Card>;
  return (
    <Card title="Top-Server nach Nachrichten" right={t.items.length ? `${t.items.length} Server${isNum(t.withData) && t.withData > t.items.length ? ` von ${num(t.withData)} mit Daten` : ''}` : undefined}>
      {t.allServers && <p className="muted small">Hinweis: Unter den aktivsten Servern ist keiner mit {filterLabel(snap.filter.keywords)} im Namen. Deshalb stehen hier alle Server.</p>}
      {t.items.length === 0 && <p className="cp-empty">{emptyTop(snap)}</p>}
      <table className="cp-table">
        <thead><tr><th>Server</th><th className="num">Mitglieder</th><th className="num">Schreiber</th><th className="num">Beitritte</th><th className="num">Abgänge</th><th className="num">Tickets</th><th className="num">Bewerb.</th><th className="num">Moderation</th></tr></thead>
        <tbody>{t.items.map((s, i) => (
          <tr key={s.id ?? s.name}><td>{i + 1}. {s.name}</td><td className="num">{num(s.member_count)}</td><td className="num">{num(s.active_chatters)}</td><td className="num">{num(s.joins)}</td><td className="num">{num(s.leaves)}</td><td className="num">{num(s.tickets?.total)}</td><td className="num">{num(s.applications?.total)}</td><td className="num">{num(s.moderation?.total)}</td></tr>
        ))}</tbody>
      </table>
      <p className="muted small">Schreiber (aktive), Beitritte und Abgänge zählen die letzten 30 Tage, Tickets und Bewerbungen insgesamt, Moderation sind die Aktionen.</p>
    </Card>
  );
}

