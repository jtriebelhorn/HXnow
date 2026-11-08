# Fragebogen 2 (FB2) – Ende des Regelbetriebs mit HX Now

- `bogen`: FB2 · `phase`: POST · Zeitpunkt: am Ende des Regelbetriebs
- Version: 0.3 vom 08.11.2026 (Entwurf, vor Pretest; in der App `status: "entwurf"` bis zur Freigabe)
- Bearbeitungszeit: ca. 18 Minuten
- Einleitung wie FB1
- Kopfdaten (setzt die Doktorandin): Studien-Code, Datum, Bereich
- Hinweis: Antworten aus FB1 stehen in FB2 nicht zur Verfügung; alle Filter beziehen sich auf FB2 selbst.

## Konventionen (gelten für alle Bögen)

**Aufbau eines Items**
`### <ID> · <Typ>` gefolgt von Fragetext und Feldern:
- `optionen`: `Code = Beschriftung`, getrennt durch ` | `
- `zeilen` (Matrix, Prozentgruppe): `Suffix = Beschriftung`; Zell-ID = `<ID>_<Suffix>_<Spaltengruppe>` (z. B. `W3_01_A`)
- `skala`: Bereich und Anker; `score`: Zugehörigkeit zu einem Score; `umpolen`: ja
- `paar`: Paar-ID für den Vorher-Nachher-Vergleich (siehe Plan, Abschnitt 4.3)
- `showIf`: Bedingung, unter der das Item angezeigt wird. **Nicht erfüllt → ausblenden, Wert `-88` (gefiltert).**
- `autoWert`: Wert, der bei ausgeblendetem Item automatisch gesetzt wird (statt `-88`).
- `zeileShowIf` / `spalteShowIf`: einzelne Matrixzeilen bzw. Spaltengruppen einer Zeile ausblenden (einklappen).
- `optionShowIf`: einzelne Antwortoptionen ausblenden.
- `softSkip`: Hinweis mit Rückfrage („… überspringen?“). Bei „Ja“ werden die genannten Abschnitte ausgeblendet (`-88`), bei „Nein“ normal angezeigt.
- `validierung`: Prüfregel vor dem Weiterblättern (weicher Hinweis, kein Zwang).

**Bedingungssyntax** (kein `eval`): `ID = Wert`, `ID != Wert`, `ID > Wert`, `ID < Wert`, `ID IN (a, b)`, `UND`, `ODER`, Klammern.
Zusätzlich: `IRGENDEIN(<Muster>) > 0` / `ALLE(<Muster>) = 0` für Matrixspalten, z. B. `IRGENDEIN(W3_*_A) > 0`.
Eine Bedingung auf ein Item, das selbst ausgeblendet oder unbeantwortet ist, gilt als **nicht erfüllt**, außer bei `ODER UNBEKANNT(ID)` (dann wird angezeigt).

**Fehlwerte:** leer = sichtbar, aber nicht beantwortet · `-88` = durch Filter ausgeblendet · `-99` = keine Angabe (nur wo als Option vorgesehen) · `9` = „nicht genutzt“ (nur wo als Option vorgesehen; kein Skalenwert, wird bei Scores ausgeschlossen).

**Häufigkeitscodes 14 Tage** (W3 Spalte A, W5, G2): `0 = 0 bzw. nie | 1 = 1–3 | 2 = 4–10 | 3 = 11–20 | 4 = > 20`

**Darstellung:** eine Seite pro Abschnitt; bei Skalen und Matrizen nach Tipp automatisch zur nächsten Zeile; Matrix im Hochformat zeilenweise als Karte zulässig. Skalen (ATI, TAM, SUS, E, F, T) sind nie teilweise ausgeblendet, außer über ausdrücklich genannte Regeln.

---

## Abschnitt W · Informationsbedarf und Nutzung in den letzten 14 Tagen

### W1 · zahl

An wie vielen Tagen hatten Sie in den letzten 14 Tagen Dienst?

- `min`: 0
- `max`: 14
- `einheit`: Tage
- `hinweis`: W1 = 0 → alle weiteren Items von Abschnitt W ausblenden (`-88`), weiter mit dem Hinweis vor Abschnitt A

### W2 · zahl

Davon Bereitschafts- oder Nachtdienste:

- `min`: 0
- `max`: 14
- `showIf`: `W1 > 0`
- `validierung`: `W2 <= W1`

