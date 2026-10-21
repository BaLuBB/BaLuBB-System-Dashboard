# BaLuBB System-Dashboard

Betriebs-Cockpit für das BaLuBB-Team: ein Blick genügt, ob alles läuft und ob etwas zu tun ist.
Zwei Varianten, beide Node.js + React:

1. **Status-Seite auf GitHub Pages** (Hauptvariante): passwortgeschützt, für Handy, Desktop und Fernseher.
2. **Node-Server auf dem eigenen Rechner**: Live-Systemdaten (CPU, RAM, Festplatten, Prozesse).

---

## 1. Status-Seite auf GitHub Pages

URL: https://balubb.github.io/BaLuBB-System-Dashboard/

Ein Workflow (`.github/workflows/pages.yml`, alle 5 Minuten, bei Push auf `main` und manuell) holt alle
freigegebenen Endpunkte der BaLuBB-API und die Cloudflare-Analysen, **verschlüsselt** sie mit `DASHBOARD_PASSWORD`
(PBKDF2 + AES-256-GCM) und veröffentlicht nur den verschlüsselten Block. Die Seite fragt nach dem Passwort und
entschlüsselt im Browser. Ohne Passwort wird nichts veröffentlicht (der Build bricht ab).

### Aufbau der Seite (von oben nach unten)

Kopfzeile (Zeitraum 7/30/90 Tage, Hell/Dunkel, Diashow-Link) · **Zu erledigen** (neue Server zum Aktivieren, neues Feedback,
offene Custom-Bot-Anfragen) · **Gesamtzustand** mit Server-Liste (Zustand, Laufzeit, CPU, Speicher, Platte) ·
**Wartungen** mit Countdown · **Gesamtlage** aller Server · **Top-Server** (3 bis 10, Rangfolge wählbar, Zeilen aufklappbar) ·
**Abläufe** · **Tickets, Bewerbungen, Moderation** · **System** · **Aktivität im Dashboard** · **Versionen** · **Cloudflare**
(Verkehr, Antwortcodes, Fehlerrate, Cache, Sicherheit, Länder, Top-Pfade, API-Aufrufe, Besucher) · Fußzeile mit dem Zustand jeder Quelle.

Zustände: Laden (Platzhalter), leer (erklärender Satz), Fehler je Quelle getrennt („gerade nicht verfügbar“),
veraltet bei Daten über 15 Minuten. Handy zuerst, Tippflächen ab 44 px, Kontrast mindestens 4,5:1, Tastatur-Fokus sichtbar,
weniger Bewegung bei entsprechender Einstellung. Farbe nur für Zustände (grün läuft, gelb Warnung, rot Fehler,
violett Wartung), nie allein, immer mit Symbol und Text. Schriften (Inter, Space Grotesk, IBM Plex Mono) sind lokal gebündelt.

### Fernseher: Diashow ohne Bedienung

Die Startseite ist eine **Diashow**: eine Bildschirmseite, die alle 20 Sekunden zur nächsten Kategorie wechselt. Unten steht die
Kategorie-Leiste (Überblick, Server, Aktivität, Top-Server, Abläufe, Support, Cloudflare, System, Dashboard) mit Fortschrittsbalken;
Kategorien mit Auffälligkeiten tragen ein Symbol. Es gibt nichts zu bedienen.

**Der kürzeste Link (zum Eintippen mit der Fernbedienung):**

```
balubb.github.io/BaLuBB-System-Dashboard
```

Beim ersten Mal erscheint ein großes Passwortfeld. Passwort tippen, Enter. Danach **merkt sich der Fernseher das Passwort im Browser-Speicher**
(localStorage) und startet die Diashow künftig von selbst. Wer das Passwort nicht tippen möchte, hängt es an: `…/tv#passwort`
(Buchstaben, Ziffern, `-`, `_`, `.`; bei anderen Zeichen erzeugt der Knopf **Diashow-Link** im Cockpit den kodierten Link `…/tv#pw=…`).
Auch `#tv&pw=…` aus früheren Links funktioniert weiter.

