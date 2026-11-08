# Entwicklungsplan: Logbuch, Studienorganisation, Updates und Datensicherheit in der Beobachtungs-App „HX Now im Klinikalltag“

Stand: 08.11.2026 · Auftraggeber: Dr. med. Julian Triebelhorn, Klinik und Poliklinik für Innere Medizin II, TUM Klinikum

Ergänzt:
- `PLAN_Beobachtungs-App_HX_Now.md` (Version 2), im Folgenden „Hauptplan“
- `PLAN_Fragebogen-Modus_HX_Now.md`, im Folgenden „Fragebogenplan“

Alle harten Vorgaben des Hauptplans (Abschnitt 3) gelten weiter: kein Backend, keine Fremdbibliotheken, Daten nur in IndexedDB, jede Eingabe sofort gespeichert.

**Vorrang:** Dieser Plan **ersetzt** zwei Stellen:
- Abschnitt „Logbuch-Export“ im Fragebogenplan (2a): neuer Dateiname und neues Format, siehe Abschnitt 5.
- Abschnitt 7.5 „Datensicherung“ im Hauptplan: siehe Abschnitt 4.

Die übrigen Inhalte von Abschnitt 2a des Fragebogenplans (Teilnehmerliste, Store `logbuch`) bleiben gültig und werden hier erweitert.

> **Hinweis für Claude Code:** Arbeite die Phasen in Abschnitt 11 nacheinander ab, halte nach jeder Phase an und warte auf Freigabe. Phase L0 (Updates und Migration) muss vor allen anderen fertig sein, weil jede weitere Phase das Datenbankschema erweitert.

---

## 1. Ziel

Die App ist der Kern der Studiendokumentation. Sie soll deshalb fünf Dinge leisten:

1. **Sich sicher aktualisieren,** ohne dass Daten verloren gehen. Dazu gehört ein Knopf, der nach Updates sucht.
2. **Den Studienstand nach jeder Sitzung sichern,** ohne dass sich Dateien doppeln.
3. **Den Stand aus diesen Sicherungen wiederherstellen.** So weiß die App nach einem Verlust wieder, welche Blöcke und Fragebögen vorliegen.
4. **Ein Logbuch mit Detailansicht und Studienübersicht führen:** Phasendauern, Zielerreichung und fällige Aufgaben.
5. **Nachvollziehbare Änderungen erlauben:** Kommentare, ungültig markieren, Zuordnung korrigieren, Löschen bei Widerruf. Rohdaten werden dabei nie still verändert.

**Grundsatz:** Das Logbuch zeigt Umfang und Vollständigkeit der Erhebung, **keine inhaltlichen Ergebnisse pro Person**, also z. B. keine Tätigkeitsanteile oder HX-Now-Nutzung je Arzt. Ausgewertet wird die Gruppe; eine Leistungskontrolle findet nicht statt.

## 2. Updates

### 2.1 Wie die App aktualisiert wird

- Beim Öffnen und beim Zurückkehren in die App (`visibilitychange` → sichtbar, höchstens einmal pro Stunde) ruft die App `registration.update()` auf, sofern Netz vorhanden ist.
- Der Browser vergleicht `sw.js` byteweise mit der Version auf dem Server. Ist sie anders, lädt der neue Service Worker die Programmdateien im Hintergrund und **wartet** (`waiting`).
- Jede Veröffentlichung ändert deshalb zwingend:
  - die Cache-Version in `sw.js`, z. B. `const CACHE = "hxnow-v0.7.0"`,
  - `version.json` mit `{ "appVersion": "0.7.0", "datum": "…", "hinweis": "…" }`.
- Beobachtungsdaten liegen in IndexedDB und werden vom Update nicht berührt. Die Bedingungen dafür stehen in 2.3.

### 2.2 Knopf „Nach Updates suchen“

- **Ort:** Menü → Info, zusätzlich klein auf der Startseite neben der Versionsnummer.
- **Ablauf:**
  1. `registration.update()` aufrufen.
  2. Prüfen, ob `registration.installing` oder `registration.waiting` vorhanden ist.
  3. Zusätzlich `version.json` mit `cache: "no-store"` laden, um die neue Versionsnummer anzuzeigen.
- **Drei Ergebnisse:**

| Ergebnis | Anzeige |
| --- | --- |
| Neue Version gefunden | „Neue Version 0.7.0 verfügbar (installiert: 0.6.2).“ Dazu Hinweistext aus `version.json` und Knopf „Jetzt aktualisieren“ |
| Aktuell | „Die App ist aktuell (0.6.2).“ |
| Kein Netz oder Server nicht erreichbar | „Keine Verbindung. Bitte später erneut versuchen.“ Die App funktioniert offline weiter. |

### 2.3 Aktivierung eines Updates

