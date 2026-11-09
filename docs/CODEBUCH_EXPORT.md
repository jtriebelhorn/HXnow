# Codebuch der Exportdateien

**Exportformat 1.1** (ab App 1.2.0, Kodierschema 2.2: neue Spalten `NT1`, `NT1_nutzung`). Format 1.0 wurde mit App 1.0.0 am 09.11.2026
festgeschrieben; 1.1 ergänzt nur Spalten. Gilt mit Kodierschema 2.0–2.2
(Fragebogen-Definition 1.0.0, [Kodierhandbuch 2.0](KODIERHANDBUCH_v2.0.md)). Die Bedeutung der Codes hängt von
`schema_version` ab: ab 2.0 ist T11 Diagnostik/Intervention und T5 nur noch das Gespräch mit Patient/Angehörigen. Beschreibt jede Spalte der CSV-Dateien, die die Beobachtungs-App
exportiert. Die Bedeutung der Codes (T1–T10, O1–O8 usw.) steht im Kodierhandbuch und in `kodierschema.json`.

## Versionen und Gültigkeit

- Jede Datei trägt in der 2. Spalte `format_version` (hier 1.0), Beobachtungen zusätzlich `schema_version`,
  Fragebögen `definition_version`. Dateien ohne `format_version` stammen aus der Zeit vor der Festschreibung (Tests,
  Pilot) und werden vom Zusammenführungstool nicht ausgewertet.
- Regeln nach der Festschreibung: Spalten werden nie umbenannt, entfernt oder in ihrer Bedeutung geändert. Neue Spalten
  kommen nur hinzu (→ `format_version` 1.1 …); eine geänderte Bedeutung erfordert 2.0. Codes im Kodierschema und Items
  der Fragebögen ebenso (`schemaVersion` bzw. `definitionVersion`). Ein Test (`tests/unit/versionen.test.js`) verhindert,
  dass sich Inhalte ohne neue Versionsnummer ändern; Referenzdateien für jeden Dateityp liegen in
  `tests/unit/referenz/`.
- Auswertungen lesen Spalten immer über ihren Namen, nie über die Position.

## Allgemeines Format

- UTF-8 mit BOM, Trennzeichen Semikolon, Zeilenende CRLF, Felder mit Semikolon, Anführungszeichen oder
  Zeilenumbruch in Anführungszeichen (RFC 4180). So öffnet Excel die Datei mit korrekten Umlauten.
  Beim Export per Mail oder Zwischenablage entfällt das BOM (reiner Text). Diese Dateien in Excel über
  „Daten → Aus Text/CSV“ mit Codierung UTF-8 öffnen.
- Zeitangaben: lokale Zeit mit Offset, `JJJJ-MM-TTThh:mm:ss±hh:mm`. Datum: `JJJJ-MM-TT`.
- Leeres Feld = nicht zutreffend oder nicht angegeben.

## Dateinamen

| Datei | Muster |
| --- | --- |
| Beobachtungsblock | `HXNOW_BEOB_<pseudonym>_<JJJJMMTT>_<HHMM>_<block-id, 8 Zeichen>.csv` |
| Person nicht angetroffen | `HXNOW_VERSUCH_<pseudonym>_<JJJJMMTT>_<HHMM>_<id, 8 Zeichen>.csv` |
| Tageskennzahlen | `HXNOW_TAG_<bereich>-<teilbereich>_<JJJJMMTT>_<HHMM>.csv` (vor 0.17.0 ohne `-<teilbereich>`) |
| Fragebogen | `HXNOW_FB_<FB1/KB/FB2>_<pseudonym>_<JJJJMMTT>_<HHMM>_<sitzungs-id, 8 Zeichen>.csv` |
| Logbuch (je Gerät, wird ersetzt) | `HXNOW_Logbuch_<geräte-id, 8 Zeichen>.csv` |
| Komplettsicherung | `HXNOW_Komplettsicherung_<geräte-id, 8>_<JJJJMMTT>_<HHMM>.json` |
| Teilnehmerliste | `HXNOW_Teilnehmende_<geräte-id, 8>_<JJJJMMTT>_<HHMM>.csv` |
| Widerrufsprotokoll | `HXNOW_Widerruf_<pseudonym>_<JJJJMMTT>.txt` |
| Probelauf (Test-Code, z. B. P000) | wie oben, aber mit `HXNOW_TEST_` statt `HXNOW_` – **nicht auswerten** |