*Info:* Informationsbedarf abseits eines PCs: Sie benötigten eine patientenbezogene Information (z. B. Laborwert, Befund, Bildgebung, Medikation), während kein stationärer Arbeitsplatz-PC unmittelbar erreichbar war. Sofort vor Ort: ohne Ortswechsel, Anruf oder Aufschub, z. B. über HX Now, einen Visitenwagen oder Papierunterlagen. (`showIf`: `W1 > 0`)

### W3 · matrix

Bitte geben Sie für jede Situation an, wie oft in den letzten 14 Tagen Informationsbedarf abseits eines PCs entstand (A), wie Sie ihn überwiegend gelöst haben (B) und ob Sie dabei HX Now genutzt haben (C).

- `zeilen`:
  - 01 = Auf Wegstrecken (Flur, zwischen Stationen)
  - 02 = In Wartesituationen (z. B. Aufzug, vor Untersuchung)
  - 03 = Am Patientenbett / im Patientenzimmer
  - 04 = Während der Visite
  - 05 = Bei der Übergabe
  - 06 = Im Behandlungsbereich der Notaufnahme
  - 07 = Außerhalb des eigenen Bereichs (z. B. Konsil, andere Station)
  - 08 = In Pausen
  - 09 = Im Bereitschafts- bzw. Nachtdienst
  - 10 = Vor Dienstbeginn oder nach Dienstende
- `spalten`:
  - A „Wie oft?“: 0 = 0 | 1 = 1–3 | 2 = 4–10 | 3 = 11–20 | 4 = > 20
  - B „Wie überwiegend gelöst?“: 1 = sofort vor Ort | 2 = Weg zum PC | 3 = Anruf / Rückfrage | 4 = Aufschub | 5 = Verzicht
  - C „HX Now genutzt?“: 1 = nie | 2 = teils | 3 = meist
- `paar`: A und B identisch mit FB1 (`W3_<Zeile>_A`, `W3_<Zeile>_B`); C nur in FB2
- `showIf`: `W1 > 0`
- `zeileShowIf`: Zeile 09 (Bereitschafts-/Nachtdienst): `W2 > 0 ODER UNBEKANNT(W2)`
- `spalteShowIf`: Spalten B und C einer Zeile nur bei `W3_<Zeile>_A > 0` (einklappen), sonst `-88`

### W4 · einfach

Wie oft hatten Sie in den letzten 14 Tagen ein Gerät mit HX Now bei sich?

- `optionen`: 1 = nie | 2 = selten | 3 = meistens | 4 = immer
- `paar`: `GERAET_DABEI`
- `showIf`: `W1 > 0`

### W5 · matrix

Wie oft haben Sie die folgenden Funktionen in den letzten 14 Tagen genutzt?

- `zeilen`:
  - 1 = Krankenakte / Verlauf einsehen
  - 2 = Laborwerte einsehen
  - 3 = Bildgebung (PACS-Viewer)
  - 4 = PMDs bearbeiten (z. B. Basisanamnese, Konsil)
  - 5 = Fotodokumentation
  - 6 = Dokumentenscan
  - 7 = Sprachgestützte Dokumentation
- `spalten`:
  - Anzahl in den letzten 14 Tagen: 0 = nie | 1 = 1–3× | 2 = 4–10× | 3 = 11–20× | 4 = > 20×
- `paar`: `FUNK_HAEUF_<1–7>` (Zell-ID `W5_<k>`)
- `showIf`: `W1 > 0 UND W4 != 1`
- `autoWert`: alle `W5_<k>` = 0, wenn `W4 = 1` (Gerät nie dabei)

### W6a · einfach

Denken Sie an den Informationsbedarf abseits eines PCs, der in den letzten 14 Tagen am häufigsten vorkam. Welche Information wurde am häufigsten benötigt?

- `optionen`: 1 = Laborwerte | 2 = Befunde/Bildgebung | 3 = Vorbefunde/Arztbriefe | 4 = Medikation | 5 = Verlauf/Kurve | 9 = Sonstiges
- `freitextBei`: 9 → `W6a_TXT`
- `paar`: `INFO_HAEUF_ART`
- `showIf`: `W1 > 0 UND IRGENDEIN(W3_*_A) > 0`

### W6b · einfach

Wo entstand dieser Bedarf meistens?

