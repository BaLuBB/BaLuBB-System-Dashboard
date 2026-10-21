// Eigene Inhalte für die Diashow-Kategorien (nur Anzeige, keine Bedienung).
import React from 'react';
import { Donut, HBars, TimeChart } from './charts.jsx';
import { dataOf, num, pctText, source } from './data.js';
import { MaintenanceBars, StatusSection, TodoSection, topServers } from './sectionsA.jsx';
import { overallStatus } from './status.js';
import { Card, Pill, Section } from './ui.jsx';
import { runningSeries, uptimeByServer } from '../history.js';
import { filterLabel } from './filter.js';

const emptyTop = (snap) => (snap.filter?.keywords?.length ? `Kein Server mit ${filterLabel(snap.filter.keywords)} im Namen hat Aktivität.` : 'Keine Aktivität.');

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

/** Kategorie „Server“: Liste mit Balken, daneben Verfügbarkeit und der Verlauf der laufenden Server. */
export function ServerSlide({ snap, now }) {
  const up = uptimeByServer(snap.history ?? { names: [], points: [] }, 86400, now).filter((u) => u.uptime != null);
  const series = runningSeries(snap.history ?? { names: [], points: [] }).map((p) => ({ date: new Date(p.t * 1000).toISOString().slice(0, 10), running: p.running }));
  const total = Math.max(1, ...runningSeries(snap.history ?? { names: [], points: [] }).map((p) => p.total));
  return (
    <div className="tv-cols tv-servers">
      <StatusSection snap={snap} now={now} compact />
      <Section id="verfuegbarkeit" title="Verfügbarkeit und Verlauf" sub="letzte 24 Stunden">
        <Card title="Verfügbarkeit der letzten 24 Stunden">
          <HBars rows={[...up].sort((a, z) => a.uptime - z.uptime).map((u) => ({ label: u.name, value: u.uptime }))} max={100} format={(v) => pctText(v, 0)}
            empty="Der Verlauf füllt sich mit jedem Lauf." />
        </Card>
        <Card title="Laufende Server im Verlauf" right={`bis ${total} Server`}>
          {series.length > 1 ? <TimeChart data={series} series={[{ key: 'running', label: 'Laufende Server', color: 'var(--blue-line)' }]} label="Laufende Server im Verlauf" /> : <p className="cp-empty">Der Verlauf füllt sich mit jedem Lauf.</p>}
        </Card>
      </Section>
    </div>
  );
}

/** Kategorie „Top-Server“: Rangliste und je ein Balkendiagramm für Nachrichten und Sprachstunden. */
export function TopBarsSlide({ snap }) {
  const by = (key) => topServers(snap, 30, key, 8);
  const msg = by('messages'), voice = by('voice');
  const rows = (t, f) => (t.available ? t.items.map((s) => ({ label: s.name, value: Number(f(s)) || 0 })) : []);
  return (
    <div className="tv-cols tv-top">
      <div className="tv-stack">
        <Card title="Nachrichten, letzte 30 Tage"><HBars rows={rows(msg, (s) => s.messages)} empty={emptyTop(snap)} /></Card>
        <Card title="Sprachstunden, letzte 30 Tage"><HBars rows={rows(voice, (s) => s.voice_hours)} format={(v) => `${num(v, 1)} Std.`} empty={emptyTop(snap)} /></Card>
      </div>
      <TopTable snap={snap} />
    </div>
  );
}

function TopTable({ snap }) {
  const t = topServers(snap, 30, 'messages', 8);
  if (!source(snap, 'serversTop30').available) return <Card title="Top-Server"><p className="cp-unavail">gerade nicht verfügbar</p></Card>;
  return (
    <Card title="Top-Server nach Nachrichten" right={`${t.withData ?? 0} Server mit Daten`}>
      {t.items.length === 0 && <p className="cp-empty">{emptyTop(snap)}</p>}
      <table className="cp-table">
        <thead><tr><th>Server</th><th className="num">Mitglieder</th><th className="num">Schreiber</th><th className="num">Beitritte</th><th className="num">Abgänge</th><th className="num">Tickets</th><th className="num">Bewerbungen</th><th className="num">Moderation</th></tr></thead>
        <tbody>{t.items.map((s, i) => (
          <tr key={s.id ?? s.name}><td>{i + 1}. {s.name}</td><td className="num">{num(s.member_count)}</td><td className="num">{num(s.active_chatters)}</td><td className="num">{num(s.joins)}</td><td className="num">{num(s.leaves)}</td><td className="num">{num(s.tickets?.total)}</td><td className="num">{num(s.applications?.total)}</td><td className="num">{num(s.moderation?.total)}</td></tr>
        ))}</tbody>
      </table>
    </Card>
  );
}

