import { useEffect, useState } from 'react';

const token = sessionStorage.getItem('token') ?? '';

/** Holt die Cloudflare-Analytics (Server cached 5 min, daher reicht ein langsames Polling). */
export function useCloudflare(intervalMs = 300000) {
  const [state, setState] = useState(null);
  useEffect(() => {
    let alive = true, timer;
    const loop = async () => {
      try {
        const res = await fetch('/api/cloudflare', { headers: token ? { 'x-dashboard-token': token } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (alive) setState(await res.json());
      } catch (e) {
        if (alive) setState({ configured: true, error: e.message });
      }
      if (alive) timer = setTimeout(loop, intervalMs);
    };
    loop();
    return () => { alive = false; clearTimeout(timer); };
  }, [intervalMs]);
  return state;
}