- Ein wartendes Update zeigt ein Banner „Neue Version verfügbar“. Es wird **nie automatisch** aktiviert.
- „Jetzt aktualisieren“ ist nur möglich, wenn **kein Block läuft oder pausiert ist und kein Fragebogen offen ist**. Sonst erscheint der Hinweis „Bitte zuerst den laufenden Block bzw. Fragebogen abschließen.“
- **Vor der Aktivierung:**
  - Die App fragt: „Vor dem Update eine Komplettsicherung erstellen? (empfohlen)“ und bietet einen Knopf für die Komplettsicherung an (Abschnitt 4.4).
  - Gibt es nicht exportierte Sitzungen, erscheint ein deutlicher Hinweis.
- **Aktivierung:** `postMessage({ typ: "SKIP_WAITING" })` an den wartenden Service Worker, dann bei `controllerchange` einmal neu laden.
- **Nach dem Neustart:** Die App führt bei Bedarf die Datenbank-Migration aus (2.4) und zeigt „Aktualisiert auf 0.7.0“ mit dem Hinweistext.

### 2.4 Datenbank-Migration

- Die IndexedDB-Version wird nur über `onupgradeneeded` erhöht. Erlaubt sind:
  - neue Stores,
  - neue Indizes,
  - neue Felder mit Standardwert (gesetzt beim Lesen oder per Cursor-Durchlauf in der Migration).
- **Verboten:** Stores löschen oder neu anlegen, Schlüssel ändern, Datenbank löschen. Eine fehlerhafte Migration bricht die Transaktion ab, und der alte Stand bleibt erhalten.
- Jede Migration hat einen Test (Abschnitt 10): Die Datenbank der Vorversion wird mit Testdaten befüllt, migriert und vollständig verglichen.
- Dieser Plan bringt die Datenbank `hxnow-beobachtung` auf **Version 2**:
  - neue Stores `aenderungen` und `phasenplan`,
  - neue Felder in `meta` (Abschnitt 7).

### 2.5 Testversionen

- Unter `<name>.github.io` teilen sich alle Repositories **dieselbe Herkunft (Origin) und damit dieselbe IndexedDB**.
- Eine Testversion braucht daher entweder ein eigenes Konto bzw. eine eigene Domain oder einen eigenen Datenbanknamen.
- **Umsetzung:**
  - `dbName` wird aus einer Konstante in `js/config.js` gelesen: `hxnow-beobachtung` für die Studienversion, `hxnow-beobachtung-test` für Testversionen.
  - Die Testversion zeigt dauerhaft ein gelbes Band „TESTVERSION – keine Studiendaten“.

### 2.6 Regeln für Veröffentlichungen (in `README.md` und `CHANGELOG.md`)

1. Veröffentlichen darf nur die Studienleitung (Schreibrecht auf den Hauptzweig).
2. Jede Version bekommt einen Eintrag in `CHANGELOG.md`: was sich ändert, ob eine Migration nötig ist und ob Fragebogen oder Kodierschema betroffen sind.
3. Updates möglichst **zwischen den Studienphasen**, nicht während eines Beobachtungstags.
4. Die Domain bzw. der Pfad der App wird während der Studie **nie geändert**. Eine neue Domain bedeutet eine leere Datenbank.

## 3. Wie Daten verloren gehen können und was dagegen schützt

| Szenario | Folge | Schutz in der App |
| --- | --- | --- |
| Symbol vom Home-Bildschirm gelöscht | iOS löscht die Daten der Web-App | Sicherung nach jeder Sitzung (4.2); Wiederherstellen (4.5) |
| App versehentlich in einem normalen Safari-Tab geöffnet | eigener, leerer Speicher; dort Erfasstes fehlt später in der Home-Bildschirm-App | Erkennung über `display-mode: standalone` bzw. `navigator.standalone`. Im Tab: rotes Vollbild „Bitte die App über das Symbol auf dem Home-Bildschirm öffnen“; Erfassen ist gesperrt |
| Safari-Websitedaten gelöscht (Einstellungen) | Daten weg | Sicherung und Wiederherstellen |
| Speicherdruck auf dem Gerät | iOS kann Daten löschen | `navigator.storage.persist()` beim Start; Status in Info anzeigen; Sicherung |
| Gerät verloren, defekt oder zurückgesetzt | Daten auf dem Gerät weg | Exportordner **nicht** lokal auf dem iPhone, sondern auf einem Klinikumssystem (offener Punkt 1) |
| Domain oder Pfad geändert | neue, leere Datenbank | Regel 2.6 Nr. 4; Wiederherstellen |
| Fehlerhafte Migration | Datenbank nicht lesbar | Regeln 2.4; Komplettsicherung vor jedem Update |
| Testversion auf derselben Domain | Datenbanken vermischen sich | eigener `dbName` (2.5) |
| Versehentliches Löschen in der App | Einträge weg | kein echtes Löschen außer bei Widerruf (6.4); PIN |

**Anzeigen in der App:**
- Auf der Startseite: „Letzte Sicherung: heute 14:32“.
- Gelbes Banner, wenn seit der letzten abgeschlossenen Sitzung keine Sicherung erfolgt ist.
- Rotes Banner, wenn der letzte Export länger als **24 Stunden** zurückliegt und neue Einträge vorhanden sind.

