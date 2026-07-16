# 📊 Ausgabentracker

Eine lokale Progressive Web App (PWA) fürs iPhone, um **Ausgaben zu tracken**,
**Kategorien mit Bemerkungen** zu vergeben, **Kontoauszüge (CSV) zu importieren**
und in einem **Dashboard** zu sehen, wohin das Geld fließt.

> 🔒 **Deine Daten bleiben auf deinem Gerät.** Alles wird lokal im Browser
> (IndexedDB) gespeichert – es gibt keinen Server, kein Konto, kein Tracking.
> Sicherung/Umzug erfolgt über eine Backup-Datei (JSON).

## Funktionen

- **Dashboard** mit Ausgaben/Einnahmen/Saldo, Donut „Ausgaben nach Kategorie",
  Monatsverlauf und den größten Ausgaben – filterbar nach Zeitraum.
- **Buchungen** manuell erfassen (Betrag, Datum, Kategorie, Empfänger, Bemerkung).
- **Kontoauszug-Import (CSV)** mit
  - automatischer Erkennung von Trennzeichen, Encoding, Dezimaltrenner und Datumsformat,
  - manueller **Spalten-Zuordnung**,
  - **speicherbaren Vorlagen** pro Bank,
  - **Duplikat-Erkennung** (kein doppelter Import),
  - Unterstützung für eine Betragsspalte **oder** getrennte Soll/Haben-Spalten.
- **Auto-Kategorisierung** über Regeln (z. B. „REWE" → Lebensmittel).
- **Kategorien** frei anlegen/anpassen (Emoji, Farbe, Art).
- **Backup**: Export/Import aller Daten als JSON.
- **Hell/Dunkel-Modus** und iOS-Home-Screen-Installation.

## Auf dem iPhone nutzen

1. Öffne die veröffentlichte URL in **Safari**:
   `https://saschlgo.github.io/webapp-ausgabentracker/`
2. Tippe auf das **Teilen-Symbol** und wähle **„Zum Home-Bildschirm"**.
3. Die App startet nun im Vollbild wie eine native App – auch offline.

## Kontoauszug importieren

1. Exportiere in deinem Online-Banking die Umsätze als **CSV**.
2. In der App: **Import → CSV-Datei wählen**.
3. Die Spalten werden automatisch erkannt – bei Bedarf korrigieren.
4. Optional als **Vorlage** speichern, damit der nächste Import mit einem Tippen klappt.
5. **Importieren** – Duplikate werden automatisch übersprungen.

Zum Ausprobieren liegt eine Beispieldatei bei:
[`public/sample-kontoauszug.csv`](public/sample-kontoauszug.csv)
(deutsches Sparkassen-Format: Semikolon, Dezimalkomma, `TT.MM.JJ`).

## Lokal entwickeln

Voraussetzung: Node.js 20+.

```bash
npm install      # Abhängigkeiten installieren
npm run dev      # Dev-Server (http://localhost:5173/webapp-ausgabentracker/)
npm run build    # Produktions-Build nach dist/
npm run preview  # Build lokal testen
```

## Deployment (GitHub Pages)

Das Deployment läuft automatisch per GitHub Actions
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) bei jedem Push.

**Einmalige Einrichtung im Repository:**

1. **Settings → Pages**
2. Unter **Build and deployment → Source** die Option **„GitHub Actions"** wählen.

Danach wird bei jedem Push die App gebaut und veröffentlicht unter:
`https://saschlgo.github.io/webapp-ausgabentracker/`

> Der Basis-Pfad ist in [`vite.config.ts`](vite.config.ts) als
> `base: '/webapp-ausgabentracker/'` gesetzt. Falls das Repository umbenannt
> wird, muss dieser Pfad angepasst werden.

## Technik

Vite · React · TypeScript · Dexie (IndexedDB) · PapaParse · Recharts ·
vite-plugin-pwa. Kein Backend, keine externen Datenverbindungen.
