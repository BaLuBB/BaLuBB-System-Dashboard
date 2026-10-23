import test from 'node:test';
import assert from 'node:assert/strict';
import { slotStart, isBehind, SETTLE_MS, isOutdatedCode, isStuck, slotFileFor, SLOT_FILE_DELAY_MS } from '../client/src/slot.js';

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

test('Selbstheilung: neue Version erkennen, festhängende Seite neu laden, aber nie in einer Schleife', () => {
  assert.equal(isOutdatedCode('aaa', 'bbb'), true, 'anderer Code als beim Snapshot');
  assert.equal(isOutdatedCode('aaa', 'aaa'), false);
  assert.equal(isOutdatedCode('dev', 'bbb'), false, 'lokal ohne Kennung nie');
  assert.equal(isOutdatedCode('aaa', undefined), false, 'alter Snapshot ohne Kennung');
  const g = new Date(t('40:00')).toISOString();
  assert.equal(isStuck(g, t('45:00'), 2, 0), false, '5 Minuten ohne neuen Stand sind noch normal');
  assert.equal(isStuck(g, t('47:30'), 2, 0), true, 'über 6 Minuten ohne neuen Stand');
  assert.equal(isStuck(g, t('51:00'), 2, t('49:00')), false, 'gerade erst neu geladen: erst nach 3 Minuten wieder');
  assert.equal(isStuck(g, t('51:00'), 2, t('47:00')), true, 'nach 3 Minuten darf wieder neu geladen werden');
  assert.equal(isStuck('kaputt', t('51:00'), 2, 0), true);
});

test('Dateiname je Intervall: erst nach Bauen und Veröffentlichen, immer der gleiche Name innerhalb des Intervalls', () => {
  const slot = Date.parse('2026-10-23T18:56:00Z');
  assert.equal(slotFileFor(slot + SLOT_FILE_DELAY_MS, 2), `s/${slot}.json`, 'ab 100 s nach Intervallbeginn gilt die Datei dieses Intervalls');
  assert.equal(slotFileFor(slot + SLOT_FILE_DELAY_MS - 1000, 2), `s/${slot - 120000}.json`, 'davor noch die vom vorigen Intervall');
  assert.equal(slotFileFor(slot + 119000, 2), slotFileFor(slot + 101000, 2));
});