## 4. Sicherung und Wiederherstellung

### 4.1 Grundprinzip

- **Die Sitzungsdateien** (Beobachtungsblock, Fragebogen, Versuch) sind die eigentlichen Daten. Jede Sitzung wird genau einmal exportiert, nichts wird doppelt gespeichert.
- **Die Logbuch-Datei** ist die kleine Übersicht. Sie enthält Teilnehmerliste, Phasenplan, Logbuch-Einträge und Änderungsprotokoll, aber keine Beobachtungs- oder Antwortinhalte. Sie hat einen **festen Dateinamen** und wird jedes Mal ersetzt.
- **Die Komplettsicherung** ist eine einzelne Datei mit allen Stores. Sie wird nur bei Bedarf erstellt.

### 4.2 Export am Sitzungsende

- „Abschließen und exportieren“ (Hauptplan 7.4) teilt künftig **zwei Dateien in einem Schritt**: `navigator.share({ files: [sitzungsDatei, logbuchDatei] })`.
- Im Teilen-Menü wählt man „In Dateien sichern“, dann den festen Exportordner, dann bei der Logbuch-Datei „Ersetzen“.
- **Wichtig, wegen der Geste:**
  - Beide Dateien werden **synchron** aus dem Speicherzustand erzeugt; vor `navigator.share()` steht kein `await`.
  - Die Logbuch-Datei wird deshalb bei jeder Änderung im Hintergrund neu berechnet und im Speicher vorgehalten.
  - Die Prüfsumme ist eine synchrone CRC32-Berechnung (eigene Implementierung, ca. 20 Zeilen), nicht `crypto.subtle`, weil diese asynchron ist.
- **Ersatzwege**, falls das Teilen mehrerer Dateien scheitert: zwei Downloads nacheinander oder Mail bzw. Zwischenablage wie im Hauptplan.
- **Logbuch-Export ohne Sitzung:**
  - Nach jeder Änderung über PIN (Abschnitt 6) und jeder Statusänderung eines Probanden fordert die App sofort zum Export der Logbuch-Datei auf.
  - Zusätzlich gibt es den Knopf „Logbuch sichern“ in der Logbuch-Ansicht.
- `meta.letzteSicherungTs` wird gesetzt, wenn das Teilen erfolgreich war (kein `AbortError`).

### 4.3 Fester Exportordner

- In den Einstellungen wird der Exportordner als **Text** hinterlegt, z. B. `Netzlaufwerk › HXNOW › Export`. Die App kann Ordner auf dem iPhone nicht selbst anlegen oder auswählen.
- Der Text wird beim Teilen als Erinnerung angezeigt: „Bitte speichern in: …“.
- Die Dateien-App merkt sich den zuletzt gewählten Ordner.
- Die Schulungsunterlage beschreibt das einmalige Anlegen des Ordners.

### 4.4 Komplettsicherung

- Eine Datei `HXNOW_Komplettsicherung_<geraeteId-8>_<JJJJMMTT>_<HHMM>.json` mit allen Stores und Kopfdaten (App-Version, DB-Version, Zeitpunkt, Prüfsumme). Es gibt keine ZIP-Datei, weil dafür eine Fremdbibliothek oder ein eigener ZIP-Schreiber nötig wäre.
- Die App fordert dazu auf:
  - **vor jedem Update** (2.3),
  - **am Ende jeder Studienphase**, wenn laut Phasenplan das Phasenende erreicht ist,
  - **vor einem Gerätewechsel** (Menü „Gerät wechseln“).
- Sie kann außerdem jederzeit über Menü → Datensicherung erstellt werden.
- Sie ersetzt den bisherigen „JSON-Export“ aus Hauptplan 7.5.

### 4.5 Wiederherstellen

**Automatische Rückfrage:**
- Findet die App beim Start eine leere Datenbank (keine Teilnehmenden, kein Logbuch), fragt sie: „Keine Studiendaten gefunden. Letzte Sicherung laden?“
- Die Antworten sind „Sicherung laden“ und „Neu beginnen“. „Neu beginnen“ erfordert eine zweite Bestätigung.

**Menü → Datensicherung → „Sicherung laden“:**
- Dateiauswahl mit Mehrfachauswahl, `<input type="file" multiple accept=".csv,.json">`.
- Man markiert im Exportordner **alle** Dateien: Sitzungsdateien, Logbuch-Datei und gegebenenfalls eine Komplettsicherung.

