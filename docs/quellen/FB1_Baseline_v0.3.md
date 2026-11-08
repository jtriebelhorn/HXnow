# Fragebogen 1 (FB1) – Ausgangslage vor Einführung von HX Now

- `bogen`: FB1 · `phase`: PRE · Zeitpunkt: im Verlauf der Baseline
- Version: 0.3 vom 08.11.2026 (Entwurf, vor Pretest)
- Bearbeitungszeit: ca. 14 Minuten
- Einleitung: „Bitte kreuzen Sie pro Frage bzw. Zeile eine Antwort an, sofern nicht anders angegeben. Es gibt keine richtigen oder falschen Antworten. Ihre Angaben werden pseudonymisiert ausgewertet.“
- Kopfdaten (setzt die Doktorandin, nicht Teil des Bogens): Studien-Code, Datum, Bereich (NEPH / ZNA)

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

## Abschnitt A · Angaben zur Person

### A1 · einfach

Alter

- `optionen`: 1 = < 30 Jahre | 2 = 30–39 Jahre | 3 = 40–49 Jahre | 4 = ≥ 50 Jahre

### A2 · einfach

Geschlecht

- `optionen`: 1 = weiblich | 2 = männlich | 3 = divers | -99 = keine Angabe

### A3 · einfach

Funktion

- `optionen`: 1 = Assistenzärztin/-arzt | 2 = Fachärztin/-arzt | 3 = Oberärztin/-arzt | 9 = Sonstiges
- `freitextBei`: 9 → Freitextfeld `A3_TXT` (`showIf`: `A3 = 9`)

### A4 · einfach

Ärztliche Berufserfahrung

- `optionen`: 1 = < 2 Jahre | 2 = 2–5 Jahre | 3 = 6–10 Jahre | 4 = > 10 Jahre

### A5 · einfach

Tätigkeit im aktuellen Bereich

- `optionen`: 1 = < 6 Monate | 2 = 6–12 Monate | 3 = > 12 Monate

### A6 · prozentgruppe

In welchen Bereichen arbeiten Sie im Studienzeitraum, und mit welchem Anteil Ihrer Arbeitszeit? (Mehrfachnennung möglich; Summe 100 %)

- `zeilen`:
  - STAT = Station
  - AMB = Ambulanz
  - FUNK = Funktionsbereich (z. B. Dialyse)
  - ZNA_BEH = Notaufnahme: Behandlungsbereich
  - ZNA_STAT = Notaufnahme: Notaufnahmestation
  - SONST = Sonstiges
- `freitextBei`: SONST → Freitextfeld `A6_SONST_TXT` (`showIf`: `A6_SONST = 1`)
- `autoWert`: genau eine Zeile angekreuzt → deren `_PCT` = 100
- `zeileShowIf`: Prozentfeld `A6_<Zeile>_PCT` nur bei `A6_<Zeile> = 1`, sonst `-88`
- `validierung`: Summe aller sichtbaren `_PCT` = 100; mindestens eine Zeile angekreuzt
- `hinweis`: Je Zeile zwei Werte: `A6_<Zeile>` (angekreuzt 0/1) und `A6_<Zeile>_PCT` (0–100)

### A7 · zahl

Beschäftigungsumfang: ___ % einer Vollzeitstelle

- `min`: 10
- `max`: 100
- `einheit`: %

### A8 · einfach

Nehmen Sie im Studienzeitraum an Bereitschafts- oder Nachtdiensten teil?

- `optionen`: 1 = ja | 2 = nein

## Abschnitt B · Bisherige Nutzung mobiler Geräte und des Klinikinformationssystems

### B1 · einfach

Wie häufig nutzen Sie derzeit einen mobilen Visitenwagen bzw. Laptop für Patienteninformationen?

- `optionen`: 1 = nie | 2 = seltener als wöchentlich | 3 = wöchentlich | 4 = täglich

### B2 · einfach

Wie häufig nutzen Sie bei der Arbeit Ihr privates Smartphone für medizinische Informationen (z. B. Apps, Leitlinien)?

- `optionen`: 1 = nie | 2 = seltener als wöchentlich | 3 = wöchentlich | 4 = täglich

### B3 · einfach

Haben Sie HX Now vor dieser Studie bereits genutzt?

- `optionen`: 1 = nein | 2 = ja, kurz ausprobiert | 3 = ja, regelmäßig

### B4 · einfach

Wie zufrieden sind Sie mit dem Zugriff auf Patientendaten über das bestehende Klinikinformationssystem (SAP)?

