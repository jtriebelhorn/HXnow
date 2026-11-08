# Entwicklungsplan: Fragebogen-Modus in der Beobachtungs-App „HX Now im Klinikalltag“

Stand: 08.11.2026 · Auftraggeber: Dr. med. Julian Triebelhorn, Klinik und Poliklinik für Innere Medizin II, TUM Klinikum
Ergänzt: PLAN_Beobachtungs-App_HX_Now.md (Version 2). Alle dort genannten harten Vorgaben (Abschnitt 3) gelten weiter.
Inhaltliche Grundlage: Fragebogen 1 (Baseline) Version 0.3 vom 08.11.2026 (`Fragebogen1_Baseline_v0.3.docx/.pdf`), Kurzbogen Gewöhnung, Fragebögen Version 0.1 (für Bogen 2).

> **Hinweis für Claude Code:** Arbeite die Phasen in Abschnitt 10 nacheinander ab, halte nach jeder Phase an und warte auf Freigabe. Bei Unklarheiten im Wortlaut der Fragebögen nachfragen, nie selbst umformulieren.

---

## 1. Ziel

Die bestehende Beobachtungs-App erhält einen **Fragebogen-Modus**. Die Doktorandin startet einen Fragebogen, trägt den Studien-Code ein und reicht das Gerät an die Ärztin oder den Arzt weiter. Nach dem Ausfüllen wird das Ergebnis wie ein Beobachtungsblock als CSV exportiert.

Grundprinzipien:

1. **Fragebögen sind fest in die App eingebaut.** Es gibt eine Definitionsdatei im Code, kein Laden zur Laufzeit. Eine inhaltliche Änderung erfordert eine neue App-Version.
2. **Alle drei Bögen sind von Anfang an enthalten:** Fragebogen 1 (Baseline), Kurzbogen Gewöhnung, Fragebogen 2 (Ende Regelbetrieb).
3. **Einzelne Änderungen per App-Update bleiben möglich**, ohne die Vergleichbarkeit zwischen Baseline und Regelbetrieb zu gefährden. Das sichern stabile Item-IDs, Versionierung, Paar-IDs und ein automatischer Test (Abschnitt 4).
4. **Einheitliches Exportformat für alle Bögen und Versionen:** Long-Format mit einer Zeile pro Antwort (Abschnitt 6).
5. **Papier-Nacherfassung:** Die Doktorandin kann Papierbögen über dieselbe Maske eintippen; der Erhebungsmodus wird mitgespeichert.

## 2. Ablauf in der App

1. **Startseite:** neuer Knopf „Fragebogen“ neben „Neuer Block“.
2. **Vorbereitung (Doktorandin):**
   - Bogen wählen: FB1 / KB / FB2.
   - Studien-Code (Prüfung wie bei Blöcken), Bereich.
   - Erhebungsmodus: „Ausfüllen durch Teilnehmende“ oder „Papierbogen nacherfassen“.
   - Bei Nacherfassung zusätzlich das Datum auf dem Papierbogen.
3. **Übergabebildschirm:** „Bitte reichen Sie das Gerät an die teilnehmende Person weiter.“ Ein Tipp auf „Start“ beginnt den Fragebogen und setzt den Startzeitpunkt.
4. **Ausfüllen:**
   - Eine Seite pro Abschnitt (A, B, W …), Fortschrittsanzeige, „Weiter“ und „Zurück“.
   - Bei Matrix- und Skalenfragen springt die Ansicht nach einem Tipp automatisch zur nächsten Zeile.
   - Filter blenden Fragen live ein und aus (Abschnitt 5).
   - Kein Pflichtzwang. Beim Verlassen einer Seite mit unbeantworteten sichtbaren Fragen erscheint ein Hinweis: „2 Fragen sind noch offen – trotzdem weiter?“