**Verarbeitung:**
1. **Dateien erkennen** am Präfix bzw. an der ersten Zeile, nicht am Dateinamen. Kopien wie „HXNOW_Logbuch_ab12cd34 2.csv“ werden also erkannt.
2. **Prüfsumme prüfen.** Weicht sie ab, wird die Datei nicht geladen, und es erscheint ein Hinweis mit dem Dateinamen.
3. **Mehrere Logbuch-Dateien:** Die App verwendet die **neueste nach dem Zeitstempel im Inhalt** (`meta.export_ts`). Ältere Dateien liefern nur Einträge, die in der neuesten fehlen.
4. **Logbuch älter als der Stand in der App:** Die App fragt nach. Sie überschreibt nichts und ergänzt nur fehlende Einträge.
5. **Komplettsicherung:** Alle Stores werden ohne Überschreiben importiert, doppelte IDs übersprungen.
6. **Sitzungsdateien:**
   - Aus jeder Datei entsteht bzw. ergänzt sich der Logbuch-Eintrag (Pseudonym, Art, Phase, Bereich, Zeiten, Status, Dauer, Erhebungsmodus).
   - Fehlt die Logbuch-Datei, wird das Logbuch vollständig aus den Sitzungsdateien aufgebaut.
   - Inhalte (Episoden, Antworten) werden **nicht** zurück in die App geladen. Sie liegen bereits gesichert im Exportordner. Die App braucht nur den Stand.
   - Wiederhergestellte Einträge erhalten `exportStatus = bestaetigt`.
7. **Änderungsprotokoll anwenden** (Abschnitt 6). Einträge, die ungültig markiert oder umgeordnet wurden, erscheinen wieder so. Für widerrufene Codes werden Sitzungsdateien **abgewiesen** und im Bericht aufgeführt.
8. **Bericht:**
   - „Geladen: 34 Blöcke, 12 Fragebögen, 3 Versuche, 5 Änderungen; übersprungen (bereits vorhanden): 2; abgewiesen: 1 (Prüfsumme) …“
   - Danach der Hinweis „Bitte jetzt eine Komplettsicherung erstellen.“

**Was nicht wiederherstellbar ist:** Sitzungen, die nach der letzten Sicherung erfasst und nie exportiert wurden. Darauf weisen die Banner aus Abschnitt 3 hin.

### 4.6 Zweites Gerät

- Ein Gerät kann die Logbuch-Datei eines anderen Geräts über „Sicherung laden“ einlesen. Die Einträge werden mit der fremden `geraeteId` gekennzeichnet und im Logbuch mit Gerätekürzel angezeigt.
- So sehen beide Geräte den gemeinsamen Stand, z. B. die Zielerreichung pro Proband.
- Änderungen (Abschnitt 6) gehören zu dem Gerät, auf dem sie gemacht wurden. Das Zusammenführungstool vereint die Protokolle aller Geräte.
- **Konflikt:** Zwei Änderungen zum selben Eintrag aus verschiedenen Geräten werden beide angezeigt; die zeitlich spätere gilt. Das Zusammenführungstool meldet den Konflikt.
- **„Gerät wechseln“:**
  1. Auf dem alten Gerät eine Komplettsicherung erstellen.
  2. Auf dem neuen Gerät die App installieren und die Komplettsicherung laden.
  3. Danach wird das alte Gerät auf „stillgelegt“ gesetzt: In `meta` steht das, und es zeigt nur noch die Logbuch-Ansicht.

## 5. Logbuch-Datei

**Dateiname (fest):** `HXNOW_Logbuch_<geraeteId-8>.csv`. Im Testmodus bzw. in der Testversion: `HXNOW_TEST_Logbuch_…`.

**Format:**
- UTF-8 mit BOM, Semikolon, `\r\n`, RFC-4180-Quoting.
- Eine Kopfzeile für alle Zeilen; die Spalte `datensatz` gibt den Zeilentyp an.
- Nicht zutreffende Spalten bleiben leer.

| `datensatz` | Inhalt | wichtige Spalten |
| --- | --- | --- |
| `meta` | genau eine Zeile, immer die erste nach der Kopfzeile | `export_ts`, `geraete_id`, `app_version`, `db_version`, `definition_version`, `schema_version`, `n_zeilen`, `pruefsumme` (CRC32 über alle übrigen Zeilen) |
| `proband` | eine Zeile pro Studien-Code | `pseudonym`, `bereich`, `status`, `status_ts`, `registriert_ts`, `notiz`, Phasendaten des Probanden (6.1) |
| `phasenplan` | eine Zeile pro Bereich | `bereich`, `baseline_start`, `einfuehrung_start`, `regelbetrieb_start`, `abschluss_start`, `ende` |
| `eintrag` | eine Zeile pro Logbuch-Eintrag | Spalten wie Store `logbuch` (Fragebogenplan 2a) |
| `aenderung` | eine Zeile pro Änderung | Spalten wie Store `aenderungen` (6.2) |

Zusätzlich steht der Stand in Klartext am Anfang der `meta`-Zeile (`stand_text`, z. B. „16 Probanden, 61 Blöcke, 19 Fragebögen, letzte Sitzung 03.12.2026 10:14“). So kann man ihn in Excel sofort erkennen.

## 6. Änderungen im Logbuch

### 6.1 Was geändert werden kann

