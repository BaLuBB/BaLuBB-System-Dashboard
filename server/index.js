import express from 'express';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { collect, staticInfo } from './collector.js';

const PORT = Number(process.env.PORT ?? 3000);
// Standard: nur lokal. Für Kollegen im Netz: HOST=0.0.0.0 (und TOKEN setzen!)
const HOST = process.env.HOST ?? '127.0.0.1';
const TOKEN = process.env.TOKEN ?? '';
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 2000);

const tokenOk = (given = '') => {
  const a = Buffer.from(String(given));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
};

export function createApp({ sample = collect, info = staticInfo } = {}) {
  const app = express();
  let latest = null;
  let infoCache = null;
  let failed = null;

  // Ein Hintergrund-Sampler bedient alle Clients – egal wie viele Browser offen sind.
  const tick = async () => {
    try {
      latest = await sample();
      failed = null;
    } catch (err) {
      failed = err.message;
    }
  };
  app.locals.start = async () => {
    infoCache = await info();
    await tick();
    app.locals.timer = setInterval(tick, INTERVAL_MS);
  };
  app.locals.stop = () => clearInterval(app.locals.timer);

  app.use('/api', (req, res, next) => {
    if (!TOKEN) return next();
    const given = req.get('x-dashboard-token') ?? req.query.token;
    return tokenOk(given) ? next() : res.status(401).json({ error: 'Token fehlt oder falsch' });
  });

  app.get('/api/info', (_req, res) => res.json(infoCache ?? {}));
  app.get('/api/stats', (_req, res) => {
    if (!latest) return res.status(503).json({ error: failed ?? 'Noch keine Messung' });
    res.json({ ...latest, intervalMs: INTERVAL_MS, stale: Boolean(failed) });
  });

  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html'), (e) => e && res.status(404).send('Frontend nicht gebaut: npm run build')));
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp();
  await app.locals.start();
  app.listen(PORT, HOST, () => {
    console.log(`Dashboard läuft auf http://${HOST}:${PORT}`);
    if (HOST !== '127.0.0.1' && !TOKEN) {
      console.warn('WARNUNG: Netzwerkzugriff ohne TOKEN – jeder im Netz sieht deine Systemdaten.');
    }
  });
}
