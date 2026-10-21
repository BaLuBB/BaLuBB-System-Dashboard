import React from 'react';
import { createRoot } from 'react-dom/client';

// VITE_STATIC=1: GitHub-Pages-Build ohne Node-Server (verschlüsselter Snapshot), sonst das Dashboard mit Node-Server.
// Je Variante wird nur das passende Stylesheet geladen.
const load = import.meta.env.VITE_STATIC ? import('./StaticApp.jsx') : import('./App.jsx');
load.then(({ default: Root }) => createRoot(document.getElementById('root')).render(<Root />));
