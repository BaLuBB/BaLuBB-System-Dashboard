import test from 'node:test';
import assert from 'node:assert/strict';
import { readOptions, tvLink } from '../client/src/tvmode.js';

test('TV-Optionen: Standardwerte und Parameter', () => {
  assert.deepEqual(readOptions(''), { tv: false, pw: '', slideSec: 20, theme: 'dark' });
  assert.deepEqual(readOptions('#tv&pw=abc&slide=30&theme=light'), { tv: true, pw: 'abc', slideSec: 30, theme: 'light' });
  assert.equal(readOptions('#tv&slide=1').slideSec, 20, 'zu kurze Wechselzeit wird ignoriert');
});

test('TV-Link: Sonderzeichen im Passwort überstehen Kodierung und Parsing', () => {
  const pw = 'a+b&c#d %e=f/ä';
  const link = tvLink(pw, 'https://x.example/app/');
  assert.equal(readOptions(link.slice(link.indexOf('#'))).pw, pw);
  assert.ok(link.startsWith('https://x.example/app/#tv&pw='));
});
