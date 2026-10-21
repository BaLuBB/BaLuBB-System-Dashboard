import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import StaticApp from './StaticApp.jsx';
import './styles.css';

// VITE_STATIC=1: GitHub-Pages-Build ohne Node-Server (verschlüsselter Snapshot)
const Root = import.meta.env.VITE_STATIC ? StaticApp : App;
createRoot(document.getElementById('root')).render(<Root />);
