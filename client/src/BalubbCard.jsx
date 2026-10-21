import React from 'react';
import { Card, Table } from './components.jsx';
import { useBalubb } from './useBalubb.js';

const STATE = {
  running: ['🟢', 'läuft'],
  starting: ['🟡', 'startet'],
  offline: ['🔴', 'offline'],
};
const stateOf = (s) => STATE[s] ?? ['⚪', s];
const fmt = (iso) => new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });

export default function BalubbCard() {
  const b = useBalubb();
  if (!b || b.configured === false) return null; // ohne BALUBB_API_KEY keine Kachel

  if (b.error) {
    return <Card title="BaLuBB-Server" wide><p className="err">{b.error}</p></Card>;
  }

  const { data } = b;
  const { servers, dashboard, maintenance = [] } = data;
  const sorted = [...servers.items].sort((a, c) => a.state.localeCompare(c.state));

  return (
    <Card title="BaLuBB-Server" wide
      right={`${servers.running} von ${servers.total} laufen · Release ${dashboard.release.version}`}>
      <Table head={['Server', 'Status']}
        rows={sorted.map((s) => { const [dot, label] = stateOf(s.state); return [s.name, `${dot} ${label}`]; })} />
      {maintenance.map((m) => (
        <div key={m.title} className="maint">
          <strong>🛠 {m.title}</strong> <span className="muted">({m.state}, {fmt(m.startsAt)} – {fmt(m.endsAt)})</span>
          <p className="muted">{m.description}</p>
        </div>
      ))}
    </Card>
  );
}
