# BaLuBB System-Dashboard

Live-Dashboard für Systemdaten im Browser – für dich und deine Kollegen.
Node.js (Express + [systeminformation](https://systeminformation.io)) liefert die Daten, React zeigt sie an.

**Angezeigt werden:** CPU (gesamt, pro Kern, Takt, Temperatur), RAM/Swap, Festplatten + I/O,
Netzwerk (pro Interface, Live-Rate), Top-Prozesse nach CPU und RAM, GPU, Akku, angemeldete Nutzer, Uptime.
Verläufe der letzten ~2 Minuten werden als Diagramme gezeigt.

## Start

```bash
npm install
npm run build
npm start            # http://127.0.0.1:3000
```

Entwicklung mit Hot-Reload: `npm run dev` (Frontend auf http://localhost:5173).
Tests: `npm test`.

## Für Kollegen freigeben

Standardmäßig ist das Dashboard **nur lokal** erreichbar. Für Zugriff im Netzwerk:

```bash
HOST=0.0.0.0 TOKEN=ein-geheimes-passwort npm start
```

Kollegen öffnen dann `http://<deine-ip>:3000/?token=ein-geheimes-passwort`.
Ohne `TOKEN` kann jeder im Netz deine Systemdaten sehen – bitte immer setzen.
Die Verbindung ist unverschlüsselt (HTTP); nur im vertrauenswürdigen Netz oder hinter einem Reverse-Proxy mit HTTPS nutzen.

| Variable | Standard | Bedeutung |
|---|---|---|
| `PORT` | `3000` | Port |
| `HOST` | `127.0.0.1` | Bind-Adresse (`0.0.0.0` = alle) |
| `TOKEN` | – | Zugriffstoken für die API |
| `INTERVAL_MS` | `2000` | Messintervall |

Das Dashboard zeigt immer das System, auf dem der Server läuft. Für mehrere Rechner
den Server auf jedem Rechner starten.
