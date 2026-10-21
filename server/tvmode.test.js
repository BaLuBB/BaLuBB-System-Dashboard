import test from 'node:test';
import assert from 'node:assert/strict';
import { readOptions, tvLink } from '../client/src/tvmode.js';

test('TV-Optionen: Standardwerte und Parameter', () => {
  assert.deepEqual(readOptions(''), { cockpit: false, tv: true, explicitTv: false, pw: '', slideSec: 20, theme: 'dark' });
  assert.deepEqual(readOptions('#tv&pw=abc&slide=30&theme=light'), { cockpit: false, tv: true, explicitTv: true, pw: 'abc', slideSec: 30, theme: 'light' });
  assert.deepEqual([readOptions('#cockpit').cockpit, readOptions('#cockpit').tv], [true, false]);
  assert.equal(readOptions('#tv&slide=1').slideSec, 20, 'zu kurze Wechselzeit wird ignoriert');
});

test('TV-Link: Sonderzeichen im Passwort überstehen Kodierung und Parsing', () => {
  const pw = 'a+b&c#d %e=f/ä';
  const link = tvLink(pw, 'https://x.example/app/');
  assert.equal(readOptions(link.slice(link.indexOf('#'))).pw, pw);
  assert.ok(link.startsWith('https://x.example/app/#pw='));
});

test('TV-Link: einfaches Passwort ergibt die kürzeste, tippbare Form', () => {
  const link = tvLink('Mein-langes.Passwort_2026', 'https://x.example/app/');
  assert.equal(link, 'https://x.example/app/#Mein-langes.Passwort_2026');
  assert.equal(readOptions('#Mein-langes.Passwort_2026').pw, 'Mein-langes.Passwort_2026');
  assert.equal(readOptions('#Mein-langes.Passwort_2026').tv, true);
});

test('TV-Link: Schlüsselwörter sind kein Passwort, Kurzform lässt sich mit Optionen mischen', () => {
  assert.equal(readOptions('#cockpit').pw, '');
  assert.equal(readOptions('#tv').pw, '');
  assert.equal(readOptions('#tv&geheim-wort').pw, 'geheim-wort');
  assert.equal(readOptions('#pw=eins&zwei').pw, 'eins', 'pw= gewinnt');
  assert.equal(readOptions('#geheim&slide=30').slideSec, 30);
});