## Beobachtungsblock (`HXNOW_BEOB_…`)

Eine Zeile je Episode und je Pause, chronologisch (Long-Format). Die Blockangaben (Spalten bis
`hx_geraet_markiert`) wiederholen sich in jeder Zeile.

| Spalte | Inhalt | Werte |
| --- | --- | --- |
| `datensatz` | Zeilentyp | `episode`, `pause`; `block` nur bei Abbruch vor der ersten Episode (dann eine Zeile ohne Episodenfelder) |
| `block_id` | eindeutige ID des Blocks | UUID |
| `geraete_id` | zufällige ID des erfassenden Geräts | UUID (keine Gerätemerkmale) |
| `schema_version` | Version des Kodierschemas | z. B. `0.2` |
| `app_version` | Version der App | z. B. `0.4.0` |
| `pseudonym` | Studien-Code der beobachteten Person | `P` + 3 Ziffern; `P000` = Probelauf |
| `beobachter` | Kürzel der beobachtenden Person | z. B. `B1` |
| `bereich` | Bereich | `NEPH`, `ZNA` |
| `dienst` | Dienst | `F`, `S`, `N`, leer = nicht angegeben (optional) |
| `phase` | Studienphase | `PRE`, `POST` |
| `arbeitskontext` | Arbeitskontext beim Blockstart | `K1`–`K7`, leer = nicht angegeben (optional) |
| `datum` | Datum des Blockstarts | `JJJJ-MM-TT` |
| `block_start` | Beginn des Blocks | Zeit |
| `block_ende` | Ende des Blocks | Zeit; = `block_start` + beobachtete Zeit + Pausenzeit |
| `block_dauer_soll_sek` | gewählte Blockdauer (beobachtete Zeit) | `600` oder `900` |
| `block_beobachtet_sek` | beobachtete Zeit ohne Pausen | Sekunden; = Summe `dauer_sek` der Episoden |
| `block_pausen_anzahl` | Anzahl Pausen | ganze Zahl |
| `block_pausen_sek` | Pausenzeit | Sekunden; = Summe `dauer_sek` der Pausen |
| `block_status` | Ergebnis | `beendet`, `abgebrochen` (verworfene Blöcke werden nicht exportiert) |
| `block_ende_art` | Art des Endes | `regulaer` (Blockdauer erreicht), `manuell` (vorzeitig beendet), `abbruch` |
| `block_ende_grund` | Grund für ein vorzeitiges Ende | Freitext, nur bei `manuell` |
| `abbruch_code` | Abbruchgrund | `A1`–`A4`, nur bei `abbruch` |
| `block_kommentar` | Kommentar zum Block | Freitext |
| `hx_geraet_dabei` | HX-Now-Gerät dabei (Abschlussfrage) | `J`, `N`, `U`; leer in Prä oder ohne Antwort |
| `hx_geraet_automatisch` | Schalter wurde durch eine HX-Now-Episode gesetzt | `1`, `0` |
| `hx_geraet_markiert` | Zeitpunkt, zu dem „Gerät dabei“ markiert wurde | Zeit (Rohzeit, sekundengenau); leer in Prä |
| `nr` | laufende Nummer der Zeile im Block | 1 … `n_zeilen_block` |
| `start` | Beginn der Episode bzw. Pause | Zeit |
| `ende` | Ende der Episode bzw. Pause | Zeit; = `start` der nächsten Zeile |
| `dauer_sek` | Dauer | Sekunden; immer `ende − start` |
| `taetigkeit` | Haupttätigkeit/Gerät (Prioritätsregel) | `T1`–`T10`; leer bei Pause. `T9` = Gehen |
| `ort` | Ort innerhalb des Bereichs | `O1` Arztzimmer, `O2` beim Patienten, `O3` bei der Pflege, `O4` Flur, `O5` Pausenraum, `O6` unterwegs, `O7` außerhalb des Bereichs, `O8` Sonstiges; leer bei Pause |
| `nutzungsart` | Nutzungsart | `N1`–`N5` (`N5` = Warten), `N9` = Sonstige; nur bei T1–T3. T3 ohne Auswahl: `N9`; T1/T2 ohne Auswahl: leer |
| `haltung` | Körperhaltung | `H1`–`H4`, `H9` = Sonstige (auch ohne Auswahl); nur bei T3; am Ort O6 immer `H1` |
| `nebentaetigkeiten` | laufende Nebentätigkeiten, lesbar | z. B. `NT3+NT6`; leer = keine |
| `NT1`, `NT3`, `NT4`, `NT5`, `NT6`, `NT7` | Nebentätigkeit PC (ab Format 1.1), HX Now, Mobilgerät, Patientenkontakt, Gespräch Kollegen/Pflege, Telefonat | `1` = läuft, `0` = nicht; leer bei Pause. Welche es gibt, legt `nebentaetigkeiten` im Kodierschema fest |
| `NT1_nutzung` | Nutzungsart bei der Nebentätigkeit PC (ab Format 1.1) | `N1`–`N3`, `N5`, `N9`; leer, wenn NT1 nicht läuft |
| `NT3_nutzung` | was bei der Nebentätigkeit HX Now gemacht wird | `N1`–`N5`, `N9` = Sonstige (auch wenn nichts gewählt wurde); leer, wenn NT3 nicht läuft |
| `NT3_haltung` | Haltung bei der Nebentätigkeit HX Now | `H1`–`H4`, `H9` = Sonstige (auch wenn nichts gewählt wurde); am Ort O6 immer `H1`; leer, wenn NT3 nicht läuft |
| `unvollstaendig` | Nutzungsart oder Haltung bei T3 wurde nicht gewählt und gilt deshalb als Sonstige (`N9`, `H9`) | `1`, `0`; leer bei Pause |
| `pause_grund` | Pausengrund | `P1`–`P5`, leer = nicht angegeben; nur bei Pause |
| `pause_freitext` | Notiz zur Pause | Freitext; nur bei Pause |
| `kommentar` | Kommentar zur Episode | Freitext |
| `n_zeilen_block` | Anzahl Zeilen dieses Blocks | zur Vollständigkeitsprüfung |