- `optionen`: 1 = sehr unzufrieden | 2 = eher unzufrieden | 3 = teils/teils | 4 = eher zufrieden | 5 = sehr zufrieden

### B5 · einfach

Betriebssystem Ihres privaten Smartphones

- `optionen`: 1 = iOS | 2 = Android | 3 = anderes | 4 = kein Smartphone

## Abschnitt W · Informationsbedarf in den letzten 14 Tagen

### W1 · zahl

An wie vielen Tagen hatten Sie in den letzten 14 Tagen Dienst?

- `min`: 0
- `max`: 14
- `einheit`: Tage
- `hinweis`: W1 = 0 → alle weiteren Items von Abschnitt W ausblenden (`-88`), weiter mit Abschnitt C

### W2 · zahl

Davon Bereitschafts- oder Nachtdienste:

- `min`: 0
- `max`: 14
- `showIf`: `W1 > 0 UND A8 = 1`
- `autoWert`: `0`, wenn `A8 = 2`
- `validierung`: `W2 <= W1`

*Info:* Informationsbedarf abseits eines PCs: Sie benötigten eine patientenbezogene Information (z. B. Laborwert, Befund, Bildgebung, Medikation), während kein stationärer Arbeitsplatz-PC unmittelbar erreichbar war. Sofort vor Ort: ohne Ortswechsel, Anruf oder Aufschub, z. B. über einen Visitenwagen, ein anderes mobiles Gerät oder Papierunterlagen. (`showIf`: `W1 > 0`)

### W3 · matrix

Bitte geben Sie für jede Situation an, wie oft in den letzten 14 Tagen Informationsbedarf abseits eines PCs entstand (A) und wie Sie ihn überwiegend gelöst haben (B).

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
  - B „Wie überwiegend gelöst?“ (eine Antwort): 1 = sofort vor Ort | 2 = Weg zum PC | 3 = Anruf / Rückfrage | 4 = Aufschub | 5 = Verzicht
- `paar`: je Zelle identisch mit der Zell-ID (z. B. `W3_01_A`), in FB2 gleich benannt
- `showIf`: `W1 > 0`
- `zeileShowIf`:
  - Zeile 04 (Visite): `A6_STAT = 1 ODER A6_ZNA_STAT = 1`
  - Zeile 06 (Behandlungsbereich Notaufnahme): `A6_ZNA_BEH = 1`
  - Zeile 09 (Bereitschafts-/Nachtdienst): `A8 = 1`
- `spalteShowIf`: Spalte B einer Zeile nur bei `W3_<Zeile>_A > 0` (einklappen), sonst `-88`

### W4a · einfach

Denken Sie an den Informationsbedarf abseits eines PCs, der in den letzten 14 Tagen am häufigsten vorkam. Welche Information wurde am häufigsten benötigt?

- `optionen`: 1 = Laborwerte | 2 = Befunde/Bildgebung | 3 = Vorbefunde/Arztbriefe | 4 = Medikation | 5 = Verlauf/Kurve | 9 = Sonstiges
- `freitextBei`: 9 → `W4a_TXT`
- `paar`: `INFO_HAEUF_ART`
- `showIf`: `W1 > 0 UND IRGENDEIN(W3_*_A) > 0`

### W4b · einfach

Wo entstand dieser Bedarf meistens?

- `optionen`: 1 = Flur/Wegstrecke | 2 = Patientenzimmer | 3 = Visite | 4 = Übergabe | 5 = Behandlungsbereich Notaufnahme | 6 = anderer Bereich | 7 = Bereitschafts-/Nachtdienst
- `paar`: `INFO_HAEUF_ORT`
- `showIf`: `W1 > 0 UND IRGENDEIN(W3_*_A) > 0`
- `optionShowIf`:
  - 5 (Behandlungsbereich Notaufnahme): `A6_ZNA_BEH = 1`
  - 7 (Bereitschafts-/Nachtdienst): `A8 = 1`

### W4c · einfach

Wie haben Sie ihn meistens gelöst?

- `optionen`: 1 = sofort vor Ort (z. B. Visitenwagen) | 2 = Weg zum PC | 3 = Anruf / Rückfrage | 4 = aufgeschoben | 5 = verzichtet
- `paar`: `INFO_HAEUF_LOES` (Umkodierung FB2/KB siehe dort)
- `showIf`: `W1 > 0 UND IRGENDEIN(W3_*_A) > 0`

### W4d · einfach

Wie lange dauerte es typischerweise, bis Sie die Information hatten?

