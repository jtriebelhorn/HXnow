# Changelog

## 1.1.0 – 09.11.2026
Neue Tätigkeit; **Kodierschema 2.0** (geänderte Bedeutung von T5), Exportformat unverändert 1.0, keine Datenbank-Migration:
- **T11 „Diagnostik/Intervention“**: jede Untersuchung oder Prozedur am Patienten, auch körperliche Untersuchung
  (Blutentnahme, Zugang, Ultraschall, EKG, Punktion, Injektion, BGA, Verbandswechsel). Taste direkt neben T5.
- **T5** heißt „Patientenkontakt (Gespräch)“ und umfasst nur noch das Gespräch mit Patient oder Angehörigen.
- Rangfolge: Gerätenutzung, Telefonat, T11, T5, T6, T8, T9, T10; T11 nur als Haupttätigkeit.
- [Kodierhandbuch 2.0](docs/KODIERHANDBUCH_v2.0.md) mit Grenzfällen; Zusammenführungstool nennt im Prüfbericht die
  Schema-Versionen der Blöcke und warnt bei gemischten Versionen.

## 1.0.0 – 09.11.2026
**Festschreibung für den Studienbeginn** (ENTSCHEIDUNGEN Nr. 47); keine Datenbank-Migration:
- **Kodierschema 1.0** und **[Kodierhandbuch 1.0](docs/KODIERHANDBUCH_v1.0.md)**: keine offenen Werte mehr; Mindestdauer
  3 s (nur Auswertung, HX Now ausgenommen); unterwegs ist die inhaltliche Tätigkeit Haupttätigkeit (Telefon = T7 mit
  O6, T9 nur bei reinem Gehen); Zeitgrenzen, Abstand, Abbruch und Löschen nach Ermessen der beobachtenden Person (der
  Pausenhinweis nach 5 min ist nur noch eine Erinnerung).
- **Fragebögen 1.0.0**: FB1, Kurzbogen und FB2 festgeschrieben, FB2 für echte Codes freigegeben
  (`docs/codebuch/codebuch_1.0.0.csv`).
- **Tageskennzahlen**: Belegung (nur Normalstation, Notaufnahmestation), Aufnahmen, Entlassungen, ambulant betreute
  Patienten und Tagesumsatz (Summe) statt „Auslastung“.
- **Exportformat 1.0**: Spalte `format_version` an 2. Stelle in allen Dateien (Block, Versuch, Tageskennzahlen,
  Fragebogen, Logbuch); Dateityp wird an Spaltennamen erkannt; Referenzdateien je Typ und ein Test, der Änderungen an
  Kodierschema, Fragebögen oder Exportspalten ohne neue Version verhindert (`npm run versionen`).
- **Zusammenführungstool**: `beobachtung_bereinigt.csv` (kurze Episoden zusammengelegt, Spalte `zusammengelegt`);
  Prüfbericht nennt zusammengelegte Episoden und „Gehen mit Nebentätigkeit“; Dateien ohne `format_version` (vor der
  Festschreibung) werden nicht ausgewertet.
- Behoben: `hidden` wurde von Klassen mit eigener Anzeige (z. B. Formularfelder) überschrieben.

## 0.18.0 – 08.11.2026
Löschen nicht abgeschlossener Exporte; keine Datenbank-Migration:
- Startseite, „Nicht abgeschlossene Exporte“: kleines × oben rechts an jedem Eintrag, Rückfrage „Wirklich löschen?“.
- Studiensitzungen (Block, nicht angetroffen, Fragebogen): Daten werden gelöscht, der Logbuch-Eintrag bleibt mit der
  Änderung `GELOESCHT` (zählt nicht, kein Hinweis „nicht gesichert“ mehr). Probeläufe und Tageskennzahlen werden ganz
  entfernt.

## 0.17.0 – 08.11.2026
Tageskennzahlen je Teilbereich; **Datenbank-Migration 3 → 4** (automatisch beim ersten Start, alle Daten bleiben):
- Nephrologie: Normalstation, Dialyse, Ambulanz, Konsile; Notaufnahme: Notaufnahme, Notaufnahmestation (Kodierschema
  `bereiche[].teilbereiche`). Auswahl nach dem Bereich, Pflicht; je Tag und Teilbereich ein eigener Eintrag.
