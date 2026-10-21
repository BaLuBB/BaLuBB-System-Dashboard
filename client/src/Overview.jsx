import React, { useEffect, useState } from 'react';
import { computeAlerts } from './alerts.js';
import { AgeNote, Banner, HistoryCard, KpiBar, Maintenance, RawData, SecurityCard, ServerBoard, TrafficCard, WebCard } from './sections.jsx';

/** Gemeinsame Übersicht für die GitHub-Pages-Seite. */
export default function Overview({ snap, onLogout, error }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);
  const alerts = computeAlerts(snap);
  const worst = alerts[0]?.level;
  return (
    <main>
      <header className="top">
        <div>
          <h1>BaLuBB Status</h1>
          <p className="muted"><AgeNote snap={snap} /> · aktualisiert sich automatisch</p>
        </div>
        <div className="right">
          <span className={`pill ${worst ?? 'ok'}`}>{worst === 'crit' ? 'Störung' : worst === 'warn' ? 'Auffälligkeiten' : 'Alles ok'}</span>
          {error && <div className="err small">{error}</div>}
          <button className="ghost" onClick={onLogout}>Abmelden</button>
        </div>
      </header>
      <Banner alerts={alerts} />
      <KpiBar snap={snap} />
      <div className="grid">
        <ServerBoard snap={snap} />
        <Maintenance snap={snap} />
        <HistoryCard snap={snap} />
        <TrafficCard snap={snap} />
        <SecurityCard snap={snap} />
        <WebCard snap={snap} />
        <RawData snap={snap} />
      </div>
    </main>
  );
}
