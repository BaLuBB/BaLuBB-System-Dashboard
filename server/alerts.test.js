import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAlerts } from '../client/src/alerts.js';

const NOW = Date.UTC(2026, 9, 21, 12, 0, 0);
const snap = (over = {}) => ({
  generatedAt: new Date(NOW - 60_000).toISOString(), intervalMin: 5,
  balubb: { configured: true, data: { ok: true, dashboard: { ok: true }, servers: { items: [{ name: 'A', state: 'running' }] }, maintenance: [] } },
  cloudflare: { configured: true, data: { totals: { requests: 1000 }, status: [{ klass: '2xx', requests: 990 }] } },
  ...over,
});

test('Alerts: gesunder Zustand ergibt keine Warnung', () => {
  assert.deepEqual(computeAlerts(snap(), NOW), []);
});

test('Alerts: offline, startet, veraltet, 5xx, Wartung, sortiert nach Schwere', () => {
  const s = snap({
    generatedAt: new Date(NOW - 30 * 60_000).toISOString(),
    balubb: { configured: true, data: { ok: false, servers: { items: [{ name: 'A', state: 'offline' }, { name: 'B', state: 'starting' }] },
      maintenance: [{ title: 'W1', startsAt: new Date(NOW - 1000).toISOString(), endsAt: new Date(NOW + 3600_000).toISOString() },
                    { title: 'W2', startsAt: new Date(NOW + 3600_000).toISOString(), endsAt: new Date(NOW + 7200_000).toISOString() },
                    { title: 'W3', startsAt: new Date(NOW + 3 * 86400_000).toISOString(), endsAt: new Date(NOW + 4 * 86400_000).toISOString() }] } },
    cloudflare: { configured: true, data: { totals: { requests: 1000 }, status: [{ klass: '5xx', requests: 50 }] } },
  });
  const a = computeAlerts(s, NOW);
  assert.equal(a[0].level, 'crit');
  const text = a.map((x) => x.text).join('\n');
  for (const part of ['veraltet', 'offline: A', 'Startet gerade: B', 'Wartung läuft: W1', 'Wartung geplant: W2', '5.0 %']) assert.ok(text.includes(part), part);
  assert.ok(!text.includes('W3'), 'Wartung in 3 Tagen noch nicht melden');
  assert.deepEqual(a.map((x) => x.level), [...a.map((x) => x.level)].sort((p, q) => ({ crit: 0, warn: 1, info: 2 })[p] - ({ crit: 0, warn: 1, info: 2 })[q]));
});

test('Alerts: API-Fehler und nicht konfigurierte Quellen', () => {
  const a = computeAlerts(snap({ balubb: { configured: true, error: 'HTTP 403' }, cloudflare: { configured: false } }), NOW);
  assert.equal(a.length, 1);
  assert.equal(a[0].level, 'crit');
});