5. **Abschluss:** „Vielen Dank! Bitte geben Sie das Gerät zurück.“ Die Antworten werden danach **nicht mehr angezeigt**. Die Doktorandin sieht nur „abgeschlossen“ mit Dauer und Anzahl der Antworten.
6. **Rückkehr zur Doktorandin:** Ein langer Druck (2 s) auf „Zurück zur Studienansicht“ führt zur Exportseite. Damit gelangt die teilnehmende Person nicht versehentlich in andere Daten. Export wie bei Blöcken (Teilen-Menü, Download, Mail, Zwischenablage; Status `offen → exportiert → bestaetigt`).
7. **Unterbrechung:** Jede Antwort wird sofort gespeichert. Wird die App geschlossen, kann der Fragebogen auf der Startseite unter „Nicht abgeschlossene Fragebögen“ fortgesetzt werden, an derselben Stelle.

Während eines laufenden Beobachtungsblocks kann kein Fragebogen gestartet werden und umgekehrt.

## 2a. Zuordnung zu Probanden und Logbuch

Die App muss alle Beobachtungsblöcke, Fragebögen und Versuche („nicht angetroffen“) jederzeit dem jeweiligen Probanden zuordnen und daraus ein Logbuch führen können. Grundlage ist ausschließlich der Studien-Code; Namen werden nie gespeichert.

### Teilnehmerliste (nur Codes)

- Neuer Menüpunkt „Teilnehmende“. Die Doktorandin legt dort bei der Registrierung jeden Studien-Code an, mit Bereich und optional einer Notiz ohne Namen (Hinweis am Feld).
- Store `teilnehmende`: `pseudonym` (Schlüssel), `bereich`, `registriertTs`, `status` (`aktiv` · `widerrufen` · `ausgeschieden`), `statusTs`, `notiz`.
- **Auswahl statt Eintippen:** Beim Start eines Blocks, Fragebogens oder Versuchs wird der Code aus dieser Liste gewählt (Suchfeld). Freies Eintippen ist nur noch über „Neuen Code anlegen“ möglich. Das verhindert Tippfehler, die eine spätere Zuordnung unmöglich machen.
- Bei Status `widerrufen` oder `ausgeschieden` kann für diesen Code nichts Neues mehr erfasst werden; der Code bleibt im Logbuch sichtbar.
- Die Liste lässt sich als CSV exportieren und auf einem zweiten Gerät importieren (gleiche Codes auf allen Geräten).

### Logbuch-Ansicht

Pro Studien-Code eine Übersicht, sortiert nach Code:

| Spalte | Inhalt |
| --- | --- |
| Code, Bereich, Status | `P017`, NEPH, aktiv |
| Beobachtung Prä | Anzahl abgeschlossener Blöcke / Ziel (z. B. „3 / 5“), Summe beobachtete Minuten, Anzahl Abbrüche |
| Beobachtung Post | wie Prä |
| Versuche | Anzahl „nicht angetroffen“ |
| FB1 · KB · FB2 | je: offen / abgeschlossen (Datum, APP oder PAPIER) |
| Export | Anzahl nicht exportierter bzw. nicht bestätigter Einträge |

- Ziel pro Phase konfigurierbar (`zielBloeckeProPhase: 5`). Codes unter Ziel werden markiert, ebenso fehlende Fragebögen zum jeweiligen Zeitpunkt.
- Tippen auf einen Code zeigt die Einzelliste aller Einträge (Datum, Uhrzeit, Art, Phase, Dauer, Status). Antworten aus Fragebögen werden dort **nicht** angezeigt.

### Logbuch bleibt auch nach dem Löschen erhalten

- Beobachtungs- und Fragebogendaten werden nach bestätigtem Export gelöscht (siehe Hauptplan). Damit das Logbuch vollständig bleibt, legt die App für jeden Eintrag zusätzlich einen **Logbuch-Eintrag ohne Inhaltsdaten** an.
- Store `logbuch`: `eintragId` (= `blockId` / `sitzungId` / `versuchId`), `pseudonym`, `art` (`BLOCK` · `FB1` · `KB` · `FB2` · `VERSUCH`), `phase`, `bereich`, `startTs`, `endTs`, `beobachtetSek`, `status` (z. B. `beendet`, `abgebrochen`, `abgeschlossen`), `abbruchCode`, `erhebungsmodus`, `exportStatus`, `geraeteId`, `testmodus`.
- Dieser Store wird beim Löschen bestätigter Daten **nicht** geleert. Gelöscht wird er nur über einen eigenen, doppelt bestätigten Menüpunkt am Studienende.