- `optionen`: 1 = Flur/Wegstrecke | 2 = Patientenzimmer | 3 = Visite | 4 = Übergabe | 5 = Behandlungsbereich Notaufnahme | 6 = anderer Bereich | 7 = Bereitschafts-/Nachtdienst
- `paar`: `INFO_HAEUF_ORT`
- `showIf`: `W1 > 0 UND IRGENDEIN(W3_*_A) > 0`
- `optionShowIf`: 7 (Bereitschafts-/Nachtdienst): `W2 > 0 ODER UNBEKANNT(W2)`

### W6c · einfach

Wie haben Sie ihn meistens gelöst?

- `optionen`: 1 = mit HX Now | 2 = anders vor Ort (z. B. Visitenwagen) | 3 = Weg zum PC | 4 = Anruf / Rückfrage | 5 = aufgeschoben | 6 = verzichtet
- `paar`: `INFO_HAEUF_LOES`; für den Vergleich mit FB1 umkodieren: 1 und 2 → 1 („sofort vor Ort“), 3 → 2, 4 → 3, 5 → 4, 6 → 5
- `showIf`: `W1 > 0 UND IRGENDEIN(W3_*_A) > 0`

### W6d · einfach

Wie lange dauerte es typischerweise, bis Sie die Information hatten?

- `optionen`: 1 = sofort | 2 = < 5 Minuten | 3 = 5–30 Minuten | 4 = > 30 Minuten | 5 = gar nicht
- `paar`: `INFO_HAEUF_DAUER`
- `showIf`: `W1 > 0 UND IRGENDEIN(W3_*_A) > 0 UND W6c != 6`
- `autoWert`: `5` (gar nicht), wenn `W6c = 6`

### W7a · einfach

Wofür haben Sie HX Now in den letzten 14 Tagen am häufigsten genutzt? Häufigster Verwendungszweck

- `optionen`: 1 = Laborwerte | 2 = Befunde/Bildgebung | 3 = Vorbefunde/Arztbriefe | 4 = Verlauf/Kurve | 5 = PMD-Dokumentation | 6 = Sprachdokumentation | 7 = Foto/Scan | 9 = Sonstiges
- `freitextBei`: 9 → `W7a_TXT`
- `showIf`: `W1 > 0 UND` `IRGENDEIN(W5_*) > 0 ODER IRGENDEIN(W3_*_C) > 1`

### W7b · einfach

Wo nutzten Sie HX Now dafür meistens?

- `optionen`: 1 = Flur/Wegstrecke | 2 = Patientenzimmer | 3 = Visite | 4 = Übergabe | 5 = Behandlungsbereich Notaufnahme | 6 = anderer Bereich | 7 = Bereitschafts-/Nachtdienst | 8 = Pause
- `showIf`: `W1 > 0 UND` `IRGENDEIN(W5_*) > 0 ODER IRGENDEIN(W3_*_C) > 1`

### W7c · einfach

Was hätten Sie ohne HX Now meistens getan?

- `optionen`: 1 = Weg zum PC | 2 = Anruf / Rückfrage | 3 = aufgeschoben | 4 = verzichtet | 5 = anders vor Ort gelöst (z. B. Visitenwagen)
- `showIf`: `W1 > 0 UND` `IRGENDEIN(W5_*) > 0 ODER IRGENDEIN(W3_*_C) > 1`

### W8 · freitext

Möchten Sie etwas zu den letzten 14 Tagen anmerken?

- `showIf`: `W1 > 0`
- `hinweis`: optional; Hinweis „Keine Namen eintragen“

*Info:* Vor Abschnitt A: „Bitte beziehen Sie sich in den folgenden Abschnitten auf Ihre gesamte Erfahrung mit HX Now.“

### Weiche Sprungregel bei Nichtnutzung

- Bedingung: `W1 > 0 UND ALLE(W5_*) = 0 UND ALLE(W3_*_C) IN (1, -88)` (HX Now offenbar nicht genutzt)
- `softSkip`: Hinweis „Sie haben HX Now in den letzten 14 Tagen offenbar nicht genutzt. Möchten Sie die Fragen zur Bewertung der App (Abschnitte A, B, E, T) überspringen?“
- „Ja“ → Abschnitte A, B, E, T ausblenden (`-88`); C, F, D werden weiter gestellt. „Nein“ → normal fortfahren.

## Abschnitt A · Gebrauchstauglichkeit (System Usability Scale, SUS)

### A1 · skala

Ich denke, dass ich HX Now gerne häufig benutzen würde.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme nicht zu · 3 = unentschieden · 4 = stimme eher zu · 5 = stimme voll zu)
- `score`: SUS (ungerade: Wert − 1; gerade: 5 − Wert; Summe × 2,5)