- Store `tageskennzahlen` mit Schlüssel `[datum, bereich, teilbereich]`; vorhandene Einträge erhalten `teilbereich` = ''.
- Export: Spalte `teilbereich` nach `bereich`, Dateiname `HXNOW_TAG_<bereich>-<teilbereich>_<JJJJMMTT>_<HHMM>.csv`.
- Behoben: Nach dem Wechsel des Teilbereichs gingen sehr schnelle Eingaben verloren (Felder wurden erst nach dem Lesen
  geleert).

## 0.16.0 – 08.11.2026
Anmerkungen aus der Prüfung der Testdateien; keine Datenbank-Migration, Fragebogen-Definition 0.1.1:
- Fragebogen-Datei: neue Spalte `testmodus` (nach `definition_version`); ausgeblendete Freitextfelder `wert` = −88
  wie alle ausgeblendeten Zellen.
- Logbuch: „ausgelassen“ zählt wie die Fragebogen-Datei (auch Freitextfelder). Datei mit getrennten Spalten
  `proband_status` und `eintrag_status`; Fragebogen-Dauer in `dauer_sek` (Blöcke: `dauer_sek` = Beginn bis Ende,
  `beobachtet_sek` ohne Pausen). Probeläufe stehen nicht mehr im Studien-Logbuch. Ältere Logbuch-Dateien bleiben lesbar.
- FB1 und FB2: Hinweis an W3 „Bitte für jede Situation eine Häufigkeit angeben – auch 0 …“ (nur in der App;
  `definitionVersion` 0.1.1, Codebuch `docs/codebuch/codebuch_0.1.1.csv`).
- Zusammenführungstool: `logbuch_gesamt.csv` mit `dauer_sek`.

## 0.15.0 – 08.11.2026
Probandenverwaltung und Studienübersicht; keine Datenbank-Migration, Kodierschema-Feld `pseudonym.muster` geändert:
- Probanden-Codes frei wählbar (2–20 Zeichen: Buchstaben, Ziffern, Bindestrich; keine Klarnamen), statt nur
  `P` + 3 Ziffern. Vorhandene Codes bleiben gültig, Test-Code weiter P000.
- Feld „Proband“: Antippen öffnet die Liste aller angelegten Probanden, Tippen filtert, Antippen wählt; ein unbekannter
  Code wird über „Neuen Probanden anlegen: …“ aufgenommen (Teilnehmerliste mit Anlagedatum, damit im Logbuch).
- Studie: oben Summen (Probanden, Blöcke, Stunden, Fragebögen, nicht angetroffen), darunter eine knappe Zeile je
  Proband mit Ampel; Fällig und Verteilung zum Aufklappen. Detailansicht unverändert.

## 0.14.1 – 08.11.2026
Darstellung auf normal großen iPhones (375–393 px Breite); keine Datenbank-Migration:
- Raster (Orte, Tätigkeiten, Nutzung/Haltung, Fragebogen-Optionen) werden nie breiter als der Bildschirm
  (`minmax(0, 1fr)` statt `1fr`).
- Nutzung und Haltung: Beschriftung über den Tasten statt daneben, Tasten über die volle Breite, keine Worttrennung
  mehr („Ste-hend“).
- Untere Leiste der Kodieransicht: Schriftgröße passt sich der Breite an („Rückgängig“, „Kommentar“ stoßen nicht mehr
  an den Rand).
- Fragebogen: Zusatzantworten wie „nicht genutzt“ in eigener Zeile unter der Skala; Skala 1–7 passt auch auf 375 px.
- Test „Studie“ an die PIN-Abfrage beim Phasenplan angepasst (schlug seit 0.12.0 fehl, die App war korrekt).

## Dokumentation (F6/L6) – 08.11.2026
Ohne neue App-Version (keine ausgelieferte Datei geändert):
- `docs/ANLEITUNG_DOKTORANDIN.md` (Fragebogen, Exportordner, Sichern, Studienübersicht, Korrekturen, Widerruf, Update)
  und `docs/NOTFALLKARTE.md` („Daten weg – was tun?“, Gerätewechsel, abgelehnte Dateien).
- `docs/CODEBUCH_EXPORT.md`: Fragebogen-Datei, Logbuch-Datei, Komplettsicherung, Teilnehmerliste, Widerrufsprotokoll,
  Ausgabe des Zusammenführungstools.
