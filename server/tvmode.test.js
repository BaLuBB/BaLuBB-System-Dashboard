import test from 'node:test';
import assert from 'node:assert/strict';
import { readOptions, tvLink, siteRoot } from '../client/src/tvmode.js';

test('TV-Optionen: Standardwerte und Parameter', () => {
  assert.deepEqual(readOptions('', '/Repo/tv/'), { cockpit: false, tv: true, explicitTv: true, pw: '', slideSec: 20, theme: 'dark' });
  assert.deepEqual(readOptions('#pw=abc&slide=30&theme=light', '/Repo/tv'), { cockpit: false, tv: true, explicitTv: true, pw: 'abc', slideSec: 30, theme: 'light' });
  assert.deepEqual([readOptions('#cockpit', '/Repo/tv/').cockpit, readOptions('#cockpit', '/Repo/tv/').tv], [true, false]);
  assert.deepEqual([readOptions('', '/Repo/').cockpit, readOptions('', '/Repo/').tv], [true, false], 'Startseite zeigt das Cockpit');
  assert.equal(readOptions('#tv', '/Repo/').tv, true, '#tv an der Startseite öffnet die Diashow');
  assert.equal(readOptions('#tv&slide=1', '/').slideSec, 20, 'zu kurze Wechselzeit wird ignoriert');
});

test('TV-Link: Sonderzeichen im Passwort überstehen Kodierung und Parsing', () => {
  const pw = 'a+b&c#d %e=f/ä';
  const link = tvLink(pw, 'https://x.example/app/');
  assert.equal(readOptions(link.slice(link.indexOf('#'))).pw, pw);
  assert.ok(link.startsWith('https://x.example/app/tv#pw='));
});

test('TV-Link: einfaches Passwort ergibt die kürzeste, tippbare Form', () => {
  const link = tvLink('Mein-langes.Passwort_2026', 'https://x.example/app/');
  assert.equal(link, 'https://x.example/app/tv#Mein-langes.Passwort_2026');
  assert.equal(readOptions('#Mein-langes.Passwort_2026').pw, 'Mein-langes.Passwort_2026');
  assert.equal(readOptions('#Mein-langes.Passwort_2026', '/Repo/tv/').tv, true);
});

test('TV-Link: Schlüsselwörter sind kein Passwort, Kurzform lässt sich mit Optionen mischen', () => {
  assert.equal(readOptions('#cockpit').pw, '');
  assert.equal(readOptions('#tv').pw, '');
  assert.equal(readOptions('#tv&geheim-wort').pw, 'geheim-wort');
  assert.equal(readOptions('#pw=eins&zwei').pw, 'eins', 'pw= gewinnt');
  assert.equal(readOptions('#geheim&slide=30').slideSec, 30);
});

test('Wurzel der Seite: aus /tv, /tv/ und der Startseite', () => {
  for (const p of ['/BaLuBB-System-Dashboard/', '/BaLuBB-System-Dashboard', '/BaLuBB-System-Dashboard/tv', '/BaLuBB-System-Dashboard/tv/']) assert.equal(siteRoot(p), '/BaLuBB-System-Dashboard/', p);
  assert.equal(siteRoot('/'), '/');
  assert.equal(siteRoot('/tv'), '/');
});