### A2 · skala

Ich fand HX Now unnötig komplex.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme nicht zu · 3 = unentschieden · 4 = stimme eher zu · 5 = stimme voll zu)
- `score`: SUS (ungerade: Wert − 1; gerade: 5 − Wert; Summe × 2,5)
- `umpolen`: ja

### A3 · skala

Ich fand HX Now einfach zu benutzen.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme nicht zu · 3 = unentschieden · 4 = stimme eher zu · 5 = stimme voll zu)
- `score`: SUS (ungerade: Wert − 1; gerade: 5 − Wert; Summe × 2,5)

### A4 · skala

Ich glaube, ich würde die Hilfe einer technisch versierten Person benötigen, um HX Now benutzen zu können.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme nicht zu · 3 = unentschieden · 4 = stimme eher zu · 5 = stimme voll zu)
- `score`: SUS (ungerade: Wert − 1; gerade: 5 − Wert; Summe × 2,5)
- `umpolen`: ja

### A5 · skala

Ich fand, die verschiedenen Funktionen in HX Now waren gut integriert.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme nicht zu · 3 = unentschieden · 4 = stimme eher zu · 5 = stimme voll zu)
- `score`: SUS (ungerade: Wert − 1; gerade: 5 − Wert; Summe × 2,5)

### A6 · skala

Ich denke, HX Now enthielt zu viele Inkonsistenzen.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme nicht zu · 3 = unentschieden · 4 = stimme eher zu · 5 = stimme voll zu)
- `score`: SUS (ungerade: Wert − 1; gerade: 5 − Wert; Summe × 2,5)
- `umpolen`: ja

### A7 · skala

Ich kann mir vorstellen, dass die meisten Menschen den Umgang mit HX Now sehr schnell lernen.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme nicht zu · 3 = unentschieden · 4 = stimme eher zu · 5 = stimme voll zu)
- `score`: SUS (ungerade: Wert − 1; gerade: 5 − Wert; Summe × 2,5)

### A8 · skala

Ich fand HX Now sehr umständlich zu nutzen.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme nicht zu · 3 = unentschieden · 4 = stimme eher zu · 5 = stimme voll zu)
- `score`: SUS (ungerade: Wert − 1; gerade: 5 − Wert; Summe × 2,5)
- `umpolen`: ja

### A9 · skala

Ich fühlte mich bei der Benutzung von HX Now sicher.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme nicht zu · 3 = unentschieden · 4 = stimme eher zu · 5 = stimme voll zu)
- `score`: SUS (ungerade: Wert − 1; gerade: 5 − Wert; Summe × 2,5)

### A10 · skala

Ich musste eine Menge lernen, bevor ich anfangen konnte, HX Now zu verwenden.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme nicht zu · 3 = unentschieden · 4 = stimme eher zu · 5 = stimme voll zu)
- `score`: SUS (ungerade: Wert − 1; gerade: 5 − Wert; Summe × 2,5)
- `umpolen`: ja

## Abschnitt B · Akzeptanz (Technologieakzeptanzmodell, TAM)

*Info:* Unterüberschrift „Wahrgenommene Nützlichkeit“

### B1 · skala

Mit HX Now kann ich meine Aufgaben schneller erledigen.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PU
- `paar`: `TAM_PU_1`

### B2 · skala

HX Now verbessert die Qualität meiner Arbeit.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PU
- `paar`: `TAM_PU_2`

### B3 · skala

HX Now steigert meine Produktivität.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PU
- `paar`: `TAM_PU_3`

### B4 · skala

HX Now steigert meine Effektivität bei der Arbeit.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PU
- `paar`: `TAM_PU_4`

### B5 · skala

HX Now erleichtert meine Arbeit.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PU
- `paar`: `TAM_PU_5`

### B6 · skala

HX Now ist für meine Arbeit nützlich.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PU
- `paar`: `TAM_PU_6`

*Info:* Unterüberschrift „Wahrgenommene Benutzerfreundlichkeit“

### B7 · skala

Den Umgang mit HX Now zu erlernen, ist für mich leicht.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PEOU
- `paar`: `TAM_PEOU_1`

### B8 · skala

Es ist leicht, mit HX Now das zu erreichen, was ich möchte.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PEOU
- `paar`: `TAM_PEOU_2`

### B9 · skala

Die Bedienung von HX Now ist klar und verständlich.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PEOU
- `paar`: `TAM_PEOU_3`

### B10 · skala