- README: Stand, Zusammenführen, `npm run version`, Regeln für Fragebögen und IDs. ENTSCHEIDUNGEN Nr. 37–42.

## 0.14.0 – 08.11.2026
Phasen F5 und L6 – Zusammenführungstool (`werkzeuge/zusammenfuehren.html`, `js/auswertung/`); App unverändert:
- Liest den ganzen Exportordner (Ordner- oder Dateiauswahl) im Browser, ohne Upload: Beobachtung, Versuche,
  Tageskennzahlen, Fragebögen und die Logbuch-Dateien aller Geräte (je Gerät die neueste, Prüfsumme geprüft).
- Wendet die Änderungen an (`gueltig`, `ungueltig_grund`, wirksamer Code und Phase mit `pseudonym_original`,
  `phase_original`), verwirft Daten widerrufener Codes und Probeläufe, erkennt doppelte Dateien.
- Ausgabe als ZIP: beobachtung, versuche, tageskennzahlen, fb_long, fb1/kb/fb2_wide, prae_post (FB2 auf FB1-Codes
  umkodiert), scores (ATI, TAM_PU/PEOU/BI, SUS; Regeln aus HXNow-Fragebogen), logbuch_gesamt, alle_eintraege (Abgleich
  Logbuch ↔ Dateien), phasen, aenderungen, Codebuch und pruefbericht.txt.

## 0.13.0 – 08.11.2026
Phase L5 – Widerruf (PLAN_Logbuch_Datensicherheit 6.4); keine Datenbank-Migration:
- „Widerruf“ in der Probandenansicht (PIN, Code zur Bestätigung eintippen): löscht in einer Transaktion Blöcke mit
  Episoden und Pausen, Versuche, Fragebögen mit Antworten, Logbuch-Einträge und Änderungen des Codes (auch
  zugeordnete Einträge). Es bleiben die Zeile der Teilnehmerliste (Status „widerrufen“) und die Änderung
  WIDERRUF_LOESCHUNG.
- Protokoll `HXNOW_Widerruf_<Code>_<Datum>.txt` mit den Namen aller exportierten Dateien des Codes; wird mit dem
  Logbuch geteilt. Bis das Logbuch gesichert ist, mahnt die Startseite (rotes Banner).
- Gesperrt, solange für den Code ein Block oder Fragebogen läuft. Daten widerrufener Codes werden beim Laden von
  Sicherungen abgewiesen; der Code ist nicht mehr wählbar.

## 0.12.0 – 08.11.2026
Phase L4 – Änderungen und PIN (PLAN_Logbuch_Datensicherheit 6); keine Datenbank-Migration:
- Eintrag: Kommentar und Zurückziehen (ohne PIN); mit PIN: als ungültig markieren (U1–U4, U9 mit Pflichttext) und
  aufheben, anderem Probanden zuordnen, Phase ändern. Proband: Kommentar, Status (aktiv, pausiert, ausgeschieden),
  eigene Phasendaten. Jede Änderung wird nur angefügt; die erfassten Daten bleiben unverändert. Verlauf je Eintrag und
  Proband; bei Änderungen mehrerer Geräte gilt die zeitlich letzte.
- PIN: beim ersten Mal festlegen, SHA-256 mit Salz, 10 Minuten gültig, nach 5 Fehlversuchen 5 Minuten gesperrt;
  „PIN ändern“ im Studienplan.
- Nach jeder Änderung: Angebot „Logbuch sichern“. Studienübersicht und Probandenansicht rechnen mit dem wirksamen
  Stand.
- Logbuch-Datei: Zeitpunkte von Änderungen und Export mit Millisekunden, damit die Reihenfolge eindeutig bleibt.

## 0.11.0 – 08.11.2026
Phase L3 – Phasenplan und Logbuch-Ansichten (PLAN_Logbuch_Datensicherheit 9); keine Datenbank-Migration:
- Neuer Menüpunkt „Studie“: Studientag und Phase je Bereich, Fällig-Liste (offene Fragebögen, fehlende Blöcke,
  nicht gesicherte Sitzungen), Probandentabelle mit Ampel, Verteilung der Blöcke nach Arbeitskontext, Dienst und
  Tageszeit (nur über alle Probanden). Keine Inhalte je Person.
