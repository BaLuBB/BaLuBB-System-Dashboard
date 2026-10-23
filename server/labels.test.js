import test from 'node:test';
import assert from 'node:assert/strict';
import { actionLabel, countryLabel, humanKey, pathLabel, serverName } from '../client/src/cockpit/labels.js';

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

test('Länder, Seitenpfade und Cloudflare-Schlüssel in Worten', () => {
  assert.equal(countryLabel('DE'), 'Deutschland');
  assert.equal(countryLabel('US'), 'Vereinigte Staaten');
  assert.equal(countryLabel('T1'), 'Tor-Netzwerk');
  assert.equal(countryLabel('XX'), 'Unbekanntes Land');
  assert.equal(countryLabel(null), 'Unbekanntes Land');
  assert.equal(pathLabel('/'), 'Startseite');
  assert.equal(pathLabel('/api/ext/v1/servers/top'), 'Schnittstelle: Top-Server');
  assert.equal(pathLabel('/discopanel.v1.ServerService/GetServer'), 'Panel: Server abrufen');
  assert.equal(pathLabel('/workflow/ecMtBEbUm285UGuj'), 'Ablauf bearbeiten (n8n)');
  assert.equal(pathLabel('/servers/2fccd99c-ca9a-4146-bc14-3e15ec1f435a'), 'Server-Detailseite');
  assert.equal(pathLabel('/api/ext/v1/neu/2fccd99c-ca9a-4146-bc14-3e15ec1f435a'), 'Schnittstelle: neu / …');
  assert.equal(pathLabel('/panel/x/1234567'), '/panel/x/…');
  assert.equal(humanKey('hot.ban.unknown'), 'Hot ban unknown');
  assert.equal(humanKey(''), '–');
});
