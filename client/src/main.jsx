import React from 'react';
import { createRoot } from 'react-dom/client';

// Fehlerfall: statt weißer, stehender Seite zeigt die Anzeige kurz einen Hinweis und startet sich selbst neu (mit neuer Kennung gegen alte Zwischenspeicher, höchstens alle 30 s)
function restartSoon() {
  setTimeout(() => {
    try {
      const last = Number(sessionStorage.getItem('balubb-crash') ?? 0);
      if (Date.now() - last < 30_000) return restartSoon();
      sessionStorage.setItem('balubb-crash', String(Date.now()));
    } catch { /* ohne Speicher: trotzdem neu starten */ }
    const url = new URL(window.location.href);
    url.searchParams.set('v', `c${Date.now().toString(36)}`);
    window.location.replace(url.href);
  }, 15_000);
}

class Boundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { restartSoon(); }
  render() {
    return this.state.failed
      ? <div style={{ padding: 40, font: '24px system-ui, sans-serif', color: '#eff2f5' }}>BaLuBB System · Anzeige startet gleich neu …</div>
      : this.props.children;
  }
}

// VITE_STATIC=1: GitHub-Pages-Build ohne Node-Server (verschlüsselter Snapshot), sonst das Dashboard mit Node-Server.
// Je Variante wird nur das passende Stylesheet geladen.
const load = import.meta.env.VITE_STATIC ? import('./StaticApp.jsx') : import('./App.jsx');
load
  .then(({ default: Root }) => {
    createRoot(document.getElementById('root')).render(<Boundary><Root /></Boundary>);
    window.__balubbUp = true;
  })
  .catch(() => { /* Skript nicht ladbar: der Notfall-Wächter in der Seite lädt neu */ });