| Änderung | Ziel | PIN | Wirkung |
| --- | --- | --- | --- |
| **Kommentar** hinzufügen | Block, Fragebogen, Versuch, Proband | nein | Text mit Zeitstempel; mehrere Kommentare möglich |
| Kommentar **zurückziehen** | Kommentar | nein | wird ausgegraut, bleibt im Protokoll |
| **Ungültig markieren** | Block, Fragebogen, Versuch | ja | Grund Pflicht: U1 Testeintrag · U2 falscher Proband, nicht korrigierbar · U3 Fehlbedienung · U4 doppelt erfasst · U9 Sonstiges (Freitext Pflicht). Zählt nicht mehr für Ziele und Auswertung |
| Ungültig **aufheben** | wie oben | ja | Eintrag zählt wieder |
| **Zuordnung korrigieren** | Block, Fragebogen, Versuch | ja | anderer Studien-Code (Auswahl aus Teilnehmerliste), Grund Pflicht |
| **Phase korrigieren** | Block | ja | PRE ↔ POST, Grund Pflicht |
| **Probandenstatus** ändern | Proband | ja | aktiv · ausgeschieden · widerrufen (6.4) |
| **Phasendaten** ändern | Bereich oder Proband | ja | z. B. Einführung beginnt bei P009 eine Woche später |

**Phasendaten pro Proband:**
- Standard sind die Daten des Bereichs aus dem Phasenplan.
- Abweichende Daten pro Proband sind möglich und werden in `teilnehmende` als `phasenAbweichung` gespeichert.
- Beim Anlegen eines Blocks schlägt die App die Phase anhand von Datum und Phasenplan vor. Weicht die gewählte Phase ab oder liegt das Datum in der Einführung, erscheint ein Hinweis.

### 6.2 Store `aenderungen` (nur anfügen, nie ändern)

| Feld | Beschreibung |
| --- | --- |
| `aenderungId` | UUID |
| `ts`, `geraeteId`, `appVersion` | |
| `art` | `KOMMENTAR` · `KOMMENTAR_ZURUECK` · `UNGUELTIG` · `UNGUELTIG_AUFGEHOBEN` · `ZUORDNUNG` · `PHASE` · `STATUS` · `PHASENDATEN` · `WIDERRUF_LOESCHUNG` |
| `zielTyp` | `BLOCK` · `FB` · `VERSUCH` · `PROBAND` · `BEREICH` · `AENDERUNG` |
| `zielId` | `blockId`, `sitzungId`, `versuchId`, Pseudonym, Bereich oder `aenderungId` |
| `feld`, `alt`, `neu` | z. B. `pseudonym`, `P017`, `P071` |
| `grund` | U1–U9 bzw. Freitext-Kategorie |
| `text` | Kommentar bzw. Begründung |

**Regeln:**
- Rohdaten in `bloecke`, `fb_sitzungen`, `versuche` und `logbuch` werden **nie** verändert.
- Die App berechnet den **wirksamen Stand** (gültig, Pseudonym, Phase, Kommentare) aus Rohdaten plus allen Änderungen in zeitlicher Reihenfolge, über eine reine Funktion `wirksamerStand(eintrag, aenderungen)` mit Unit-Tests.
- Die bereits exportierten Sitzungsdateien bleiben unverändert. Die Änderungen reisen in der Logbuch-Datei mit und werden vom Zusammenführungstool angewendet (Abschnitt 8).
- Die einzige Ausnahme vom Prinzip „nie löschen“ ist der Widerruf (6.4).

### 6.3 PIN

- Beim ersten Start legt die Studienleitung eine 6-stellige PIN fest. Sie wird als SHA-256 mit Salz in `meta.pinHash` gespeichert.
- Die PIN ist ein **Schutz vor versehentlichen Änderungen**, keine Zugriffssicherung. Die Gerätesperre des Dienst-iPhones bleibt die eigentliche Sicherung.
- Nach 5 Fehleingaben folgt eine Sperre von 5 Minuten.
- PIN vergessen: Zurücksetzen ist nur über Komplettsicherung, Neuinstallation und Wiederherstellen möglich. Das steht in der Anleitung.
- Die PIN-Abfrage ist für 10 Minuten gültig, damit mehrere Korrekturen hintereinander möglich sind.

### 6.4 Widerruf

Die Teilnehmerinformation sieht vor, dass bei Widerruf die bis dahin erhobenen, noch zuordenbaren Daten gelöscht werden. Ablauf:

1. **Status setzen:** Proband → „Status ändern“ → „widerrufen“ (PIN). Ab dann ist für diesen Code keine Erfassung mehr möglich.
2. **Daten löschen:** „Daten dieses Probanden löschen“, mit zweiter Bestätigung, bei der der Code abgetippt werden muss. Dabei gilt:
   - **Echt gelöscht** werden:
     - alle Inhalte in `bloecke`, `episoden`, `pausen`, `fb_sitzungen`, `fb_antworten` und `versuche` zu diesem Code,
     - die zugehörigen Logbuch-Einträge,
     - die Texte aller Änderungen und Kommentare zu diesem Code.
   - **Erhalten bleibt nur:** die Zeile in `teilnehmende` mit Status `widerrufen` und ein Eintrag `WIDERRUF_LOESCHUNG` mit Datum und Anzahl der gelöschten Einträge, ohne Inhalte.