- Detailansicht Proband mit Phasenkarten (geplant/tatsächlich, Blöcke von Ziel, Minuten, Pausen, Abbrüche,
  Fragebogen) und Eintragsansicht.
- Studienplan: Phasenplan je Bereich (Reihenfolge geprüft, Änderungen im Änderungsprotokoll), Ziel je Phase
  (`zielBloeckeProPhase`, Standard 5), Exportordner-Hinweis (auch auf der Startseite).
- Phasenvorschlag beim Blockstart und bei „nicht angetroffen“ aus dem Phasenplan; Bereich wird in der
  Teilnehmerliste nachgetragen, wenn er beim Anlegen des Codes fehlte.
- Teilnehmerliste: CSV-Export und Laden (ergänzt nur fehlende Codes, prüft Code und Bereich).
- Startseite: Kopfzeile bricht auf schmalen Geräten um.

## 0.10.0 – 08.11.2026
Phase L2 – Komplettsicherung und Wiederherstellen (PLAN_Logbuch_Datensicherheit 4.4–4.6); keine Datenbank-Migration:
- Komplettsicherung Format 3 mit Anzahl je Store, Datenbank-Version und CRC32-Prüfsumme (Format 1 und 2 bleiben
  ladbar).
- „Sicherung laden“ mit Mehrfachauswahl: Erkennung am Inhalt (Komplettsicherung, Logbuch, Block, Versuch,
  Fragebogen, Tageskennzahlen), Prüfsummen und Zeilenzahlen, neueste Logbuch-Datei, fehlende Logbuch-Einträge aus
  Sitzungsdateien (Eingang bestätigt), Vorschau vor dem Übernehmen und Bericht; Daten widerrufener Codes werden
  abgewiesen.
- Leere Datenbank: Hinweis „Keine Studiendaten gefunden. Letzte Sicherung laden?“ mit „Neu beginnen“ (doppelte
  Rückfrage).
- Gerät wechseln: Anleitung, „Gerät stilllegen“ (keine neuen Erhebungen) und Aufheben; Herkunft fremder Geräte-IDs
  wird gemerkt.

## 0.9.0 – 08.11.2026
Phase L1 – Logbuch-Datei und Sitzungsexport (PLAN_Logbuch_Datensicherheit 4.1, 5); keine Datenbank-Migration:
- Logbuch-Datei `HXNOW_Logbuch_<Gerät>.csv` (fester Name, ersetzt die vorige Fassung): Teilnehmerliste, Phasenplan,
  Logbuch-Einträge und Änderungen, ohne Beobachtungs- oder Antwortinhalte; meta-Zeile mit Zeilenzahl und
  CRC32-Prüfsumme.
- Jeder Sitzungsexport (Block, Versuch, Fragebogen, Tageskennzahlen) teilt Sitzungsdatei und Logbuch in einem
  Vorgang; kann das Gerät nur eine Datei teilen, folgt der Hinweis „Logbuch sichern“. Download lädt beide Dateien.
- Startseite: „Letzte Sicherung …“, Knopf „Logbuch sichern“, gelbes Banner für nicht gesicherte Sitzungen
  (rot nach 24 Stunden).
- `npm run version -- <x.y.z> "Hinweis"` trägt eine neue Version in version.js, sw.js (inkl. Dateiliste) und
  version.json ein.

## 0.8.0 – 08.11.2026
Fragebogen-Modus (Phasen F1–F4) und Grundlage für Teilnehmerliste und Logbuch; keine Datenbank-Migration:
- Knopf „Fragebogen“: Vorbereitung durch die Doktorandin, Übergabe, Ausfüllen mit Filtern und automatischen Werten,
  Unterbrechen und Fortsetzen, Papier-Nacherfassung, Rückkehr per langem Druck, Statusansicht ohne Antworten.
- Export `HXNOW_FB_<Bogen>_<Code>_…csv` im Long-Format (eine Zeile je Zelle, Status inkl. `automatisch`).
- Studien-Code aus der Teilnehmerliste (Suche, „Neuen Code anlegen“), gesperrt bei widerrufen/ausgeschieden.
- Logbuch-Eintrag für jeden Block, Versuch und Fragebogen (ohne Inhalte), bleibt beim Löschen bestätigter Daten.
- Fragebogen-Definition: Bedingung der weichen Sprungregel korrigiert (`SKIP_HX != 1 ODER UNBEKANNT(SKIP_HX)`).