HX Now ist flexibel in der Bedienung.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PEOU
- `paar`: `TAM_PEOU_4`

### B11 · skala

Es ist leicht, im Umgang mit HX Now geübt zu werden.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PEOU
- `paar`: `TAM_PEOU_5`

### B12 · skala

HX Now ist einfach zu bedienen.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PEOU
- `paar`: `TAM_PEOU_6`

*Info:* Unterüberschrift „Nutzungsabsicht“

### B13 · skala

Ich beabsichtige, HX Now auch künftig regelmäßig zu nutzen.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_BI
- `paar`: `TAM_BI_1`

### B14 · skala

Ich werde HX Now nutzen, wann immer es sinnvoll ist.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_BI
- `paar`: `TAM_BI_2`

## Abschnitt E · Nützlichkeit der Funktionen

### E1 · skala

Krankenakte / Verlauf einsehen

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich) + Option 9 = nicht genutzt
- `paar`: `FUNK_NUTZEN_1`
- `showIf`: `W5_1 > 0 ODER UNBEKANNT(W5_1)`
- `autoWert`: `9` (nicht genutzt), wenn `W5_1 = 0`

### E2 · skala

Laborwerte einsehen

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich) + Option 9 = nicht genutzt
- `paar`: `FUNK_NUTZEN_2`
- `showIf`: `W5_2 > 0 ODER UNBEKANNT(W5_2)`
- `autoWert`: `9` (nicht genutzt), wenn `W5_2 = 0`

### E3 · skala

Bildgebung (PACS-Viewer)

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich) + Option 9 = nicht genutzt
- `paar`: `FUNK_NUTZEN_3`
- `showIf`: `W5_3 > 0 ODER UNBEKANNT(W5_3)`
- `autoWert`: `9` (nicht genutzt), wenn `W5_3 = 0`

### E4 · skala

PMDs bearbeiten (z. B. Basisanamnese, Konsil)

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich) + Option 9 = nicht genutzt
- `paar`: `FUNK_NUTZEN_4`
- `showIf`: `W5_4 > 0 ODER UNBEKANNT(W5_4)`
- `autoWert`: `9` (nicht genutzt), wenn `W5_4 = 0`

### E5 · skala

Fotodokumentation

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich) + Option 9 = nicht genutzt
- `paar`: `FUNK_NUTZEN_5`
- `showIf`: `W5_5 > 0 ODER UNBEKANNT(W5_5)`
- `autoWert`: `9` (nicht genutzt), wenn `W5_5 = 0`

### E6 · skala

Dokumentenscan

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich) + Option 9 = nicht genutzt
- `paar`: `FUNK_NUTZEN_6`
- `showIf`: `W5_6 > 0 ODER UNBEKANNT(W5_6)`
- `autoWert`: `9` (nicht genutzt), wenn `W5_6 = 0`

### E7 · skala

Sprachgestützte Dokumentation

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich) + Option 9 = nicht genutzt
- `paar`: `FUNK_NUTZEN_7`
- `showIf`: `W5_7 > 0 ODER UNBEKANNT(W5_7)`
- `autoWert`: `9` (nicht genutzt), wenn `W5_7 = 0`

## Abschnitt T · Technik

### T1 · matrix

Wie oft sind bei der Nutzung von HX Now folgende Probleme aufgetreten?

- `zeilen`:
  - 1 = Keine oder schlechte Netzverbindung (WLAN)
  - 2 = Akku leer oder zu schwach
  - 3 = Probleme bei der Anmeldung
  - 4 = Lange Ladezeiten
  - 5 = Absturz oder Fehlermeldung
  - 6 = Fehlerhafte Spracherkennung
  - 7 = Gerät nicht griffbereit
- `spalten`:
  - 1 = nie | 2 = selten | 3 = gelegentlich | 4 = oft | 5 = sehr oft
- `zeileShowIf`: Zeile 6: `W5_7 > 0 ODER UNBEKANNT(W5_7)`

### T2 · matrix

Wie bewerten Sie folgende Funktionen?

- `zeilen`:
  - 1 = Die Spracherkennung ist genau.
  - 2 = Die Bildgebung ist auf dem Smartphone ausreichend beurteilbar.
  - 3 = Fotos und Scans werden zuverlässig dem richtigen Patienten zugeordnet.
  - 4 = PMDs lassen sich vollständig in der App bearbeiten.
- `spalten`:
  - 1–5 (1 = stimme gar nicht zu · 5 = stimme voll zu) + 9 = nicht genutzt