- `optionen`: 1 = sofort | 2 = < 5 Minuten | 3 = 5–30 Minuten | 4 = > 30 Minuten | 5 = gar nicht
- `paar`: `INFO_HAEUF_DAUER`
- `showIf`: `W1 > 0 UND IRGENDEIN(W3_*_A) > 0 UND W4c != 5`
- `autoWert`: `5` (gar nicht), wenn `W4c = 5`

### W5 · freitext

Möchten Sie etwas zu den letzten 14 Tagen anmerken?

- `showIf`: `W1 > 0`
- `hinweis`: optional; Hinweis „Keine Namen eintragen“

## Abschnitt C · Affinität zur Technikinteraktion (ATI-Skala)

> Im Folgenden geht es um Ihre Interaktion mit technischen Systemen. Mit „technischen Systemen“ sind sowohl Apps und andere Software-Anwendungen als auch komplette digitale Geräte (z. B. Handy, Computer, Fernseher, Auto-Navigation) gemeint. Bitte geben Sie den Grad Ihrer Zustimmung zu folgenden Aussagen an.

### C1 · skala

Ich beschäftige mich gern genauer mit technischen Systemen.

- `skala`: 1–6 (1 = stimmt gar nicht · 2 = stimmt weitgehend nicht · 3 = stimmt eher nicht · 4 = stimmt eher · 5 = stimmt weitgehend · 6 = stimmt völlig)
- `score`: ATI (Mittelwert)

### C2 · skala

Ich probiere gern die Funktionen neuer technischer Systeme aus.

- `skala`: 1–6 (1 = stimmt gar nicht · 2 = stimmt weitgehend nicht · 3 = stimmt eher nicht · 4 = stimmt eher · 5 = stimmt weitgehend · 6 = stimmt völlig)
- `score`: ATI (Mittelwert)

### C3 · skala

In erster Linie beschäftige ich mich mit technischen Systemen, weil ich muss.

- `skala`: 1–6 (1 = stimmt gar nicht · 2 = stimmt weitgehend nicht · 3 = stimmt eher nicht · 4 = stimmt eher · 5 = stimmt weitgehend · 6 = stimmt völlig)
- `score`: ATI (Mittelwert)
- `umpolen`: ja

### C4 · skala

Wenn ich ein neues technisches System vor mir habe, probiere ich es intensiv aus.

- `skala`: 1–6 (1 = stimmt gar nicht · 2 = stimmt weitgehend nicht · 3 = stimmt eher nicht · 4 = stimmt eher · 5 = stimmt weitgehend · 6 = stimmt völlig)
- `score`: ATI (Mittelwert)

### C5 · skala

Ich verbringe sehr gern Zeit mit dem Kennenlernen eines neuen technischen Systems.

- `skala`: 1–6 (1 = stimmt gar nicht · 2 = stimmt weitgehend nicht · 3 = stimmt eher nicht · 4 = stimmt eher · 5 = stimmt weitgehend · 6 = stimmt völlig)
- `score`: ATI (Mittelwert)

### C6 · skala

Es genügt mir, dass ein technisches System funktioniert, mir ist es egal, wie oder warum.

- `skala`: 1–6 (1 = stimmt gar nicht · 2 = stimmt weitgehend nicht · 3 = stimmt eher nicht · 4 = stimmt eher · 5 = stimmt weitgehend · 6 = stimmt völlig)
- `score`: ATI (Mittelwert)
- `umpolen`: ja

### C7 · skala

Ich versuche zu verstehen, wie ein technisches System genau funktioniert.

- `skala`: 1–6 (1 = stimmt gar nicht · 2 = stimmt weitgehend nicht · 3 = stimmt eher nicht · 4 = stimmt eher · 5 = stimmt weitgehend · 6 = stimmt völlig)
- `score`: ATI (Mittelwert)

### C8 · skala

Es genügt mir, die Grundfunktionen eines technischen Systems zu kennen.

- `skala`: 1–6 (1 = stimmt gar nicht · 2 = stimmt weitgehend nicht · 3 = stimmt eher nicht · 4 = stimmt eher · 5 = stimmt weitgehend · 6 = stimmt völlig)
- `score`: ATI (Mittelwert)
- `umpolen`: ja

### C9 · skala

Ich versuche, die Möglichkeiten eines technischen Systems vollständig auszunutzen.

- `skala`: 1–6 (1 = stimmt gar nicht · 2 = stimmt weitgehend nicht · 3 = stimmt eher nicht · 4 = stimmt eher · 5 = stimmt weitgehend · 6 = stimmt völlig)
- `score`: ATI (Mittelwert)