## 0.7.0 – 08.11.2026
Phase L0 – Updates und Migration (PLAN_Logbuch_Datensicherheit), Datenbank-Migration nötig (2 → 3, automatisch):
- „Nach Updates suchen“ in Info und auf der Startseite: neue Version (mit Hinweistext), aktuell oder keine Verbindung;
  stille Prüfung beim Öffnen und Zurückkehren (höchstens stündlich); `version.json`.
- Update nur ohne laufenden Block und ohne offenen Fragebogen; vorher Angebot einer Komplettsicherung und Hinweis auf
  nicht exportierte Einträge; nach dem Neustart „Aktualisiert auf …“.
- Datenbank Version 3 mit allen Stores für Fragebögen, Teilnehmende, Logbuch, Änderungen und Phasenplan.
- Testversionen mit eigenem Datenbanknamen und gelbem Band (`js/config.js`).
- Safari-Tab auf iPhone/iPad: Erfassen gesperrt mit Anleitung zum Home-Bildschirm; Desktop-Tab mit Hinweisband.
- JSON-Datensicherung heißt jetzt Komplettsicherung (mit Geräte-ID im Namen, alle Stores).

## 0.6.0 – 08.11.2026
Fragebogen-Modus, Phase F0 (Definition; noch keine Oberfläche):
- `js/frageboegen.js`: FB1 (Baseline), KB (Kurzbogen Gewöhnung) und FB2 (Ende Regelbetrieb) nach den Spezifikationen
  v0.3 vom 08.11.2026, `definitionVersion` 0.1.0; stabile Item- und Zellen-IDs, Paar-IDs mit Umkodierung für den
  Vorher-Nachher-Vergleich, Bedingungen (`showIf`, `IRGENDEIN`, `ALLE`, `UNBEKANNT`), Auto-Werte, weiche Sprungregel.
- `js/fb/definition.js` (Zellen, Prüfung), `js/fb/codebuch.js` (Codebuch-CSV, Paar-Schnappschuss),
  `npm run codebuch` erzeugt `docs/codebuch/codebuch_<version>.csv` und mit `--snapshot` den Schnappschuss
  (erstmals erzeugt).
- Tests: jedes Item gegen die Spezifikation (`docs/quellen/*.md`), Wortlaut von FB1/FB2 gegen die Papierfassungen,
  gleiche Kodierung gepaarter Fragen in FB1, KB und FB2, Zellen, Schnappschuss, Codebuch.

## 0.5.6 – 08.11.2026
Nach zwei Testläufen (P000):
- „Gehen“ setzt den Ort automatisch auf „Unterwegs“; O4 heißt „Flur (Aufenthalt)“ (ENTSCHEIDUNGEN Nr. 27).
- Rückgängig fragt nach, wenn die letzte Episode älter als 10 s ist, und nennt, wohin die Zeit geht (Nr. 28).

## 0.5.5 – 04.11.2026
- Nebentätigkeiten sind nachvollziehbar: Die Abschlussseite zeigt den Ablauf aufgeklappt mit Spalte NT und die
  Anteile je Nebentätigkeit; die CSV hat die lesbare Spalte `nebentaetigkeiten`.
- Eigene Codes NT3–NT7 statt T-Codes (CSV-Spalten `NT3` … `NT7`, `NT3_nutzung`); „Gleichzeitig“ heißt jetzt
  „Nebentätigkeit“ (ENTSCHEIDUNGEN Nr. 25).
- HX Now als Nebentätigkeit: auch die Haltung ist kodierbar (`NT3_haltung`).
- Keine Nachfrage mehr am Blockende: Nicht Angegebenes gilt automatisch als Sonstige (N9, neu H9, Nr. 26).

## 0.5.4 – 04.11.2026
- „Gleichzeitig“ ist jetzt auch bei T9 möglich (Telefonat oder HX Now im Gehen); T9 heißt nur noch „Gehen“.
  Schalter bleiben beim Wechsel zu T9 an.

## 0.5.3 – 04.11.2026
- Ortstasten: keine Silbentrennung mehr mitten im Wort („Beim Patienten“).

