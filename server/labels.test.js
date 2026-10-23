import test from 'node:test';
import assert from 'node:assert/strict';
import { actionLabel, serverName } from '../client/src/cockpit/labels.js';

test('Aktionsschlüssel werden zu lesbaren Namen', () => {
  assert.equal(actionLabel('guild_config'), 'Server-Einstellungen geändert');
  assert.equal(actionLabel('neue_unbekannte_aktion'), 'Neue unbekannte aktion');
  assert.equal(actionLabel('Panel erstellt'), 'Panel erstellt');
  assert.equal(actionLabel(null), '–');
});

test('Server ohne Namen bekommt einen erkennbaren Namen', () => {
  assert.equal(serverName({ name: 'SystemLabs', id: '1' }), 'SystemLabs');
  assert.equal(serverName({ name: null, id: '123456789' }), 'Unbenannter Server (Kennung …6789)');
  assert.equal(serverName({ name: '  ' }), 'Unbenannter Server');
});