- `zeileShowIf`:
  - Zeile 1: `W5_7 > 0 ODER UNBEKANNT(W5_7)`, sonst `9`
  - Zeile 2: `W5_3 > 0 ODER UNBEKANNT(W5_3)`, sonst `9`
  - Zeile 3: `W5_5 > 0 ODER W5_6 > 0 ODER UNBEKANNT(W5_5)`, sonst `9`
  - Zeile 4: `W5_4 > 0 ODER UNBEKANNT(W5_4)`, sonst `9`

### T3 · skala

Wie wahrscheinlich ist es, dass Sie HX Now Kolleginnen und Kollegen empfehlen?

- `skala`: 0–10 (0 = sehr unwahrscheinlich · 10 = sehr wahrscheinlich)

## Abschnitt C · Veränderung Ihrer Arbeitsweise

> Wie hat sich seit der Einführung von HX Now Folgendes bei Ihnen verändert?

### C1 · skala

Zeit am stationären Arbeitsplatz-PC

- `skala`: 1–5 (1 = deutlich weniger · 2 = etwas weniger · 3 = unverändert · 4 = etwas mehr · 5 = deutlich mehr)

### C2 · skala

Wege zu einem PC, um Informationen nachzusehen

- `skala`: 1–5 (1 = deutlich weniger · 2 = etwas weniger · 3 = unverändert · 4 = etwas mehr · 5 = deutlich mehr)

### C3 · skala

Telefonische Rückfragen zu Patienteninformationen

- `skala`: 1–5 (1 = deutlich weniger · 2 = etwas weniger · 3 = unverändert · 4 = etwas mehr · 5 = deutlich mehr)

### C4 · skala

Aufgeschobene Aufgaben wegen fehlender Information

- `skala`: 1–5 (1 = deutlich weniger · 2 = etwas weniger · 3 = unverändert · 4 = etwas mehr · 5 = deutlich mehr)

### C5 · skala

Zeit am Patientenbett

- `skala`: 1–5 (1 = deutlich weniger · 2 = etwas weniger · 3 = unverändert · 4 = etwas mehr · 5 = deutlich mehr)

### C6 · skala

Aufwand für Dokumentation

- `skala`: 1–5 (1 = deutlich weniger · 2 = etwas weniger · 3 = unverändert · 4 = etwas mehr · 5 = deutlich mehr)

### C7 · skala

Unterbrechungen meiner Arbeit

- `skala`: 1–5 (1 = deutlich weniger · 2 = etwas weniger · 3 = unverändert · 4 = etwas mehr · 5 = deutlich mehr)

### C8 · skala

Arbeitsbelastung insgesamt

- `skala`: 1–5 (1 = deutlich weniger · 2 = etwas weniger · 3 = unverändert · 4 = etwas mehr · 5 = deutlich mehr)

### C9 · einfach

Wie häufig haben Sie HX Now insgesamt genutzt?

- `optionen`: 1 = nie | 2 = seltener als wöchentlich | 3 = wöchentlich | 4 = täglich | 5 = mehrmals täglich

### C10 · einfach

Würden Sie HX Now weiterhin nutzen, wenn die Nutzung freiwillig wäre?

- `optionen`: 1 = ja | 2 = eher ja | 3 = eher nein | 4 = nein

## Abschnitt F · Erreichbarkeit und IT-Belastung

### F1 · skala

Durch die Möglichkeit, jederzeit auf Patientendaten zuzugreifen, fällt es mir schwerer, in Pausen und nach Dienstende abzuschalten.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme eher nicht zu · 3 = teils/teils · 4 = stimme eher zu · 5 = stimme voll zu)
- `paar`: `ABSCHALTEN`

### F2 · skala

Die IT-Systeme, mit denen ich arbeite, verursachen mir Stress.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme eher nicht zu · 3 = teils/teils · 4 = stimme eher zu · 5 = stimme voll zu)
- `paar`: `IT_STRESS`

## Abschnitt D · Offene Fragen

> Alle optional; Hinweis „Keine Namen eintragen“.

### D1 · freitext

In welchen Situationen hat Ihnen HX Now am meisten geholfen?


### D2 · freitext

Was hat die Nutzung von HX Now erschwert oder verhindert?


### D3 · freitext

Was sollte an HX Now oder an der Einführung verbessert werden?


### D4 · freitext

Sonstige Anmerkungen


*Info:* Abschluss: „Vielen Dank für Ihre Teilnahme!“