## 0.5.2 – 04.11.2026
- Orte beschreiben, wo die Person im Bereich ist (ENTSCHEIDUNGEN Nr. 24): O1 Arztzimmer, O2 beim Patienten,
  O3 bei der Pflege, O4 Flur, O5 Pausenraum, O6 unterwegs, O7 außerhalb des Bereichs, O8 Sonstiges.
  Entfallen: Behandlung Notaufnahme, Dialyse, Ambulanz. Ortstasten in zwei Reihen.

## 0.5.1 – 04.11.2026
- Kodieransicht übersichtlicher: farbige Bereiche mit Überschrift – Ort (türkis), Tätigkeit mit Nutzung und Haltung
  (blau), Gleichzeitig (violett); Anzeige der laufenden Episode als farbige Marken.
- „Gleichzeitig“ steht unter Nutzung/Haltung und ist zugeklappt; aufklappen bei Bedarf, eingeschaltete
  Tätigkeiten bleiben in der Kopfzeile sichtbar.
- HX Now gleichzeitig: Nutzungsart wählbar (was mit HX Now gemacht wird), neue CSV-Spalte `neben_T3_nutzung`
  (ENTSCHEIDUNGEN Nr. 23).

## 0.5.0 – 04.11.2026
Kodierschema 0.3 / Kodierhandbuch-Entwurf 0.3 (ENTSCHEIDUNGEN Nr. 16 verworfen, Nr. 19–22):
- Erst Ort, dann Tätigkeit: Ortstasten stehen über den Tätigkeitstasten, Anzeige „O… · T…“.
- Neuer Ort „Unterwegs“ (ab 0.5.2: O6): Gehzeit unabhängig von der Tätigkeit (Telefonat, HX Now … laufen weiter);
  T9 heißt „Gehen ohne weitere Tätigkeit“. PC/Visitenwagen werden unterwegs automatisch zu T9, HX Now unterwegs
  bekommt automatisch die Haltung „gehend“.
- Schalter „Gleichzeitig“ (Patient/in, Kollegen/Pflege, Telefon, HX Now, Mobilgerät) neben der Haupttätigkeit;
  bleibt an, bis er abgewählt wird. Neue CSV-Spalten `neben_T5` … `neben_T4` (0/1).
- Neue Nutzungsart N5 „Warten“ (Anmeldung, Laden, Gerät belegt) für PC, Visitenwagen und HX Now.
- Korrekturfenster entfernt: Jeder Tipp bleibt eine eigene Episode; kurze Episoden werden in der Auswertung
  bereinigt. Rückgängig bleibt.
- Codebuch mit Auswertungshinweisen (Gehzeit, Dokumentation mit Patient/in, Wartezeit am Gerät).
- Prüf-Workflow: Soll-Protokoll mit den neuen Regeln, Simulation tippt erst Ort, dann Tätigkeit, nutzt
  „Unterwegs“ und „Gleichzeitig“; Rohdatenprüfung der gleichzeitigen Tätigkeiten.

## 0.4.0 – 03.11.2026
Nach Auswertung der ersten Pilotdateien (P017, P018):
- Export: Zeitstempel aus derselben gerundeten Uhr wie die Dauern – in jeder Zeile gilt `ende − start = dauer_sek`
  (vorher bis zu 1 s Widerspruch, ENTSCHEIDUNGEN Nr. 15).
- Korrekturfenster (`korrekturfensterSek`, Standard 3 s): Tätigkeit/Ort direkt nach einem Wechsel ändern die neue
  Episode statt eine 1-s-Scheinepisode anzulegen; Vertipper zurück zur vorherigen Kodierung entfallen. HX Now bleibt
  immer eigene Episode. Überschriebene Werte bleiben in den Rohdaten (Nr. 16).
- „Block beenden – Daten behalten“ fragt den Grund ab (Pflicht, `pflichtangaben.beendenGrund`); neue CSV-Spalte
  `block_ende_grund` (Nr. 17).
- Probeläufe mit Test-Code `P000`: Knopf „Probelauf“ beim Anlegen, Kennzeichnung in Kodierung, Abschluss und Liste,
  Dateien `HXNOW_TEST_…` (Nr. 18).
- Neues Codebuch aller Exportspalten: `docs/CODEBUCH_EXPORT.md`; Kodierhandbuch ergänzt.
- Prüf-Workflow: Soll-Protokoll mit Korrekturfenster, neue Prüfungen „ende − start = dauer_sek“ und
  „Episoden + Pausen = block_ende − block_start“ (exakt).

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