### Zeitangaben und Rundung

Die App speichert jeden Tipp mit Millisekunden. Im Export werden beobachtete Zeit und Pausenzeit getrennt auf ganze
Sekunden gerundet; `start` und `ende` sind daraus abgeleitet (Blockstart, auf die Sekunde abgeschnitten, plus
gerundete Sekunden). Dadurch gilt in jeder Datei:

- `ende − start = dauer_sek` in jeder Zeile,
- `start` jeder Zeile = `ende` der Vorzeile; erste Zeile beginnt mit `block_start`, letzte endet mit `block_ende`,
- Summe der Episoden = `block_beobachtet_sek`, Summe der Pausen = `block_pausen_sek`.

Die exportierten Uhrzeiten können um bis zu 1 s von der tatsächlichen Uhrzeit des Tipps abweichen. Die genauen
Zeitstempel stehen in der JSON-Sicherung (`startTs`, `erfasstTs` in Millisekunden seit 1970).

### Rohdaten, die nicht in der CSV stehen

Die JSON-Sicherung enthält zusätzlich: rückgängig gemachte Episoden (`geloescht: true`) und den Zeitpunkt des Tipps,
der eine Episode angelegt hat (`erfasstTs`). Blöcke aus Version 0.4.0 können außerdem `korrekturen` enthalten
(Korrekturfenster, seit 0.5.0 entfallen).

### Hinweise zur Auswertung

- **Kurze Episoden:** Jeder Tipp ist eine eigene Zeile, auch Zwischenschritte beim Wechsel (erst Ort, dann Tätigkeit)
  von 1–2 s. Sie werden in der Auswertung über `regelnAuswertung.mindestdauerSek` (5 s) der vorangehenden Episode
  zugeschlagen; Ausnahme `mindestdauerAusnahmen` (T3). Für Kennzahlen zu Nebentätigkeiten oder Orten die
  Mindestdauer auf die jeweilige Größe anwenden, nicht auf die einzelne Zeile.
