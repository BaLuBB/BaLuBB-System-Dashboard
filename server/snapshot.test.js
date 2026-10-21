import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptJson, decryptJson } from '../client/src/crypto.js';

test('Snapshot-Verschlüsselung: Roundtrip, Klartext nicht im Ciphertext', async () => {
  const data = { balubb: { data: { servers: { total: 10 } } }, geheim: 'Wartung-XY' };
  const payload = await encryptJson(data, 'ein-langes-passwort', 1000);
  assert.ok(!JSON.stringify(payload).includes('Wartung-XY'));
  assert.deepEqual(await decryptJson(payload, 'ein-langes-passwort'), data);
});

test('Snapshot-Verschlüsselung: falsches Passwort und Manipulation schlagen fehl', async () => {
  const payload = await encryptJson({ a: 1 }, 'richtig-richtig', 1000);
  await assert.rejects(decryptJson(payload, 'falsch-falsch-xx'));
  const tampered = { ...payload, ct: payload.ct.slice(0, -4) + 'AAAA' };
  await assert.rejects(decryptJson(tampered, 'richtig-richtig'));
});
