# Todo

## Offen

- [ ] **Schaltfläche „Neues Buch" → „Neues Medium"** (Menüband › Start › Erfassen). Gilt auch für reine
      Buchsammlungen; bei gemischten Medien heißt sie derzeit „Neuer Eintrag" – einheitlich „Neues
      Medium" verwenden. Englisch z. B. „New item".
- [ ] **Tooltip im Menüband ohne Leerzeichen** („NeuesBuch"): In `src/renderer/src/components/Ribbon.tsx`
      wird beim Tooltip der Zeilenumbruch der Beschriftung gelöscht statt durch ein Leerzeichen ersetzt.
      Dabei auch Silbentrennungen wie „Schnell-\nerfassung" berücksichtigen (→ „Schnellerfassung").

## Roadmap

- [ ] Cloud-Abgleich zwischen mehreren PCs – Entscheidung offen: Google Drive mit eigener
      Verschlüsselung (auch fürs Handy) oder zunächst Proton Drive (nur PCs)
- [ ] Android-App (Samsung Galaxy S22): suchen, scannen, erfassen, Abgleich über die Cloud
- [ ] Code-Signierung für Windows und macOS (Voraussetzung für die Weitergabe an andere und für
      automatische Updates unter macOS)

## Erledigt

- [x] Massenbearbeitung und Statistik (0.3.0)
- [x] Mehrere Bibliotheken (0.4.0)
- [x] Lizenz GPL-3.0-or-later (0.4.1)
- [x] Automatische Updates über GitHub Releases (0.5.0)
- [x] Neues App-Symbol (Phönix) (0.5.1)
- [x] Filme, Musik, Spiele, Comics und Zeitschriften (0.6.0)
