import test from 'node:test';
import assert from 'node:assert/strict';
import { slotStart, isBehind, SETTLE_MS } from '../client/src/slot.js';

const t = (s) => Date.parse(`2026-10-22T21:${s}Z`);

test('Raster: Stand ist immer der Beginn des 2-Minuten-Intervalls (gerade Minute)', () => {
  assert.equal(slotStart(t('45:10'), 2), t('44:00'));
  assert.equal(slotStart(t('46:59'), 2), t('46:00'));
  assert.equal(new Date(slotStart(t('51:30'), 2)).getUTCMinutes() % 2, 0);
  assert.equal(slotStart(t('47:30'), 5), t('45:00'));
});

test('Abruf: erst nach der Wartezeit ist ein neuer Stand fällig, davor nicht', () => {
  const g = new Date(t('46:00')).toISOString();
  assert.equal(isBehind(g, t('48:30'), 2), false, 'um 21:48:30 kann der Stand 21:48 noch nicht da sein');
  assert.equal(isBehind(g, t('49:30'), 2), true, 'um 21:49:30 müsste der Stand 21:48 da sein');
  assert.equal(isBehind(new Date(t('48:00')).toISOString(), t('49:30'), 2), false);
  assert.equal(isBehind('kaputt', t('48:30'), 2), true);
  assert.ok(SETTLE_MS < 120_000);
});
