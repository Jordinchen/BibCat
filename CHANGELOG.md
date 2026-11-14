# Änderungen

Alle nennenswerten Änderungen an BibCraft. Die Versionsnummern folgen
[Semantic Versioning](https://semver.org/lang/de/).

## 0.6.0 – 2026-11-14

**Filme, Musik, Spiele, Comics und Zeitschriften**

- Neben Büchern verwaltet BibCraft jetzt Comics, Zeitschriften, Filme und Serien, Musik und Spiele –
  gemischt in einer Bibliothek. Links unter *Medienart* lässt sich danach filtern, kombinierbar mit
  Status, Standort und Fachgebiet.
- Felder und Begriffe passen sich der Art an: beim Film Regie, Darsteller, Laufzeit, Format und
  Altersfreigabe, bei Musik Künstler, Label und Titelliste, bei Spielen Plattform und Spieleranzahl.
  Aus „Gelesen" wird „Gesehen", „Gehört" oder „Durchgespielt".
- Barcodes von CDs und Schallplatten werden über MusicBrainz erkannt, inklusive Cover und Titelliste.
  Zeitschriften über ihre ISSN bei der Deutschen Nationalbibliothek.
- Neu im Editor: *Online suchen* findet Filme, Serien, Musik, Spiele und Comics nach Titel
  (Wikidata und MusicBrainz, für Filme zusätzlich TMDb).
- Neu unter *Datei › Einstellungen*: eigener TMDb-Schlüssel für Filme und Serien; er wird
  verschlüsselt gespeichert.
- Der Kamera-Scanner und die Schnellerfassung lesen jetzt alle EAN/UPC-Barcodes; die Medienart
  wird automatisch erkannt oder vorab gewählt.
- Statistik mit „Nach Medienart"; Massenbearbeitung kann die Medienart ändern, Einträge lassen
  sich auch auf eine Medienart ziehen.
- Bestehende Bibliotheken werden beim ersten Start automatisch umgestellt; alle bisherigen Einträge
  bleiben Bücher.

## 0.5.1 – 2026-11-14

- Neues App-Symbol: ein Phönix im Stil eines alten Kupferstichs auf Pink. In sehr kleinen
  Größen (Taskleiste, Dateilisten) zeigt das Symbol nur den Kopf, damit es erkennbar bleibt.
- Das Symbol erscheint auch in der Titelleiste und unter *Über BibCraft*.

## 0.5.0 – 2026-11-14

**Automatische Updates**

- BibCraft sucht beim Start bei GitHub nach neuen Versionen. Unter Windows wird ein Update im
  Hintergrund geladen; danach fragt BibCraft „Jetzt neu starten?" – oder installiert es beim
  nächsten Beenden.
- Unter macOS erscheint vorerst ein Hinweis mit Download-Link (automatisches Installieren
  setzt eine Signierung voraus).
- Die automatische Suche lässt sich unter *Datei › Über BibCraft* abschalten. Es wird nur die
  neueste Versionsnummer abgefragt, über dich oder deine Bibliotheken wird nichts übertragen.
- Neu unter *Datei › Info*: „Nach Updates suchen".

**Sonstiges**

- Rechteinhaber im Lizenzhinweis: David Rosa.
- Installationsdateien heißen jetzt `BibCraft-Setup-<Version>.exe` bzw. `BibCraft-<Version>-universal.dmg`.

## 0.4.1 – 2026-11-14

- BibCraft ist freie Software unter der GNU GPL, Version 3 oder später.
- Neu: *Datei › Über BibCraft* mit Lizenz, Haftungsausschluss, Link zum Quellcode und den
  Lizenzen der verwendeten Bibliotheken.

## 0.4.0 – 2026-11-14

- Mehrere Bibliotheken, jede als eigener Katalog mit eigenen Standorten, Fachgebieten und Büchern.
  Umschalten über den Bibliotheksnamen in der Titelleiste.

## 0.3.0 – 2026-11-14

- Massenbearbeitung mit Mehrfachauswahl, Ziehen und Ablegen und „Rückgängig".
- Statistik mit Kennzahlen und Diagrammen.

## 0.2.0 – 2026-11-14

- Neuer Name BibCraft, Menüband im Office-Stil, Deutsch und Englisch, Akzentfarbe Pink.

## 0.1.0 – 2026-11-14

- Erste Version (BibCat): Katalog mit ISBN-Abfrage, Barcode-Scan, Standorten, Fachgebieten,
  Bewertung und Lesestatus.
