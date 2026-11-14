# BibCat

Desktop-Programm zur Katalogisierung privater Bibliotheksbestände – für Windows und macOS.

Schlank in der Bedienung, aber mit bibliothekarischer Tiefe: Signatur, Auflage, Reihe, Fachgebiete
mit Systematik-Notation, Schlagworte, Exemplare und verschachtelte Standorte.

![Katalogansicht](docs/katalog.png)

## Funktionen

- **Schnellerfassung**: ISBN scannen oder eintippen – die Daten werden abgerufen und das Buch sofort
  mit voreingestelltem Standort, Fachgebiet und Lesestatus gespeichert. Duplikate werden erkannt
  (dann „+ Exemplar"), jede Erfassung lässt sich rückgängig machen.
- **Barcode-Scan per Kamera** (EAN-13, nur Buch-ISBNs 978/979). USB-Handscanner funktionieren
  ohne Einrichtung, da sie wie eine Tastatur tippen.
- **ISBN-Abfrage** bei der Deutschen Nationalbibliothek (MARC21, inkl. GND-Schlagworte),
  Open Library und Google Books; Treffer werden zusammengeführt, Cover lokal gespeichert.
- **Standorte** als Baum (Raum › Regal › Fach); ein Raum zeigt auch alle Bücher seiner Regale.
- **Fachgebiete** mit Farbe und optionaler Notation (z. B. DDC).
- **Bewertung** (0–5 Sterne) und **Lesestatus** (ungelesen, lese gerade, gelesen, abgebrochen)
  mit Lesedatum.
- **Volltextsuche** über Titel, Autoren, Schlagworte, Signatur, ISBN, Notizen – mit Präfixsuche
  und ohne Rücksicht auf Umlaute/Akzente.
- Raster- und Listenansicht, Hell-/Dunkelmodus nach Systemeinstellung.
- **CSV-Export** (Excel-kompatibel) und **Sicherung** (Datenbank + Cover in einen Ordner).

Tastenkürzel: `Strg/⌘ + N` neues Buch, `Strg/⌘ + F` Suche, `Esc` schließt Dialoge.

## Technik

- Electron 45 + React 19 + TypeScript, gebaut mit electron-vite
- SQLite über das in Electron eingebaute `node:sqlite` mit FTS5-Volltextindex –
  **keine nativen Module**, dadurch unkomplizierte Builds für alle Plattformen
- Barcode-Erkennung mit ZXing (läuft lokal, ohne Cloud)

Die Daten liegen im Benutzerverzeichnis:

| System  | Ort |
|---------|-----|
| Windows | `%APPDATA%\BibCat\Katalog\` |
| macOS   | `~/Library/Application Support/BibCat/Katalog/` |

Mit der Umgebungsvariable `BIBCAT_DATA_DIR` lässt sich ein anderer Ordner verwenden.

## Entwicklung

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev        # App mit Hot-Reload starten
npm test           # Tests
npm run typecheck
```

## Installer bauen

Auf dem jeweiligen Betriebssystem:

```bash
npm run dist:win   # erzeugt dist/BibCat Setup x.y.z.exe
npm run dist:mac   # erzeugt dist/BibCat-x.y.z-universal.dmg
```

Alternativ baut der GitHub-Actions-Workflow (`.github/workflows/build.yml`) bei jedem Push beide
Installer; sie liegen dann als Artefakte am Workflow-Lauf.

**Hinweis zur Signierung:** Die Installer sind unsigniert. Windows zeigt beim ersten Start eine
SmartScreen-Warnung („Weitere Informationen" → „Trotzdem ausführen"); unter macOS die App beim
ersten Mal per Rechtsklick → „Öffnen" starten. Für eine Weitergabe an Dritte lohnt sich ein
Code-Signing-Zertifikat bzw. eine Apple-Developer-ID mit Notarisierung.

## Projektstruktur

```
src/main/        Electron-Hauptprozess: Datenbank (db.ts), ISBN-Abfrage (lookup.ts), CSV
src/preload/     Sichere Brücke zwischen Oberfläche und Hauptprozess
src/renderer/    React-Oberfläche
src/shared/      Gemeinsame Typen und ISBN-Hilfsfunktionen
tests/           Vitest-Tests
```