### Logbuch-Export

- **Dateiname:** `HXNOW_LOGBUCH_<geraeteId-8>_<JJJJMMTT>.csv`
- **Format** wie die übrigen Exporte: UTF-8 mit BOM, Semikolon, eine Zeile pro Logbuch-Eintrag, Spalten wie Store `logbuch`.
- Das Zusammenführungstool erzeugt aus den Logbüchern **aller Geräte** und den eingegangenen Datendateien ein Gesamt-Logbuch. Es meldet:
  - Einträge im Logbuch ohne zugehörige Datendatei (Export fehlt)
  - Datendateien ohne Logbuch-Eintrag
  - Codes, die nicht in der Teilnehmerliste stehen
  - Codes unter Ziel bzw. mit fehlenden Fragebögen
- Testmodus-Einträge werden im Logbuch angezeigt, aber gekennzeichnet und aus den Zählungen ausgenommen.

## 3. Definitionsdatei `js/frageboegen.js`

Eine einzige Datei im Code, als ES-Modul exportiert. Struktur (verbindlich):

```js
export const FRAGEBOGEN_DEFINITION = {
  definitionVersion: "1.0.0",          // SemVer, siehe Abschnitt 4
  stand: "2026-11-08",
  boegen: [
    {
      id: "FB1",
      titel: "Fragebogen 1 – Ausgangslage vor Einführung von HX Now",
      phase: "PRE",
      einleitung: "Bearbeitungszeit ca. 14 Minuten. …",
      abschnitte: [
        {
          id: "A", titel: "Angaben zur Person",
          items: [
            { id: "A1", v: 1, typ: "einfach", text: "Alter",
              optionen: [[1, "< 30 Jahre"], [2, "30–39 Jahre"], [3, "40–49 Jahre"], [4, "≥ 50 Jahre"]] },
            { id: "A3", v: 1, typ: "einfach", text: "Funktion",
              optionen: [[1, "Assistenzärztin/-arzt"], [2, "Fachärztin/-arzt"], [3, "Oberärztin/-arzt"], [9, "Sonstiges"]],
              freitextBei: 9 },
            { id: "A6", v: 1, typ: "prozentgruppe", text: "In welchen Bereichen …?", summe: 100,
              zeilen: [["STAT", "Station"], ["AMB", "Ambulanz"], ["FUNK", "Funktionsbereich (z. B. Dialyse)"],
                       ["ZNA_BEH", "Notaufnahme: Behandlungsbereich"], ["ZNA_STAT", "Notaufnahme: Notaufnahmestation"], ["SONST", "Sonstiges"]],
              freitextBei: "SONST" }
          ]
        },
        {
          id: "D", titel: "Erwartungen an HX Now (TAM)",
          items: [
            { id: "D1", v: 1, typ: "skala", min: 1, max: 7, anker: ["stimme gar nicht zu", "teils/teils", "stimme voll zu"],
              text: "Mit HX Now werde ich meine Aufgaben schneller erledigen können.",
              skala: "TAM_PU", paar: "TAM_PU_1" }
          ]
        }
      ]
    }
  ]
};
```

**Fragetypen:** `info`, `text`, `freitext`, `zahl` (min/max), `einfach`, `mehrfach`, `skala` (min/max, Anker), `prozentgruppe` (Zeilen mit Ankreuzen + Prozent, Summe), `matrix` (Zeilen × Spaltengruppen, z. B. W3 mit Gruppe A „Wie oft?“ und Gruppe B „Wie gelöst?“).

**Weitere Item-Felder:**
- `showIf`: Filterbedingung (Abschnitt 5)
- `keineAngabe: true`: zusätzliche Option „keine Angabe“ (Code −99)
- `skala`: Zugehörigkeit zu einem Score (z. B. `ATI`, `TAM_PU`, `TAM_PEOU`, `TAM_BI`, `SUS`)
- `umpolen: true`: Hinweis für das Scoring (ATI C3, C6, C8; SUS gerade Items)
- `paar`: Paar-ID für Vorher-Nachher-Vergleiche (Abschnitt 4.3)

