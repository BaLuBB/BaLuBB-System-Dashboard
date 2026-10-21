import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  root: 'client',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Zweite Einstiegsseite unter /tv: dieselbe Diashow, die Adresse lässt sich am Fernseher kurz eintippen
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'client/index.html'), tv: resolve(import.meta.dirname, 'client/tv/index.html') } },
  },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:3000' } },
});