Die Diashow meldet sich selbst an, passt sich jeder Bildschirmgröße an (feste 1920×1080-Bühne, skaliert), hält den Bildschirm wach
(wo der Browser es erlaubt), lädt sich alle 6 Stunden neu und zeigt bei Verbindungsproblemen die letzten
Daten mit Hinweis. Optionen im Link: `slide=30` (Sekunden je Kategorie, mindestens 3), `theme=light`.
Wird das Passwort geändert, den Link einmal mit dem neuen Passwort öffnen. Auf gemeinsam genutzten Rechnern beim Anmelden
„Auf diesem Gerät angemeldet bleiben“ abwählen.

**Interaktives Cockpit** (Handy, Desktop): `…/#cockpit` mit Zeitraum 7/30/90 Tage, Hell/Dunkel, aufklappbaren Zeilen; „Abmelden“ löscht das gespeicherte Passwort.

### Einrichtung

1. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
2. *Settings → Secrets and variables → Actions → New repository secret:*
   `DASHBOARD_PASSWORD` (mindestens 12 Zeichen, besser eine lange Passphrase), `BALUBB_API_KEY`,
   `CLOUDFLARE_API_TOKEN` (*Zone → Analytics → Lesen*), `CLOUDFLARE_ZONE_ID`. Die Account-ID für Web-Analytics wird aus der Zone gelesen.
3. *Actions → Status-Seite (GitHub Pages) → Run workflow*.
4. Bei Cloudflare muss `/api/ext/` von der Managed Challenge ausgenommen sein (WAF → Custom rules → Skip), sonst antwortet die API mit 403.

### Datenquellen (BaLuBB-API, `/api/ext/v1/…`, nur lesend)

`health`, `overview`, `servers`, `servers/top?n=10&days=7|30|90`, `maintenance`, `activations`, `feedback`, `custom-bot-requests`,
`automations`, `automations/history` (höchstens 7 Tage, „unvollständig“: n8n liefert höchstens 2000 Läufe), `tickets`, `applications`,
`moderation`, `stats/global`, `dashboard-activity` (nur die letzten 500 Einträge), `system`, `counts`, `releases?full=1`.
Je Quelle gibt es Rückfallpfade; fällt eine aus, zeigt nur ihr Bereich „gerade nicht verfügbar“. Die API liefert nur Summen,
keine Nutzernamen, IDs oder Nachrichten.

### Namensfilter

Angezeigt werden nur Dienste, Abläufe und Top-Server, deren **Name „BaLuBB“ oder „Bot“ enthält** (ohne Beachtung der
Groß-/Kleinschreibung, als Teilwort: „Botschaft“ würde ebenfalls passen). Der Filter wirkt schon beim Erzeugen des Snapshots, die
anderen Namen werden also gar nicht erst veröffentlicht (auch nicht verschlüsselt). Summen über alle Server (Gesamtlage,
Tickets, Bewerbungen, Moderation, Dashboard-Aktivität, Cloudflare) lassen sich nicht nach Namen aufteilen und bleiben unverändert;
die Ablauf-Zahlen „Läufe/Fehler“ der API zählen alle Abläufe und sind entsprechend gekennzeichnet. Ändern: *Settings → Secrets and
variables → Actions → Variables →* `NAME_FILTER` (kommagetrennt, z. B. `BaLuBB,Bot,Status`; `off` schaltet den Filter ab).
Fest ausgeblendet ist außerdem der Server **„Test Bot 1“** (exakter Name, `DEFAULT_EXCLUDE` in `client/src/cockpit/filter.js`).

### Aktualisierung, Verlauf, Grenzen

