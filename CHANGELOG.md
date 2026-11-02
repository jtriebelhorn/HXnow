# Changelog

## 0.3.0 – 02.11.2026
- Phase 5 – Offline und PWA: Service Worker mit versioniertem Cache (Cache-first) für alle App-Dateien inkl.
  `kodierschema.json`; nach dem ersten Aufruf startet die App vollständig ohne Netz (auch im Flugmodus).
- Update-Ablauf: Eine neue Version lädt im Hintergrund und wartet; Hinweis „Jetzt aktualisieren“ nur auf der
  Startseite, nie während eines laufenden oder pausierten Blocks. Gespeicherte Daten bleiben erhalten.
- App-Icons (180, 192, 512 px, erzeugt mit `npm run icons`), iOS-Tags für den Home-Bildschirm,
  „Offline verfügbar“ in der Info-Ansicht.
- Tests: Cache-Liste vollständig und Cache-Version = App-Version (Unit), Start im Flugmodus und Update während
  eines Blocks bzw. auf der Startseite (E2E mit echtem Service Worker, WebKit und Chromium).

## 0.2.0 – 02.11.2026
- Umstellung auf Spezifikation v2 / Kodierhandbuch v0.2 (`schemaVersion` 0.2):
  Pause/Fortsetzen mit Grund P1–P5 statt T11/O9, Blockzeit = beobachtete Zeit ohne Pausen,
  Hinweis bei Pause > 5 min (Abbruch A3), Arbeitskontext K1–K7 (zweistufig), Nutzungsart bei T1/T2 (optional,
  abschaltbar) mit Filter `giltFuer`, Schalter und Abschlussfrage „HX-Now-Gerät dabei“ (Post).
- CSV v2: Zeilen für Episoden und Pausen, neue Spalten (Kontext, beobachtete Zeit, Pausen, Gerät dabei),
  `n_zeilen_block`; Datenbank Version 2 (Store `pausen`); Sicherung inkl. Pausen.
- Kurzmeldungen fangen keine Tipps mehr ab.
- Pause vereinfacht: „Fortsetzen“ mit einem Tipp (weiter wie vor der Pause); Grund und Notiz optional während der Pause.
- Pflichtangaben im Kodierschema einstellbar (`pflichtangaben`); Standard: nur das Notwendigste Pflicht,
  optionale Felder gekennzeichnet und abwählbar; Dienst/Arbeitskontext auf der Abschlussseite nachtragbar.
- Nur noch ein Beobachter (B1): Auswahl ausgeblendet, Kürzel automatisch.
- Prüf-Workflow `npm run pruefen` (Simulation im iPhone-Profil, Soll-Ist-Abgleich von Export, Rohdaten und Sicherung, Prüfbericht).

## Unveröffentlicht
- Phase 1: Fachlogik `js/block.js` (Block anlegen, Episodenwechsel, T3 mit Nutzungsart/Haltung, T11/O9,
  Rückgängig, Kommentare, Abbruch, Block beenden mit „behalten/verwerfen“, automatisches Ende,
  Episodenenden und -dauern, Zusammenfassung) und `js/zeit.js` (Countdown, ISO-Zeit mit Offset, Rundung).
  Entscheidungen in `docs/ENTSCHEIDUNGEN.md`.
- Phase 2: `js/db.js` (IndexedDB mit allen Stores), `js/sitzung.js` (jede Eingabe vor der Anzeige gespeichert,
  Zeitstempel beim Tipp), Wiederherstellung eines laufenden Blocks nach Neuladen, `navigator.storage.persist()`.
- Phase 3: Oberfläche – Startseite mit Liste offener Einträge und 24-h-Banner, Block anlegen, Kodieransicht,
  Abschlussseite (Zusammenfassung, Ergänzen unvollständiger T3-Episoden), Person nicht angetroffen,
  Tageskennzahlen, Info. Bildschirmsperre wird während eines Blocks verhindert (falls unterstützt).
- Phase 4: CSV-Export nach Abschnitt 8 (Block, Versuch, Tageskennzahlen; Spalte `block_ende_art`),
  Exportwege Teilen → Download → Mail → Zwischenablage, Status offen → exportiert → bestätigt,
  Datensicherung (JSON-Export, Import ohne Dubletten, Löschen bestätigter bzw. verworfener Einträge).
- Blockdauer beim Anlegen wählbar (10 oder 15 min, aus `kodierschema.json`: `blockDauerOptionenSek`);
  neue CSV-Spalte `block_dauer_soll_sek`.

## 0.0.1 – 26.10.2026
- Phase 0: Grundgerüst, App-Shell mit CSP, Manifest, Service Worker (noch ohne Cache),
  `kodierschema.json` (Kodierhandbuch v0.1), Validierung des Schemas mit verständlichen Fehlermeldungen,
  Testinfrastruktur (`node --test`, Playwright).