**Inhalte:**
- **FB1:** vollständig und wortgetreu aus `Fragebogen1_Baseline_v0.3`
- **KB (Kurzbogen Gewöhnung):** G1–G4
- **FB2:** Zwei-Wochen-Teil Post (W1–W8) und Abschluss (SUS, TAM, C, D) aus Version 0.1, dazu die technische Evaluation, sobald der Wortlaut freigegeben ist. Bis dahin ist FB2 als `status: "entwurf"` markiert. Die App zeigt dann einen Hinweis und erlaubt nur den Testmodus.

## 4. Änderungen per Update ohne Verlust der Vergleichbarkeit

### 4.1 Stabile Item-IDs

- Jede Frage und jede Matrixzelle hat eine **dauerhafte ID**. Matrixzellen werden aus Zeile und Spaltengruppe gebildet, z. B. `W3_01_A` (Situation 1, Häufigkeit) und `W3_01_B` (Situation 1, Lösung).
- **Eine ID wird nie wiederverwendet** und nie für eine andere Bedeutung genutzt.
- **Gleiche Frage in mehreren Bögen = gleiche ID:** Die Situationstabelle heißt in FB1 und FB2 `W3_xx_A/B`. Unterschieden wird über die Spalte `bogen`.

### 4.2 Versionierung

- `definitionVersion` (SemVer) für die gesamte Datei. Jedes Item hat zusätzlich `v` (Item-Version, Ganzzahl).

| Änderung | Regel |
| --- | --- |
| Tippfehler, Formatierung, Hinweistext | `v` bleibt, Patch-Version +1 |
| Umformulierung ohne Bedeutungsänderung | `v` +1, Minor-Version +1 |
| Neue Antwortoption, andere Skala, andere Bedeutung | **neue ID** (z. B. `B4b`), alte ID bleibt in der Definition mit `entfernt: true` |
| Neue Frage | neue ID, Minor-Version +1 |
| Frage entfernen | `entfernt: true`, wird nicht mehr angezeigt, ID bleibt reserviert |

### 4.3 Paar-IDs für den Vorher-Nachher-Vergleich

Items, die zwischen Baseline und Regelbetrieb verglichen werden, tragen dieselbe `paar`-ID, auch wenn der Wortlaut abweicht (z. B. „wird … sein“ vs. „ist …“).

| Paar-ID | FB1 (Baseline) | KB | FB2 (Regelbetrieb) |
| --- | --- | --- | --- |
| `W3_xx_A`, `W3_xx_B` | W3 Zeilen 1–10 | – | W3 Zeilen 1–10 (gleiche IDs) |
| `INFO_HAEUF_ART`, `INFO_HAEUF_ORT`, `INFO_HAEUF_LOES`, `INFO_HAEUF_DAUER` | W4a–W4d | G3 (nur Lösung) | W6a–W6d |
| `TAM_PU_1` … `TAM_PU_6` | D1–D6 | – | B1–B6 |
| `TAM_PEOU_1` … `TAM_PEOU_6` | D7–D12 | – | B7–B12 |
| `TAM_BI_1`, `TAM_BI_2` | D13–D14 | – | entsprechende Items in FB2 |
| `FUNK_NUTZEN_1` … `_7` | E1–E7 (erwartet) | – | Nützlichkeit je Funktion (erlebt) |
| `FUNK_HAEUF_1` … `_7` | – | G2 | W5 |
| `GERAET_DABEI` | – | G1 | W4 |
| `ABSCHALTEN` | F1 | – | entsprechendes Item in FB2 |
| `IT_STRESS` | F2 | – | entsprechendes Item in FB2 |

### 4.4 Schutz der gepaarten Items (automatischer Test)

- `tests/unit/definition.test.js` vergleicht alle Items mit `paar`-ID gegen einen eingefrorenen Schnappschuss (`tests/fixtures/paar_items_snapshot.json`): Typ, Optionen bzw. Codes, Skala min/max, Umpolung.
- Weicht etwas ab, schlägt der Test fehl. Eine Änderung an einem gepaarten Item ist nur möglich, wenn der Schnappschuss bewusst aktualisiert und der Grund in `CHANGELOG.md` dokumentiert wird.
- **Ab dem ersten echten FB1-Export** gilt: gepaarte Items in FB2 dürfen in Antwortcodes und Skalen nicht mehr von FB1 abweichen.