## Abschnitt D · Erwartungen an HX Now (Technologieakzeptanzmodell, TAM)

> Bitte geben Sie an, was Sie von HX Now erwarten.

*Info:* Unterüberschrift „Wahrgenommene Nützlichkeit“

### D1 · skala

Mit HX Now werde ich meine Aufgaben schneller erledigen können.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PU
- `paar`: `TAM_PU_1`

### D2 · skala

HX Now wird die Qualität meiner Arbeit verbessern.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PU
- `paar`: `TAM_PU_2`

### D3 · skala

HX Now wird meine Produktivität steigern.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PU
- `paar`: `TAM_PU_3`

### D4 · skala

HX Now wird meine Effektivität bei der Arbeit steigern.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PU
- `paar`: `TAM_PU_4`

### D5 · skala

HX Now wird meine Arbeit erleichtern.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PU
- `paar`: `TAM_PU_5`

### D6 · skala

HX Now wird für meine Arbeit nützlich sein.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PU
- `paar`: `TAM_PU_6`

*Info:* Unterüberschrift „Wahrgenommene Benutzerfreundlichkeit“

### D7 · skala

Den Umgang mit HX Now zu erlernen, wird für mich leicht sein.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PEOU
- `paar`: `TAM_PEOU_1`

### D8 · skala

Es wird leicht sein, mit HX Now das zu erreichen, was ich möchte.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PEOU
- `paar`: `TAM_PEOU_2`

### D9 · skala

Die Bedienung von HX Now wird klar und verständlich sein.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PEOU
- `paar`: `TAM_PEOU_3`

### D10 · skala

HX Now wird flexibel in der Bedienung sein.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PEOU
- `paar`: `TAM_PEOU_4`

### D11 · skala

Es wird leicht sein, im Umgang mit HX Now geübt zu werden.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PEOU
- `paar`: `TAM_PEOU_5`

### D12 · skala

HX Now wird einfach zu bedienen sein.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_PEOU
- `paar`: `TAM_PEOU_6`

*Info:* Unterüberschrift „Nutzungsabsicht“

### D13 · skala

Ich beabsichtige, HX Now regelmäßig zu nutzen.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_BI
- `paar`: `TAM_BI_1`

### D14 · skala

Ich werde HX Now nutzen, wann immer es sinnvoll ist.

- `skala`: 1–7 (1 = stimme gar nicht zu · 4 = teils/teils · 7 = stimme voll zu)
- `score`: TAM_BI
- `paar`: `TAM_BI_2`

## Abschnitt E · Erwarteter Nutzen der Funktionen

> Wie nützlich erwarten Sie diese Funktionen für Ihre Arbeit?

### E1 · skala

Krankenakte / Verlauf einsehen

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich)
- `paar`: `FUNK_NUTZEN_1`

### E2 · skala

Laborwerte einsehen

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich)
- `paar`: `FUNK_NUTZEN_2`

### E3 · skala

Bildgebung (PACS-Viewer)

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich)
- `paar`: `FUNK_NUTZEN_3`

### E4 · skala

PMDs bearbeiten (z. B. Basisanamnese, Konsil)

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich)
- `paar`: `FUNK_NUTZEN_4`

### E5 · skala

Fotodokumentation

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich)
- `paar`: `FUNK_NUTZEN_5`

### E6 · skala

Dokumentenscan

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich)
- `paar`: `FUNK_NUTZEN_6`

### E7 · skala

Sprachgestützte Dokumentation

- `skala`: 1–5 (1 = gar nicht nützlich · 5 = sehr nützlich)
- `paar`: `FUNK_NUTZEN_7`

## Abschnitt F · Erreichbarkeit und IT-Belastung

### F1 · skala

Durch die Möglichkeit, jederzeit auf Patientendaten zuzugreifen, wird es mir schwerer fallen, in Pausen und nach Dienstende abzuschalten.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme eher nicht zu · 3 = teils/teils · 4 = stimme eher zu · 5 = stimme voll zu)
- `paar`: `ABSCHALTEN`

### F2 · skala

Die IT-Systeme, mit denen ich arbeite, verursachen mir Stress.

- `skala`: 1–5 (1 = stimme gar nicht zu · 2 = stimme eher nicht zu · 3 = teils/teils · 4 = stimme eher zu · 5 = stimme voll zu)
- `paar`: `IT_STRESS`

*Info:* Abschluss: „Vielen Dank für Ihre Teilnahme!“
