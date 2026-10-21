import React from 'react';
import { Card, Spark, Stat, Table } from './components.jsx';
import { useCloudflare } from './useCloudflare.js';
import { bytes, pct } from './format.js';

const num = (n) => n.toLocaleString('de-DE');
const KLASS = { '2xx': '🟢 2xx Erfolg', '3xx': '🔵 3xx Weiterleitung', '4xx': '🟠 4xx Client-Fehler (z. B. 403)', '5xx': '🔴 5xx Server-Fehler' };

export default function CloudflareCard() {
  const c = useCloudflare();
  if (!c || c.configured === false) return null; // ohne Token/Zone keine Kachel
  if (c.error) return <Card title="Cloudflare" wide><p className="err">{c.error}</p></Card>;

  const { data } = c;
  const { totals } = data;
  return (
    <Card title="Cloudflare-Analytics" wide right={`letzte ${data.days.length} Tage`}>
      <div className="stats">
        <Stat label="Anfragen" value={num(totals.requests)} />
        <Stat label="Datenvolumen" value={bytes(totals.bytes)} />
        <Stat label="Cache-Quote" value={pct(totals.cacheRate)} />
        <Stat label="Bedrohungen" value={num(totals.threats)} />
        <Stat label="Seitenaufrufe" value={num(totals.pageViews)} />
      </div>
      <Spark data={data.days.map((d) => d.requests)} max={null} />
      <p className="muted">Anfragen pro Tag: {data.days.map((d) => `${d.date.slice(5)}: ${num(d.requests)}`).join(' · ')}</p>
      <div className="two">
        <Table head={['Antwortcode', 'Anfragen']} rows={data.status.map((s) => [KLASS[s.klass] ?? s.klass, num(s.requests)])} />
        <Table head={['Land', 'Anfragen']} rows={data.countries.map((x) => [x.country, num(x.requests)])} />
      </div>
    </Card>
  );
}