- **Tätigkeiten im Gehen und andere Gesamtzeiten:** Eine Tätigkeit kann Haupt- oder Nebentätigkeit sein. Für ihre
  Gesamtzeit daher beides zählen, z. B. Telefonzeit = `taetigkeit = T7` oder `NT7 = 1`, HX-Now-Nutzung =
  `taetigkeit = T3` oder `NT3 = 1`.
- **Gehzeit** = Summe `dauer_sek` mit `ort = O6`, gleich welche Tätigkeit. Das Ziel eines Weges ist der Ort der
  nächsten Zeile.
- **Dokumentation mit beteiligter Patientin bzw. beteiligtem Patienten** = Zeilen mit `taetigkeit` T1–T3 und
  `NT5 = 1`.
- **Wartezeit am Gerät** = Zeilen mit `nutzungsart = N5`.

## Person nicht angetroffen (`HXNOW_VERSUCH_…`)

| Spalte | Inhalt |
| --- | --- |
| `datensatz` | immer `versuch` |
| `versuch_id`, `geraete_id` | IDs (UUID) |
| `schema_version`, `app_version` | Versionen |
| `pseudonym`, `beobachter`, `bereich`, `dienst`, `phase` | wie beim Block |
| `datum`, `zeitpunkt` | Datum und Zeit der Erfassung |
| `kommentar` | Freitext |

## Tageskennzahlen (`HXNOW_TAG_…`)

| Spalte | Inhalt |
| --- | --- |
| `datensatz` | immer `tageskennzahlen` |
| `format_version` | Version des Exportformats (1.0) |
| `datum`, `bereich`, `teilbereich` | Tag, Bereich und Teilbereich (Schlüssel). Teilbereiche laut Kodierschema: NEPH = `STATION` Normalstation · `DIALYSE` Dialyse · `AMBULANZ` Ambulanz · `KONSIL` Konsile; ZNA = `NOTAUFNAHME` Notaufnahme · `NA-STATION` Notaufnahmestation. Leer bei Erfassungen vor App 0.17.0 (ganzer Bereich). |
| `belegung` | belegte Betten; nur bei stationären Teilbereichen (Normalstation, Notaufnahmestation), sonst leer |
| `aufnahmen`, `entlassungen` | Zahl der am Tag aufgenommenen bzw. entlassenen Patientinnen und Patienten |
| `ambulant` | Zahl ambulant betreuter Patientinnen und Patienten (z. B. Ambulanz, Dialyse, Konsile, Notaufnahme) |
| `umsatz` | Tagesumsatz = `aufnahmen` + `entlassungen` + `ambulant` (leer, wenn nichts davon angegeben) |
| `aerzte_anwesend` | Zahl der anwesenden Ärztinnen und Ärzte |
| `ereignisse` | besondere Ereignisse, Freitext |
| `beobachter` | Kürzel |
| `geraete_id`, `schema_version`, `app_version` | wie oben |
| `erfasst` | Zeitpunkt der Erfassung |

## Fragebogen (`HXNOW_FB_…`)

Long-Format: eine Zeile je Zelle (Item, Matrixzelle, Freitextfeld, weiche Sprungregel), auch für ausgeblendete. Die
Zellen-IDs, Codes und Paare stehen im Codebuch `docs/codebuch/codebuch_<definition_version>.csv` (`npm run codebuch`).