### 4.5 Codebuch aus der App

- Menü „Info → Codebuch exportieren“ erzeugt aus der eingebauten Definition eine CSV.
- Spalten: `bogen;abschnitt;item_id;v;paar;typ;text;optionen;min;max;skala;umpolen;showIf;entfernt`
- So passen Codebuch und App-Version immer zusammen. Das Codebuch jeder freigegebenen Version wird mit eingecheckt (`docs/codebuch/codebuch_<definitionVersion>.csv`).

## 5. Filterlogik (`showIf`)

Dieselbe einfache Syntax wie im Zusammenführungstool, ohne `eval()`: `ID = Wert`, `ID != Wert`, `ID > Wert`, `UND`, `ODER`, Klammern. Für Mehrfach- und Prozentgruppen gilt `A6.ZNA_BEH = 1` (angekreuzt).

Regeln für FB1 (Version 0.3):

| Item | showIf / Verhalten |
| --- | --- |
| A3 Freitext | `A3 = 9` |
| A6 Prozentfelder | nur für angekreuzte Zeilen; bei genau einer Zeile automatisch 100 %, sonst Summe 100 Pflicht |
| A6 Freitext | `A6.SONST = 1` |
| W2 | `A8 = 1`, sonst automatisch 0 |
| W3 Zeile 9 (Bereitschaft/Nacht) | `A8 = 1` |
| W3 Zeile 6 (Behandlungsbereich ZNA) | `A6.ZNA_BEH = 1` |
| W3 Zeile 4 (Visite) | `A6.STAT = 1 ODER A6.ZNA_STAT = 1` |
| W2–W5 (ganzer Abschnitt) | `W1 > 0` |
| W3_xx_B (Lösung) | `W3_xx_A > 0` (Code für „0“ = 0) |
| W4a–W4d | mindestens ein `W3_xx_A > 0` |
| W4b Option „Bereitschafts-/Nachtdienst“ | nur bei `A8 = 1` |
| W4b Option „Behandlungsbereich Notaufnahme“ | nur bei `A6.ZNA_BEH = 1` |
| W4d | `W4c != 5` (5 = verzichtet); sonst automatisch „gar nicht“ |
| C (ATI), D (TAM), E (Funktionen), F | immer vollständig anzeigen |

Für FB2 gelten dieselben Regeln sinngemäß, zusätzlich:
- Nützlichkeit je Funktion nur, wenn die Funktion in W5 mindestens einmal genutzt wurde.
- Fragen zur Nutzung von HX Now nur, wenn HX Now überhaupt genutzt wurde.

Die Filter beziehen sich auf frühere Antworten **im selben Bogen**. Antworten aus FB1 werden in FB2 nicht übernommen, da in der App keine Personendaten zwischen Bögen verknüpft werden.

## 6. Speicherung und Export

### 6.1 IndexedDB

- Store `fb_sitzungen`: `sitzungId`, `geraeteId`, `appVersion`, `definitionVersion`, `bogen`, `pseudonym`, `bereich`, `erhebungsmodus` (`APP` / `PAPIER`), `papierDatum`, `startTs`, `endTs`, `status` (`laufend` / `abgeschlossen` / `abgebrochen`), `seitenzeiten` (Sekunden je Abschnitt), `exportStatus`
- Store `fb_antworten`: `sitzungId`, `itemId`, `v`, `wert`, `wertText`, `ts`; wird nach jeder Eingabe geschrieben.

### 6.2 CSV (Long-Format, für alle Bögen und Versionen identisch)

**Dateiname:** `HXNOW_FB_<bogen>_<pseudonym>_<JJJJMMTT>_<HHMM>_<sitzungId-8>.csv` (Testmodus: `HXNOW_TEST_FB_…`)

**Format:** UTF-8 mit BOM, Semikolon, `\r\n`, RFC-4180-Quoting. **Eine Zeile pro Item bzw. Matrixzelle bzw. Mehrfachoption**, auch für nicht angezeigte Items.

