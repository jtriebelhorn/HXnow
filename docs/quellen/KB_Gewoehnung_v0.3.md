# Kurzbogen Gewöhnung (KB) – Ende der Einführungsphase

- `bogen`: KB · `phase`: EINF · Zeitpunkt: am Ende der Einführung, vor Beginn des Regelbetriebs
- Version: 0.3 vom 08.11.2026 (Entwurf, vor Pretest)
- Bearbeitungszeit: ca. 2 Minuten
- Einleitung: „Bitte beziehen Sie sich auf die letzten 14 Tage seit der Einführung von HX Now.“
- Kopfdaten (setzt die Doktorandin): Studien-Code, Datum, Bereich

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

## Abschnitt G · Gewöhnung

> Keine Filter. Alle Items sind wortgleich mit FB2 (W4, W5, W6c) und dienen dem Vergleich Ende Einführung → Ende Regelbetrieb.

### G1 · einfach

Wie oft hatten Sie in den letzten 14 Tagen ein Gerät mit HX Now bei sich?

- `optionen`: 1 = nie | 2 = selten | 3 = meistens | 4 = immer
- `paar`: `GERAET_DABEI`

### G2 · matrix

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
- `paar`: `FUNK_HAEUF_<1–7>` (Zell-ID `G2_<k>`)

### G3 · einfach

Wenn Sie in den letzten 14 Tagen eine patientenbezogene Information benötigten, während kein Arbeitsplatz-PC unmittelbar erreichbar war: Wie haben Sie das meistens gelöst?

- `optionen`: 1 = mit HX Now | 2 = anders vor Ort (z. B. Visitenwagen) | 3 = Weg zum PC | 4 = Anruf / Rückfrage | 5 = aufgeschoben | 6 = verzichtet
- `paar`: `INFO_HAEUF_LOES`; für den Vergleich mit FB1 umkodieren: 1 und 2 → „sofort vor Ort“, 3 → 2, 4 → 3, 5 → 4, 6 → 5

### G4 · skala

Wie vertraut sind Sie inzwischen mit HX Now?

- `skala`: 1–5 (1 = gar nicht vertraut · 5 = sehr vertraut)
- `hinweis`: kein Gegenstück in FB2 (am nächsten SUS A9)

*Info:* Abschluss: „Vielen Dank!“