| Spalte | Inhalt |
| --- | --- |
| `datensatz` | immer `antwort` |
| `sitzung_id`, `geraete_id`, `app_version`, `definition_version` | Herkunft; `definition_version` = Fassung der Fragebogen-Definition |
| `testmodus` | 1 = Probelauf (Test-Code), 0 = Studiendaten – unabhängig vom Dateinamen |
| `bogen` | `FB1` · `KB` · `FB2` |
| `pseudonym`, `bereich` | Studien-Code, Bereich (Vorbereitung durch die Doktorandin) |
| `erhebungsmodus`, `papier_datum` | `APP` oder `PAPIER` (nacherfasst; Datum auf dem Bogen) |
| `start`, `ende`, `dauer_sek` | Ausfüllzeitraum (bei Papier: Erfassungszeitraum) |
| `abschnitt`, `abschnitt_dauer_sek` | Abschnitt der Zelle und die darauf verbrachte Zeit |
| `item_id`, `item_v` | Zellen-ID (z. B. `A1`, `W3_01_A`, `A3_TXT`, `A6_ZNA_BEH_PCT`) und Item-Version |
| `paar` | Paar-ID für den Vorher-Nachher-Vergleich (leer = kein Paar) |
| `typ` | Fragetyp der Zelle |
| `wert` | Code bzw. Zahl; −88 = gefiltert (Frage nicht gestellt, auch bei Freitextfeldern), −99 = keine Angabe; leer = ausgelassen |
| `wert_text` | Freitext |
| `status` | `beantwortet` · `ausgelassen` · `gefiltert` · `keine_angabe` · `automatisch` (Wert aus einer Regel, z. B. W2 = 0 bei A8 = nein) |
| `n_zeilen` | Zeilen der Datei (Vollständigkeit) |

## Logbuch-Datei (`HXNOW_Logbuch_…`)

Eine Kopfzeile für alle Datensätze; die Spalte `datensatz` sagt, welche Spalten belegt sind. Ab App 0.16.0 getrennte
Status-Spalten und `dauer_sek`; ältere Dateien mit gemeinsamer Spalte `status` bleiben lesbar. Enthält keine
Beobachtungs- oder Antwortinhalte. Die Datei nicht in Excel speichern (Prüfsumme).

| `datensatz` | Belegte Spalten |
| --- | --- |
| (Probeläufe) | stehen nicht im Logbuch; sie sind nur auf dem Gerät und in den `HXNOW_TEST_…`-Dateien |
| `meta` (immer erste Zeile) | `export_ts` (mit Millisekunden), `geraete_id`, `app_version`, `db_version`, `definition_version`, `schema_version`, `n_zeilen` (Zeilen ohne meta), `pruefsumme` (CRC32 über alle Zeilen nach der meta-Zeile, Text wie in der Datei), `stand_text` |
| `proband` | `pseudonym`, `bereich`, `proband_status` (aktiv · pausiert · ausgeschieden · widerrufen), `status_ts`, `registriert_ts`, `notiz`, eigene Phasendaten in `baseline_start` … `phase_ende` (leer = Plan des Bereichs) |
| `phasenplan` | `bereich`, `baseline_start`, `einfuehrung_start`, `regelbetrieb_start`, `abschluss_start`, `phase_ende` (Datum) |
| `eintrag` | ein Block, Versuch oder Fragebogen: `eintrag_id` (= block_id, versuch_id bzw. sitzung_id), `art` (BLOCK · VERSUCH · FB1 · KB · FB2), `pseudonym`, `phase`, `bereich`, `dienst`, `arbeitskontext`, `start`, `ende`, `dauer_sek` (Block: Beginn bis Ende; Fragebogen: Ausfüllzeit), `beobachtet_sek` (nur Block: beobachtete Zeit ohne Pausen), `pausen_anzahl`, `pausen_sek`, `eintrag_status` (beendet · abgebrochen · nicht_angetroffen · abgeschlossen · laufend …), `ende_art`, `abbruch_code`, `erhebungsmodus`, `papier_datum`, `beantwortet`, `ausgelassen`, `export_status` (offen · exportiert · bestaetigt), `testmodus`, `geraete_id` – so, wie erfasst |
| `aenderung` | `aenderung_id`, `ts` (mit Millisekunden), `geraete_id`, `app_version`, `art`, `ziel_typ` (eintrag · proband · bereich · aenderung), `ziel_id`, `feld`, `alt`, `neu`, `grund`, `text` |

