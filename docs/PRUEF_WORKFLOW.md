# Prüf-Workflow: realitätsnahe Simulation und Datenprüfung

Der Workflow spielt die App so durch, wie eine Beobachterin sie auf dem Dienst-iPhone benutzt, und prüft danach,
ob **jede Eingabe vollständig, verständlich und mit exaktem Zeitstempel gespeichert** ist und **wieder ausgelesen**
werden kann – aus der Exportdatei (CSV), direkt aus dem Gerätespeicher und aus der JSON-Sicherung.

## Ausführen

| Befehl | Zweck |
| --- | --- |
| `npm run pruefen` | Ein Lauf im iPhone-Profil mit Safari-Engine (WebKit), neuer Zufalls-Seed → bei jedem Lauf andere Abläufe |
| `SEED=123456 npm run pruefen` | Einen bestimmten Lauf exakt wiederholen (Seed steht im Bericht) |
| `npm run pruefen:serie -- 10` | 10 Läufe nacheinander mit verschiedenen Seeds, Übersicht am Ende |
| `npm run pruefen:alle` | Ein Lauf mit Safari- und Chrome-Engine |

Dauer: ca. 15 Sekunden pro Lauf. Voraussetzung wie bei den Tests: `npm install` und `npx playwright install webkit chromium`.

## Ergebnis

Jeder Lauf legt einen Ordner `pruefberichte/<Zeitpunkt>_seed<Seed>/` an:

- **`bericht.md`** – Ergebnis, Übersicht je Szenario, alle fehlgeschlagenen Prüfungen mit genauer Abweichung,
  die **aus der Exportdatei zurückgelesenen Daten in Klartext** (Uhrzeit, Dauer, Tätigkeit, Ort, Nutzung, Haltung,
  Pausengrund, Kommentare) und das **Simulationsprotokoll** (was wann getippt wurde).
- **`dateien/`** – alle exportierten Dateien des Laufs (Block-CSV, Versuche, Tageskennzahlen, JSON-Sicherung),
  z. B. zum Öffnen in Excel.

Schlägt eine Prüfung fehl, endet der Befehl mit Fehlercode und nennt den Bericht.

## Was simuliert wird

Zwei Beobachtungstage im iPhone-Profil (Touch-Bedienung, Uhr gesteuert):

- **Prä-Tag** (Nephrologie, Frühdienst): Tageskennzahlen; Visite mit Pause (P1) und Neuladen der App;
  10-min-Block Stationsarbeit mit 3 min gesperrtem iPhone; „Person nicht angetroffen“; Abbruch A1 während einer Pause.
- **Post-Tag** (Notaufnahme, Spätdienst): Tageskennzahlen; HX-Now-Nutzung mit Nutzungsart/Haltung, Pause P5 mit Notiz
  bei gesperrtem iPhone, Ergänzen unvollständiger Episoden; Block nur mit Pflichtangaben gestartet und Kontext/Dienst
  am Ende nachgetragen, „Gerät dabei“ von Hand; Blockzeit läuft bei gesperrtem iPhone ab; vorzeitig beendet
  (behalten bzw. verworfen); „Person nicht angetroffen“.
- **Tagesabschluss:** Export aller Einträge, „Eingang bestätigt“, JSON-Sicherung, Import auf einem zweiten Gerät.

Innerhalb der Blöcke wählt ein **Verhaltensmodell** (`tests/workflow/modell.js`) Tätigkeiten, Orte, Dauern,
Nutzungsart und Haltung passend zum Arbeitskontext (z. B. Visite: viel Patientenkontakt im Patientenzimmer,
Wagen mit Texteingabe, HX Now im Gehen). Dazu kommen typische Bedienereignisse: Vertipper mit sofortigem
„Rückgängig“, Doppeltipps, sehr kurze Episoden unter 5 s, Kommentare mit Umlauten, Semikolon, Anführungszeichen
und Zeilenumbruch.

## Was geprüft wird

Ein **unabhängiges Soll-Protokoll** (`tests/workflow/soll.js`) schreibt jeden Tipp mit Zeitstempel mit und leitet
nach den Kodierregeln (Kodierhandbuch v0.2, `docs/ENTSCHEIDUNGEN.md`) ab, was gespeichert sein muss. Es nutzt
bewusst keinen App-Code. Verglichen wird je Block:

- CSV-Format (UTF-8-BOM, Semikolon, `\r\n`, Quoting), Spaltenkopf, Zeilenzahl
- **jedes Feld jeder Zeile** gegen die Eingaben: Codes, Start/Ende, Dauer, Pausen, Kommentare, Blockangaben, Gerät dabei
- Zeitformat `JJJJ-MM-TTThh:mm:ss±hh:mm`; Zeitleiste lückenlos (Start = Ende der Vorzeile)
- Summen: Episoden = beobachtete Zeit, Pausen = Pausenzeit, beides ≈ Wandzeit; reguläres Ende = Solldauer
- keine Platzhalter (`undefined`, `null`, `NaN`)
- **Rohdaten im Gerätespeicher**: alle Zeitstempel auf die Millisekunde, Codes, Texte, rückgängig gemachte Episoden
- Versuche und Tageskennzahlen; Exportstatus; JSON-Sicherung vollständig; Import auf zweitem Gerät identisch, ohne Dubletten

Dass die Prüfungen greifen, wurde mit absichtlich eingebauten Fehlern nachgewiesen (Pausenende um 1 ms verfälscht,
Semikolon nicht gequotet): beide wurden mit genauer Fundstelle gemeldet.

## Anpassen

- Szenarien: `tests/workflow/simulation.spec.js` (Aufrufe von `spieleBlock`)
- Verhalten/Dauern je Kontext: `tests/workflow/modell.js`
- Erwartete Spalten: `tests/workflow/abgleich.js` (`ERWARTETE_SPALTEN`) – bei Formatänderungen bewusst mitziehen.