- GitHub führt geplante Workflows frühestens alle 5 Minuten aus und verzögert sie oft um einige Minuten. Die Seite prüft alle
  2 Minuten auf einen neuen Snapshot, die Daten sind meist 5–10 Minuten alt. Wirklich alle 2 Minuten ginge nur mit einem eigenen Server.
- **Verlauf der Server-Zustände:** Der Workflow lädt den zuletzt veröffentlichten, verschlüsselten Snapshot, hängt den neuen Messpunkt
  an (7 Tage) und verschlüsselt neu. Wird `DASHBOARD_PASSWORD` geändert, startet der Verlauf neu.
- **Cloudflare Free-Plan:** keine Firewall-Ereignisse; die Sicherheitskachel nutzt `securityAction`/`securitySource` und die
  Bedrohungsarten. Zeitraum 30 Tage, bei Ablehnung 7. Besucherdaten erscheinen, sobald in Cloudflare *Web-Analytics* für die Website aktiv ist.
- **Sicherheit:** Das Repo ist öffentlich, der verschlüsselte Block auch; die Sicherheit hängt an der Passwortstärke.
  Die Daten enthalten Servernamen und Mitgliederzahlen von Kunden-Servern, die Seite darf daher nie unverschlüsselt veröffentlicht werden.
  **Logs von Workflow-Läufen in öffentlichen Repos sind öffentlich**; die Workflows geben deshalb nur Zustände und Feldnamen aus.

### Lokale Vorschau mit Demo-Daten

```bash
npm install
npm run demo                       # baut die Seite und einen verschlüsselten Demo-Snapshot (Passwort: demo-passwort-123)
cd dist-pages && python3 -m http.server 8099
# Diashow: http://127.0.0.1:8099/tv#demo-passwort-123   Cockpit: http://127.0.0.1:8099/#cockpit&demo-passwort-123
```

---

## 2. Node-Server mit Live-Systemdaten

```bash
npm install
npm run build
npm start            # http://127.0.0.1:3000
```

Entwicklung mit Hot-Reload: `npm run dev`. Tests: `npm test`.
Zeigt CPU (gesamt, pro Kern, Takt, Temperatur), RAM/Swap, Festplatten + I/O, Netzwerk, Top-Prozesse, GPU, Akku, Nutzer, Uptime;
optional die Kacheln für BaLuBB-Status (`BALUBB_API_KEY`) und Cloudflare (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`).

Für Kollegen im Netz freigeben:

```bash
HOST=0.0.0.0 TOKEN=ein-geheimes-passwort npm start
```

Kollegen öffnen `http://<deine-ip>:3000/?token=ein-geheimes-passwort`. Ohne `TOKEN` kann jeder im Netz die Systemdaten sehen.
Die Verbindung ist unverschlüsselt (HTTP); nur im vertrauenswürdigen Netz oder hinter einem Reverse-Proxy mit HTTPS.

| Variable | Standard | Bedeutung |
|---|---|---|
| `PORT` | `3000` | Port |
| `HOST` | `127.0.0.1` | Bind-Adresse (`0.0.0.0` = alle) |
| `TOKEN` | – | Zugriffstoken für die API |
| `INTERVAL_MS` | `2000` | Messintervall |
| `BALUBB_API_KEY` | – | Key für die BaLuBB-API |
| `BALUBB_API_URL` | `https://bot.balubb.de/api/ext/v1/health` | Health-Endpunkt |
| `BALUBB_TTL_MS` | `30000` | Cache-Dauer der API-Antwort |
| `CLOUDFLARE_API_TOKEN` | – | Token mit *Zone → Analytics → Lesen* |
| `CLOUDFLARE_ZONE_ID` | – | Zone-ID von `balubb.de` |
| `CLOUDFLARE_DAYS` | `30` | Zeitraum in Tagen |
| `CLOUDFLARE_TTL_MS` | `300000` | Cache-Dauer |

Das Dashboard zeigt immer das System, auf dem der Server läuft.