3. **Liste der exportierten Dateien:**
   - Vor dem Löschen erzeugt die App die Liste aller bereits exportierten Dateinamen dieses Codes.
   - Sie wird als `HXNOW_Widerruf_<pseudonym>_<JJJJMMTT>.txt` angeboten mit dem Hinweis: „Diese Dateien müssen im Exportordner und auf allen weiteren Ablagen von Hand gelöscht werden.“
   - Die Dateinamen enthalten nur Pseudonym, Datum und ID.
4. **Logbuch-Export erzwingen:** Danach wird sofort die Logbuch-Datei exportiert.
5. **Wiederherstellen und Zusammenführungstool** weisen Dateien widerrufener Codes ab und melden sie, falls sie noch im Ordner liegen.

## 7. Datenmodell (Datenbank-Version 2)

| Store | Änderung |
| --- | --- |
| `aenderungen` | **neu**, Schlüssel `aenderungId`, Indizes `zielId`, `ts` |
| `phasenplan` | **neu**, Schlüssel `bereich`; Felder `baselineStart`, `einfuehrungStart`, `regelbetriebStart`, `abschlussStart`, `ende` (Datum `JJJJ-MM-TT`) |
| `teilnehmende` | neues Feld `phasenAbweichung` (Objekt mit denselben Datumsfeldern, leer = Bereichsdaten) |
| `logbuch` | neue Felder `geraeteIdHerkunft` (bei fremdem Gerät), `wiederhergestellt` (boolean) |
| `meta` | neue Felder `letzteSicherungTs`, `letzteKomplettsicherungTs`, `pinHash`, `pinSalz`, `exportordnerText`, `stillgelegt`, `dbVersion` |

Die Migration von Version 1 auf 2 legt nur an und setzt Standardwerte (2.4).

## 8. Erweiterung des Zusammenführungstools

- Liest zusätzlich **alle Logbuch-Dateien** (alle Geräte, bei mehreren Dateien pro Gerät jeweils die neueste nach `export_ts`).
- Wendet die Änderungsprotokolle aller Geräte an und ergänzt in allen Ausgabetabellen die Spalten:
  - `gueltig` (0/1), `ungueltig_grund`,
  - `pseudonym_original`, `phase_original` (bei Korrektur),
  - `kommentare` (zusammengefasst mit Datum).
- Die Auswertungstabellen (Scores, Prä-Post, Tätigkeitsanteile) enthalten standardmäßig **nur gültige Einträge**. Eine zusätzliche Datei `alle_eintraege.csv` enthält alles.
- **Neue Prüfungen** im `pruefbericht.txt`:
  - Dateien widerrufener Codes, die noch vorhanden sind (Fehler, mit Dateiliste)
  - Änderungskonflikte zwischen Geräten
  - Logbuch-Prüfsumme falsch
  - Logbuch-Einträge ohne Datendatei und umgekehrt (aus dem Fragebogenplan)
- **Neue Ausgabe `phasen.csv`:**
  - eine Zeile pro Proband und Phase,
  - Spalten: geplanter Beginn und geplantes Ende, erster und letzter Block, Dauer in Tagen, Anzahl gültiger Blöcke, beobachtete Minuten, Pausen, Abbrüche, Versuche, Fragebogen-Datum.
  - Damit lassen sich die Phasendauern für die Publikation beschreiben.

## 9. Bildschirme

### 9.1 Logbuch: Studienübersicht (Einstieg)

- **Kopf:**
  - Studientag und aktuelle Phase je Bereich (aus dem Phasenplan), z. B. „NEPH: Baseline, Tag 6 von 14“.
  - Letzte Sicherung.
  - Knopf „Logbuch sichern“.
- **Fällig-Liste**, nach Dringlichkeit sortiert:
  - „FB1 von P007 offen – Baseline endet in 3 Tagen“
  - „P012: 2 von 5 Blöcken, noch 4 Tage“
  - „KB fällig für P003 (Einführung endet morgen)“
  - „3 Sitzungen nicht gesichert“
- **Tabelle aller Probanden**, Spalten wie im Fragebogenplan 2a:
  - farbige Markierung (grün: im Plan; gelb: knapp; rot: Ziel nicht mehr erreichbar oder Bogen überfällig),
  - Filter nach Bereich und Status.
- **Verteilung der Blöcke** über alle Probanden zusammen, getrennt nach Phase:
  - Anzahl je Arbeitskontext K1–K7, je Dienst und je Tageszeit (vor 10 Uhr, 10–14 Uhr, nach 14 Uhr),
  - einfache Balken aus HTML und CSS, keine Bibliothek.
  - Dient dazu, die Beobachtungen ausgewogen zu verteilen.
  - **Nicht pro Person** und **ohne Tätigkeitsinhalte**.

