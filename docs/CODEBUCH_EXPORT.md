# Codebuch der Exportdateien

Gilt ab App-Version 0.4.0 (Kodierschema 0.2). Beschreibt jede Spalte der CSV-Dateien, die die Beobachtungs-App
exportiert. Die Bedeutung der Codes (T1–T10, O1–O8 usw.) steht im Kodierhandbuch und in `kodierschema.json`
(Version in der Spalte `schema_version`).

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
| Tageskennzahlen | `HXNOW_TAG_<bereich>_<JJJJMMTT>_<HHMM>.csv` |
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
| `taetigkeit` | Tätigkeit/Gerät | `T1`–`T10`; leer bei Pause |
| `ort` | Ort | `O1`–`O8`; leer bei Pause |
| `nutzungsart` | Nutzungsart | `N1`–`N4`, `N9`; nur bei T1–T3, leer = nicht kodiert |
| `haltung` | Körperhaltung | `H1`–`H4`; nur bei T3 |
| `unvollstaendig` | Pflichtangabe (Nutzungsart/Haltung bei T3) fehlt | `1`, `0`; leer bei Pause |
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

Die JSON-Sicherung enthält zusätzlich: rückgängig gemachte Episoden (`geloescht: true`), den Zeitpunkt des Tipps,
der eine Episode angelegt hat (`erfasstTs`), und Korrekturen im Korrekturfenster (`korrekturen`: überschriebene
Tätigkeit, Ort, Nutzungsart und Haltung mit Zeitpunkt).

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
| `datum`, `bereich` | Tag und Bereich (Schlüssel) |
| `auslastung` | Bettenbelegung (Station) bzw. Patientenzugänge (Notaufnahme) |
| `aerzte_anwesend` | Zahl der anwesenden Ärztinnen und Ärzte |
| `ereignisse` | besondere Ereignisse, Freitext |
| `beobachter` | Kürzel |
| `geraete_id`, `schema_version`, `app_version` | wie oben |
| `erfasst` | Zeitpunkt der Erfassung |
