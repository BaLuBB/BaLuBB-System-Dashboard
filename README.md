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
| `BALUBB_API_KEY` | – | Key für die BaLuBB-API (aktiviert die Server-Kachel) |
| `BALUBB_API_URL` | `https://bot.balubb.de/api/ext/v1/health` | Health-Endpunkt |
| `BALUBB_TTL_MS` | `30000` | Cache-Dauer der API-Antwort |

## BaLuBB-Serverstatus (optional)

Mit gesetztem API-Key zeigt das Dashboard zusätzlich eine Kachel mit den BaLuBB-Servern,
dem Release und geplanten Wartungen (Quelle: `https://bot.balubb.de/api/ext/v1/health`).

```bash
BALUBB_API_KEY=dein-key npm start
```

Der Key bleibt auf dem Server und gelangt nie ins Frontend. Die Antwort wird 30 s gecacht
(`BALUBB_TTL_MS`), die API erlaubt 60 Anfragen pro Minute. Ohne Key erscheint keine Kachel.
Der Server, auf dem das Dashboard läuft, muss bei Cloudflare für `/api/ext/` von der
Managed Challenge ausgenommen sein, sonst antwortet die API mit 403.

Das Dashboard zeigt immer das System, auf dem der Server läuft. Für mehrere Rechner
den Server auf jedem Rechner starten.
