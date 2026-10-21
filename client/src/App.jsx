import React from 'react';
import { useStats } from './useStats.js';
import { Bar, Card, Spark, Stat, Table } from './components.jsx';
import BalubbCard from './BalubbCard.jsx';
import CloudflareCard from './CloudflareCard.jsx';
import { bytes, duration, pct, rate } from './format.js';

export default function App() {
  const { info, stats, history, error } = useStats();

  if (!stats) {
    return <main className="center">{error ? <p className="err">{error}</p> : <p className="muted">Lade Systemdaten …</p>}</main>;
  }

  const { cpu, memory, disks, network, processes, gpus, battery, users, diskIo } = stats;
  const memPct = memory ? (memory.used / memory.total) * 100 : null;
  const swapPct = memory?.swapTotal ? (memory.swapUsed / memory.swapTotal) * 100 : null;
  const procRow = (p) => [p.pid, p.name, p.user, pct(p.cpu), pct(p.mem)];
  const procHead = ['PID', 'Name', 'User', 'CPU', 'RAM'];

  return (
    <main>
      <header className="top">
        <div>
          <h1>{info?.hostname ?? 'System'}</h1>
          <p className="muted">{[info?.os, info?.model, info?.cpu].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="right">
          <div><span className={`dot ${error || stats.stale ? 'crit' : 'ok'}`} />{error ?? (stats.stale ? 'Messung hängt' : 'Live')}</div>
          <div className="muted">Uptime {duration(stats.uptime)}</div>
        </div>
      </header>

      <div className="grid">
        <Card title="CPU" right={`${info?.physicalCores ?? '?'} Kerne / ${info?.cores ?? '?'} Threads`}>
          <div className="stats">
            <Stat label="Auslastung" value={pct(cpu.percent)} />
            <Stat label="Takt" value={cpu.avgGhz ? `${cpu.avgGhz.toFixed(2)} GHz` : '–'} />
            <Stat label="Temperatur" value={cpu.tempC ? `${cpu.tempC.toFixed(0)} °C` : '–'} />
          </div>
          <Spark data={history.map((h) => h.cpu)} />
          <div className="cores">
            {cpu.perCore.map((c, i) => <div key={i} title={`Kern ${i}: ${pct(c)}`}><Bar value={c} /></div>)}
          </div>
        </Card>

        <Card title="Arbeitsspeicher" right={memory && `${bytes(memory.used)} / ${bytes(memory.total)}`}>
          <Bar value={memPct} label={pct(memPct)} />
          <Spark data={history.map((h) => h.mem)} color="var(--accent2)" />
          {swapPct != null && <><p className="muted">Swap {bytes(memory.swapUsed)} / {bytes(memory.swapTotal)}</p><Bar value={swapPct} /></>}
        </Card>

        <Card title="Netzwerk" right={`↓ ${rate(history.at(-1)?.rx)}  ↑ ${rate(history.at(-1)?.tx)}`}>
          <Spark data={history.map((h) => h.rx)} max={null} color="var(--accent2)" />
          <Spark data={history.map((h) => h.tx)} max={null} />
          <Table head={['Interface', 'IP', '↓', '↑', 'Gesamt ↓/↑']}
            rows={network.map((n) => [`${n.up ? '🟢' : '⚪'} ${n.iface}`, n.ips[0] ?? '–', rate(n.rxBps), rate(n.txBps), `${bytes(n.rxTotal)} / ${bytes(n.txTotal)}`])} />
        </Card>

        <Card title="Festplatten" right={diskIo && `Lesen ${rate(diskIo.readBps)} · Schreiben ${rate(diskIo.writeBps)}`}>
          {disks.map((d) => (
            <div key={d.mount} className="disk">
              <div className="row"><strong>{d.mount}</strong><span className="muted">{d.fs} · {d.type} · {bytes(d.used)} / {bytes(d.size)}</span></div>
              <Bar value={d.percent} label={pct(d.percent)} />
            </div>
          ))}
        </Card>

        {gpus.length > 0 && (
          <Card title="Grafik">
            {gpus.map((g, i) => (
              <div key={i}>
                <strong>{g.name}</strong>
                <div className="stats">
                  <Stat label="Auslastung" value={pct(g.util)} />
                  <Stat label="VRAM" value={g.memTotalMb ? `${g.memUsedMb ?? '–'} / ${g.memTotalMb} MB` : '–'} />
                  <Stat label="Temp" value={g.tempC ? `${g.tempC} °C` : '–'} />
                </div>
              </div>
            ))}
          </Card>
        )}

        {battery && (
          <Card title="Akku">
            <Bar value={battery.percent} label={`${battery.percent} % ${battery.charging ? '(lädt)' : ''}`} />
          </Card>
        )}

        <BalubbCard />
        <CloudflareCard />

        <Card title="Top Prozesse (CPU)" wide right={`${processes.total} gesamt · ${processes.running} aktiv`}>
          <Table head={procHead} rows={processes.topCpu.map(procRow)} />
        </Card>
        <Card title="Top Prozesse (RAM)" wide>
          <Table head={procHead} rows={processes.topMem.map(procRow)} />
        </Card>

        {users.length > 0 && (
          <Card title="Angemeldete Nutzer" wide>
            <Table head={['User', 'Terminal', 'Herkunft', 'Seit']} rows={users.map((u) => [u.user, u.tty, u.ip || 'lokal', u.since])} />
          </Card>
        )}
      </div>
    </main>
  );
}