### 9.2 Logbuch: Detailansicht Proband (Tipp auf eine Zeile)

- **Kopf:** Code, Bereich, Status, Registrierung, Kommentare zum Probanden. Knöpfe „Kommentar“, „Status ändern“ und „Phasendaten“.
- **Für jede Phase eine Karte** (Baseline, Einführung, Regelbetrieb):
  - geplanter Zeitraum (Bereich oder abweichend) und tatsächlicher Zeitraum vom ersten bis zum letzten Block, beides mit Dauer in Tagen,
  - Blöcke: gültig / Ziel, z. B. „4 / 5“, dazu ungültige in Klammern,
  - beobachtete Minuten, Anzahl und Summe der Pausen, Abbrüche mit Codes, Versuche „nicht angetroffen“,
  - Fragebogen der Phase: Status, Ausfüllzeitpunkt, Bearbeitungsdauer, APP oder PAPIER.
  - Die Einführung hat keine Beobachtungsblöcke; ihre Karte zeigt nur Zeitraum und Kurzbogen.
- **Chronologische Liste aller Einträge:**
  - Datum, Uhrzeit, Art, Phase, Kontext, Dauer, Status, Exportstatus, Kommentaranzahl.
  - Ungültige Einträge sind durchgestrichen und mit Grund versehen, korrigierte Einträge mit Hinweis „umgeordnet von P071“.

### 9.3 Logbuch: Eintrag (Tipp auf einen Eintrag)

- **Angezeigte Metadaten:**
  - Block: Start, Ende, beobachtete Zeit, Pausen mit Gründen, Kontext, Dienst, Abbruch, „HX-Now-Gerät dabei“, Exportdatei-Name.
  - Fragebogen: Start, Ende, Dauer, Modus, Anzahl beantworteter und ausgelassener Fragen.
- **Bewusst keine Inhalte:** keine Episodenliste, keine Tätigkeitsanteile, keine Fragebogenantworten.
- **Knöpfe:** „Kommentar“, „Ungültig markieren“ bzw. „Ungültig aufheben“, „Zuordnung korrigieren“, „Phase korrigieren“.
- **Verlauf aller Änderungen** zu diesem Eintrag.

### 9.4 Einstellungen und Datensicherung

- **Einstellungen:** Phasenplan je Bereich (PIN), Ziel Blöcke pro Phase, Exportordner-Text, PIN ändern.
- **Datensicherung:** Logbuch sichern, Komplettsicherung erstellen, Sicherung laden, Gerät wechseln, Bestätigte Einträge löschen (Logbuch bleibt erhalten, siehe Fragebogenplan).
- **Info:** App-Version, DB-Version, Definitions- und Schema-Version, Speicherstatus (`persist`), „Nach Updates suchen“, Änderungsprotokoll der App (aus `version.json`).

## 10. Tests

- **Unit:**
  - `wirksamerStand()` für jede Änderungsart, Reihenfolge und Aufhebung, mehrere Geräte und Konflikt
  - Zählungen und Zielerreichung mit ungültigen und umgeordneten Einträgen
  - Phasenvorschlag aus Datum und Phasenplan inklusive Abweichung pro Proband
  - Logbuch-CSV gegen Referenzdatei; CRC32 gegen bekannte Werte
  - Erkennung von Dateitypen am Inhalt
  - Auswahl der neuesten Logbuch-Datei nach `export_ts`
  - Widerruf: nach dem Löschen enthält **keine** Store-Abfrage und keine Exportdatei mehr Daten dieses Codes außer dem Statusvermerk
- **Migration:**
  - Datenbank Version 1 mit Testdaten (alle Stores, laufender Block, offener Fragebogen) auf Version 2 migrieren
  - alle Altdaten identisch, neue Stores vorhanden
  - laufender Block wird nach dem Update fortgesetzt
- **Wiederherstellen (E2E, Playwright, iPhone-Profil):**
  1. Drei Probanden, Blöcke, Fragebögen, Änderungen (ungültig, umgeordnet, Kommentar) anlegen.
  2. Nach jeder Sitzung exportieren; dabei die exportierten Dateien abfangen.
  3. Datenbank löschen.
  4. Die App fragt nach der Sicherung; alle Dateien laden.
  5. Erwartung: Logbuch, Zählungen und wirksamer Stand sind identisch mit dem Stand vor dem Löschen.
  - **Varianten:**
    - ohne Logbuch-Datei (Aufbau nur aus Sitzungsdateien),
    - mit zwei Logbuch-Dateien verschiedenen Alters,
    - mit manipulierter Prüfsumme,
    - mit Datei eines widerrufenen Codes.