| Spalte | Beispiel | Hinweis |
| --- | --- | --- |
| `datensatz` | `antwort` | |
| `sitzung_id`, `geraete_id` | UUID | |
| `app_version`, `definition_version` | `0.6.0`, `1.0.0` | |
| `bogen` | `FB1` | |
| `pseudonym`, `bereich` | `P017`, `NEPH` | |
| `erhebungsmodus` | `APP` / `PAPIER` | |
| `papier_datum` | leer oder Datum | |
| `start`, `ende`, `dauer_sek` | ISO-Zeit mit Offset, Sekunden | Paradaten |
| `abschnitt` | `W` | |
| `abschnitt_dauer_sek` | `214` | Paradaten |
| `item_id`, `item_v` | `W3_01_A`, `1` | |
| `paar` | `W3_01_A` oder leer | |
| `typ` | `matrix` | |
| `wert` | `2` | Code, Zahl oder 0/1 |
| `wert_text` | Freitext | nur bei Text |
| `status` | `beantwortet` · `ausgelassen` · `gefiltert` · `keine_angabe` | |
| `n_zeilen` | `142` | Vollständigkeitsprüfung |

**Codes für fehlende Werte in `wert`:** leer bei `ausgelassen`, `-88` bei `gefiltert`, `-99` bei `keine_angabe`.

Warum Long-Format: Zusätzliche, entfernte oder umformulierte Items verändern die Spaltenstruktur nicht. Dateien aus verschiedenen App-Versionen lassen sich ohne Anpassung zusammenführen. Die breite Tabelle für die Auswertung erzeugt das Zusammenführungstool.

## 7. Erweiterung des Zusammenführungstools

- Liest Beobachtungs- **und** Fragebogen-Dateien (erkennt sie am Präfix).
- Liest das passende Codebuch (eingebettet oder per Dateiauswahl) und prüft jede `item_id` gegen die Definition.
- **Prüfungen:**
  - Zeilenzahl = `n_zeilen`
  - doppelte Bögen pro Pseudonym (gleicher `bogen` mehrfach)
  - Prozentsumme A6
  - Codes außerhalb des Wertebereichs
  - abweichende `definition_version` innerhalb eines Bogens (Hinweis)
  - gepaarte Items mit abweichenden Codes (Fehler)
- **Ausgaben:**
  - `fb_long.csv`: alle Antworten
  - `fb1_wide.csv`, `kb_wide.csv`, `fb2_wide.csv`: eine Zeile pro Person, Spalten = `item_id`
  - `prae_post.csv`: eine Zeile pro Person und Paar-ID mit Wert FB1, (KB), FB2 und Differenz
  - `scores.csv`: ATI (Mittelwert, C3/C6/C8 umgepolt), TAM PU/PEOU/BI (Mittelwerte), SUS (0–100), je Person und Bogen
  - Zusätzliche Zeilen im `pruefbericht.txt`

## 8. Datenschutz

- Kein Namensfeld; Freitext-Hinweis „Keine Namen eintragen“.
- Antworten werden nach Abschluss nicht mehr angezeigt; die Doktorandin sieht nur den Status.
- Speicherung und Export wie bei Beobachtungsdaten (lokal, Export auf Klinikumssysteme, Löschen erst nach bestätigtem Eingang).

## 9. Tests

- **Unit:**
  - Filterauswertung für jede Regel aus Abschnitt 5
  - CSV-Erzeugung gegen Referenzdatei
  - Status- und Fehlwertcodes
  - Prozentgruppe
  - Paar-Snapshot-Test (4.4)
  - Eindeutigkeit aller IDs über alle Bögen
- **Versionstest:**
  - Zwei Definitionen (1.0.0 und eine künstliche 1.1.0 mit neuer und entfernter Frage) erzeugen Exporte.
  - Das Zusammenführungstool führt beide fehlerfrei zusammen.
  - Gepaarte Werte landen in derselben Spalte.
