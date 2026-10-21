import { useEffect, useRef, useState } from 'react';

const HISTORY = 60;
const token = new URLSearchParams(location.search).get('token') ?? sessionStorage.getItem('token') ?? '';
if (token) sessionStorage.setItem('token', token);

const get = async (url) => {
  const res = await fetch(url, { headers: token ? { 'x-dashboard-token': token } : {} });
  if (!res.ok) throw new Error(res.status === 401 ? 'Token fehlt oder falsch (?token=… anhängen)' : `Fehler ${res.status}`);
  return res.json();
};

/** Pollt /api/stats und hält einen Verlauf (letzte ~2 Minuten) für die Diagramme. */
export function useStats() {
  const [state, setState] = useState({ info: null, stats: null, history: [], error: null });
  const history = useRef([]);

  useEffect(() => {
    let alive = true, timer;
    const loop = async () => {
      try {
        const [stats, info] = await Promise.all([get('/api/stats'), get('/api/info')]);
        if (!alive) return;
        history.current = [...history.current, {
          cpu: stats.cpu.percent ?? 0,
          mem: stats.memory ? (stats.memory.used / stats.memory.total) * 100 : 0,
          rx: stats.network.reduce((a, n) => a + n.rxBps, 0),
          tx: stats.network.reduce((a, n) => a + n.txBps, 0),
        }].slice(-HISTORY);
        setState({ info, stats, history: history.current, error: null });
        timer = setTimeout(loop, stats.intervalMs ?? 2000);
      } catch (e) {
        if (!alive) return;
        setState((s) => ({ ...s, error: e.message }));
        timer = setTimeout(loop, 5000);
      }
    };
    loop();
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  return state;
}