Änderungsarten: `KOMMENTAR`, `KOMMENTAR_ZURUECK` (ziel = Kommentar), `UNGUELTIG` (`grund` U1 Testeintrag, U2 falscher
Proband, U3 Fehlbedienung, U4 doppelt, U9 Sonstiges), `UNGUELTIG_AUFGEHOBEN`, `ZUORDNUNG` (Code), `PHASE`, `STATUS`,
`PHASENDATEN` (`feld` = Datumsfeld), `WIDERRUF_LOESCHUNG`, `GELOESCHT` (nicht abgeschlossener Export gelöscht; `alt` = Exportstatus davor; der Eintrag zählt nicht, es gibt keine Datei). Der wirksame Stand ergibt sich, indem die Änderungen eines
Ziels nach `ts` angewendet werden; die Einträge selbst bleiben unverändert.

## Komplettsicherung (`HXNOW_Komplettsicherung_…json`)

JSON mit `format` = `hxnow-beobachtung-sicherung`, `formatVersion` 3, `erstellt`, `geraeteId`, `appVersion`,
`schemaVersion`, `dbVersion`, `anzahl` (je Store), `pruefsumme` (CRC32 über `JSON.stringify(stores)`) und `stores` mit
allen Datensätzen aller Stores außer `meta`. Formate 1 und 2 (ohne Prüfsumme) bleiben ladbar.

## Teilnehmerliste (`HXNOW_Teilnehmende_…`)

Spalten `pseudonym`, `bereich`, `status`, `registriert` (Datum), `notiz`. Zum Laden genügen `pseudonym` und
optional `bereich`, `status`, `notiz`.

## Widerrufsprotokoll (`HXNOW_Widerruf_…`)

Text: Code, Zeitpunkt, Gerät, Anzahl gelöschter Blöcke, Versuche und Fragebögen und die Namen aller Dateien des
Codes, die im Exportordner zu löschen sind.

## Ausgabe des Zusammenführungstools

`werkzeuge/zusammenfuehren.html` erzeugt `HXNOW_Auswertung_<JJJJMMTT>_<HHMM>.zip`:

| Datei | Inhalt |
| --- | --- |
| `beobachtung_bereinigt.csv` | wie `beobachtung.csv`, aber Episoden unter der Mindestdauer (3 s, `regelnAuswertung` im Kodierschema; HX Now T3 ausgenommen) der vorangehenden Episode zugeschlagen und gleich kodierte Nachbarn vereint; Spalte `zusammengelegt` = Zahl der Rohzeilen |
| `beobachtung.csv`, `versuche.csv`, `fb_long.csv` | alle Zeilen der Sitzungsdateien; `pseudonym` und `phase` = wirksamer Stand, zusätzlich `gueltig` (0/1), `ungueltig_grund`, `pseudonym_original`, `phase_original` |
| `tageskennzahlen.csv` | alle Tageskennzahlen |
| `fb1_wide.csv`, `kb_wide.csv`, `fb2_wide.csv` | eine Zeile je gültigem Bogen, eine Spalte je Zelle (`wert`, bei Freitext `wert_text`) |
| `prae_post.csv` | je Code und Paar-ID: FB1-Wert, FB2-Wert und `fb2_wert_wie_fb1` (FB2 auf FB1-Codes umkodiert, z. B. W6c) |
| `scores.csv` | ATI (Mittelwert, C3/C6/C8 umgepolt), TAM_PU, TAM_PEOU, TAM_BI (Mittelwerte), SUS (0–100); nur bei vollständigen gültigen Items, auf 4 Stellen gerundet |
| `logbuch_gesamt.csv` | alle Logbuch-Einträge aller Geräte mit wirksamem Stand, Kommentaranzahl und Dateiname |
| `alle_eintraege.csv` | Abgleich Logbuch ↔ Dateien (`pruefung`: Datei fehlt · nicht exportiert · gelöscht · nicht im Logbuch) |
| `phasen.csv` | je Code und Phase: geplant, tatsächlich, Blöcke (gültig/ungültig, Ziel), Minuten, nicht angetroffen, Fragebogen |
| `aenderungen.csv` | alle Änderungen (ohne widerrufene Codes) |
| `HXNOW_CODEBUCH_FB_<version>.csv` | Codebuch der Fragebogen-Zellen |
| `pruefbericht.txt` | Zählungen, verworfene Dateien (Prüfsumme, Widerruf, Probelauf), fehlende Dateien, Hinweise |