- **E2E (Playwright, iPhone-Profil):**
  - FB1 komplett ausfüllen mit Filterpfaden (A8 = nein, W1 = 0, alle W3 = 0)
  - Unterbrechung und Fortsetzen
  - Papier-Nacherfassung
  - Export
- **Logbuch:**
  - Blöcke, Versuche und Fragebögen für drei Codes anlegen, exportieren, bestätigen und löschen. Das Logbuch zeigt danach weiterhin alle Einträge mit korrekten Zählungen.
  - Das Zusammenführungstool erkennt eine absichtlich fehlende Datendatei.
- **Manuell (iPhone):** Ausfülldauer messen, Bedienung durch zwei Testpersonen (Pretest), Lesbarkeit der Matrixfrage W3 im Hochformat.

## 10. Umsetzung in Phasen

| Phase | Inhalt | Abnahmekriterien |
| --- | --- | --- |
| **F0. Definition** | `frageboegen.js` mit FB1 (vollständig), KB, FB2 (Entwurf); ID- und Paar-Schema; Codebuch-Export; Snapshot-Test. | Codebuch-CSV enthält jede Frage aus der Papierfassung FB1 v0.3 genau einmal; alle Tests grün. |
| **F1. Renderer** | Darstellung aller Fragetypen, Seiten, Fortschritt, automatischer Sprung zur nächsten Zeile, Matrix W3 lesbar auf dem iPhone (ggf. zeilenweise als Karten). | FB1 vollständig bedienbar im iPhone-Profil; keine horizontale Scrollleiste. |
| **F2. Filter und Hinweise** | `showIf`-Engine, Automatikwerte (W2 = 0, A6 = 100 %, W4d), Hinweis auf offene Fragen. | Alle Filterregeln aus Abschnitt 5 per Test bestätigt. |
| **F3. Ablauf und Speicherung** | Vorbereitung, Übergabebildschirm, Abschluss, Rückkehr per langem Druck, Fortsetzen nach Unterbrechung, Papier-Nacherfassung. | Neustart der App mitten im Bogen → Fortsetzen an derselben Stelle ohne Datenverlust. |
| **F3b. Teilnehmerliste und Logbuch** | Store `teilnehmende` und `logbuch`, Code-Auswahl statt Eintippen, Logbuch-Ansicht mit Zielerreichung, Logbuch-Export, Import/Export der Teilnehmerliste. | Nach Löschen bestätigter Daten sind alle Einträge weiter im Logbuch; für einen widerrufenen Code ist keine neue Erfassung möglich; Zählungen stimmen mit den Exporten überein. |
| **F4. Export** | CSV nach 6.2, Exportwege und Status wie bei Blöcken. | Referenzdatei stimmt; alle Items inkl. gefilterter erscheinen; `n_zeilen` korrekt. |
| **F5. Zusammenführung** | Erweiterung nach Abschnitt 7, Scores, Prä-Post-Tabelle. | Versionstest (Abschnitt 9) bestanden; Scores stimmen mit Handrechnung überein. |
| **F6. Dokumentation** | Anleitung für die Doktorandin (Fragebogen-Ablauf, Papier-Nacherfassung), CHANGELOG, Regeln aus Abschnitt 4 im README. | Eine Person ohne Vorkenntnisse kann einen Fragebogen durchführen und exportieren. |

## 11. Offene Punkte

1. **FB2 Wortlaut:** Technische Evaluation (Probleme, Nützlichkeit je Funktion, Qualität einzelner Funktionen, Weiterempfehlung, IT-Stress, Nutzungsabsicht, Abschalten) muss vor dem Einsatz freigegeben werden; danach `status: "entwurf"` entfernen.
2. **Pretest:** Nach dem Pretest mit zwei externen Ärztinnen bzw. Ärzten Wortlaut festschreiben, `definitionVersion` 1.0.0 vergeben und Snapshot erzeugen. Erst danach echte Erhebung.
3. **Paar-Items FB2:** Wortlaut und IDs der FB2-Gegenstücke zu D13–D14, E1–E7, F1 und F2 festlegen.
4. **Papier und App:** Papierbögen werden aus derselben Definition erzeugt bzw. abgeglichen; bei jeder Definitionsänderung auch die Papierfassung aktualisieren.