- **Update (E2E):**
  - Version A installieren, Daten anlegen, Block starten.
  - Version B bereitstellen. „Nach Updates suchen“ zeigt B; Aktivieren ist gesperrt, solange der Block läuft.
  - Nach dem Blockende aktivieren. Erwartung: Daten vollständig, Migration ausgeführt.
- **Safari-Tab-Erkennung:** Aufruf ohne `standalone` zeigt die Sperre.
- **Manuell (iPhone):**
  - Teilen von zwei Dateien in die Dateien-App mit „Ersetzen“
  - Mehrfachauswahl beim Laden
  - Symbol löschen, neu installieren, wiederherstellen
  - Update über GitHub Pages
  - Testversion mit eigenem `dbName` parallel zur Studienversion

## 11. Umsetzung in Phasen

| Phase | Inhalt | Abnahmekriterien |
| --- | --- | --- |
| **L0. Updates und Migration** | `version.json`, Update-Knopf mit drei Ergebnissen, wartendes Update mit Banner, Sperre bei laufendem Block/Fragebogen, Migrationsgerüst (DB v2), `dbName` aus `config.js`, Testversions-Band, Safari-Tab-Sperre, Veröffentlichungsregeln in README. | Update-E2E bestanden; Migrationstest bestanden; Testversion und Studienversion auf derselben Domain teilen keine Daten. |
| **L1. Logbuch-Datei und Sitzungsexport** | Logbuch-CSV nach Abschnitt 5 mit CRC32, Vorberechnung im Speicher, Teilen von zwei Dateien ohne `await`, Ersatzwege, „Logbuch sichern“, Anzeige letzte Sicherung, Banner. | Referenzdatei stimmt; Teilen-Aufruf ohne vorheriges `await` (Code-Review und gemockter Test); auf dem iPhone landen beide Dateien im gewählten Ordner. |
| **L2. Komplettsicherung und Wiederherstellen** | Komplettsicherung (JSON), Aufforderungen (vor Update, Phasenende, Gerätewechsel), Rückfrage bei leerer DB, Mehrfachauswahl, Erkennung, Prüfsumme, neueste Logbuch-Datei, Aufbau aus Sitzungsdateien, Bericht, zweites Gerät, Gerät stilllegen. | Alle Wiederherstellungs-Varianten aus Abschnitt 10 bestanden. |
| **L3. Phasenplan und Logbuch-Ansichten** | Store `phasenplan`, Abweichung pro Proband, Phasenvorschlag beim Blockstart, Studienübersicht mit Fällig-Liste und Verteilung, Detailansicht Proband mit Phasenkarten, Eintragsansicht. | Phasendauern und Zählungen stimmen mit einem Handbeispiel überein; keine inhaltlichen Ergebnisse pro Person sichtbar (Review). |
| **L4. Änderungen und PIN** | Store `aenderungen`, `wirksamerStand()`, alle Änderungsarten aus 6.1, PIN mit Sperre, Verlauf je Eintrag, Logbuch-Export nach Änderung. | Unit-Tests grün; nach Wiederherstellen ist der wirksame Stand identisch. |
| **L5. Widerruf** | Ablauf nach 6.4 inklusive Dateiliste und Abweisung beim Laden. | Widerrufstest bestanden; Abfrage aller Stores ohne Treffer außer Statusvermerk. |
| **L6. Zusammenführungstool und Dokumentation** | Erweiterung nach Abschnitt 8 inklusive `phasen.csv`; Anleitung für die Doktorandin (Exportordner einrichten, Sichern, Wiederherstellen, Update, Korrekturen); Notfallkarte (eine Seite) „Daten weg – was tun?“. | Zusammenführung mit zwei Geräten, Änderungen und einem Widerruf liefert korrekte Tabellen und Prüfbericht; eine Person ohne Vorkenntnisse kann nach Anleitung wiederherstellen. |

## 12. Offene Punkte

1. **Exportordner:** Netzlaufwerk des Klinikums (über die Dateien-App per SMB) oder ein anderer Klinikumsspeicher. Mit der Klinik-IT klären. Ein Ordner nur lokal auf dem iPhone schützt nicht bei Verlust des Geräts.
2. **PIN:** Wer hält die PIN (Studienleitung, eventuell zusätzlich die Doktorandin für Kommentare und Phasendaten)? Derzeit vorgesehen: eine PIN für alle geschützten Aktionen.
3. **Phasenplan:** konkrete Daten je Bereich eintragen, sobald das Startdatum feststeht (08.11.2026 ist ein Sonntag).
4. **Hosting:** Domain bzw. Pfad vor dem ersten echten Einsatz endgültig festlegen und danach nicht mehr ändern.
5. **Ethikkommission:** Die Änderungsfunktionen betreffen nur die Dokumentation und keine neuen Daten. Für die Änderungsanzeige sollte die Beschreibung „Erfassung lokal auf dem Dienstgerät, Export auf Klinikumssysteme, Löschung bei Widerruf“ ausreichen. Prüfen, ob die Logbuch-Datei (Pseudonym, Zeitpunkte) dort erwähnt werden soll.
