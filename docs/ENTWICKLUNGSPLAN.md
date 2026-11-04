# Entwicklungsplan: Beobachtungs-App „HX Now im Klinikalltag“

Stand: 02.11.2026 (Version 2) · Auftraggeber: Dr. med. Julian Triebelhorn, Klinik und Poliklinik für Innere Medizin II, TUM Klinikum
Grundlage: Kodierhandbuch Fremdbeobachtung, Version 0.2 (Entwurf vom 02.11.2026); inzwischen fortgeschrieben als Entwurf 0.3, siehe [KODIERHANDBUCH_v0.3.md](KODIERHANDBUCH_v0.3.md) und ENTSCHEIDUNGEN Nr. 19–22

> **Hinweis für Claude Code:** Diese Datei ist die verbindliche Spezifikation. Arbeite die Phasen in Abschnitt 11 nacheinander ab. Halte nach jeder Phase an, fasse zusammen, was gebaut wurde und wie es getestet wurde, und warte auf Freigabe. Wenn etwas unklar oder widersprüchlich ist, frage nach, statt zu raten. Halte die Vorgaben in Abschnitt 3 („Harte Vorgaben“) immer ein. Abgestimmte Abweichungen und Klärungen stehen in [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md) und gehen dieser Datei vor.

**Änderungen gegenüber Version 1 (26.10.2026):** Pause mit Grund ersetzt die Kategorie T11 und den Ort O9; Pausen zählen nicht zur Blockzeit · Arbeitskontext beim Blockstart · Nutzungsart auch bei T1/T2 (Pilot, abschaltbar) · Markierung „HX-Now-Gerät dabei“ in der Post-Phase.

---

## 1. Zweck

Die App unterstützt eine Time-Motion-Studie. Eine geschulte Beobachterin begleitet eine Ärztin oder einen Arzt (Proband) für einen Beobachtungsblock von 15 Minuten beobachteter Zeit. Sie kodiert fortlaufend per Tastendruck:

- die Tätigkeit bzw. das genutzte Gerät,
- den Ort,
- bei Geräteepisoden die Nutzungsart, bei HX Now zusätzlich die Körperhaltung.

Ist die Person vorübergehend nicht beobachtbar, pausiert die Beobachterin den Block und gibt beim Fortsetzen den Grund an. Die App vergibt sekundengenaue Zeitstempel. Am Ende des Blocks werden die Daten als CSV exportiert und auf Systeme des TUM Klinikums übertragen. Ausgewertet wird, wie die Probanden ihre Zeit vor (Prä) und nach (Post) Einführung der App HX Now verbringen.

## 2. Zielplattform und Betriebsmodell

- **Gerät:** iPhone (Dienst-iPhone der Beobachterin), Safari, aktuelle iOS-Version. Die App muss zusätzlich auf iPad und in Desktop-Browsern (Chrome, Edge, Safari) funktionieren, für Tests und als Reserve.
- **Kein App Store, keine Installation:** Die App ist eine **Progressive Web App (PWA)**. Sie wird als statische Webseite über HTTPS ausgeliefert. Die Beobachterin fügt sie einmalig über „Teilen → Zum Home-Bildschirm“ hinzu.
- **Offline-fähig:** Nach dem ersten Aufruf läuft die App vollständig offline. Ein Service Worker cacht alle Dateien.
- **Kein Backend:** Der Webserver liefert nur Programmdateien aus. Beobachtungsdaten werden nie an einen Server gesendet. Sie liegen ausschließlich auf dem iPhone, bis sie per Export übertragen werden.
- **Hosting:** beliebiger statischer HTTPS-Hoster, z. B. GitHub Pages. Alle Pfade relativ. **Die Domain darf während der Studie nicht wechseln**, weil die lokalen Daten an die Herkunft (Origin) gebunden sind.

## 3. Harte Vorgaben

1. **Keine externen Abhängigkeiten zur Laufzeit:** kein CDN, keine externen Schriften, keine Analyse- oder Tracking-Dienste, keine Fremdbibliotheken im ausgelieferten Code. Reines HTML, CSS und JavaScript (ES-Module).
2. **Kein Build-Schritt notwendig:** Die Dateien im Repository sind direkt auslieferbar. Für Tests sind Dev-Abhängigkeiten erlaubt (Abschnitt 12).
3. **Keine Netzwerkanfragen mit Daten:** Außer dem Laden der eigenen statischen Dateien keine Requests. Festgeschrieben per Content-Security-Policy im HTML-Kopf, z. B. `default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'`.
4. **Keine Namen:** Kein Namensfeld. Probanden nur über ihren Studien-Code (Pseudonym). Kommentar- und Freitextfelder zeigen den Hinweis „Keine Namen von Personen eintragen“.
5. **Beobachtungsdaten nur in IndexedDB**, nicht in `localStorage`. `localStorage` nur für Bedienkomfort (z. B. zuletzt gewähltes Beobachter-Kürzel).
6. **Zeiten immer absolut:** Jeder Zeitstempel ist `Date.now()` zum Zeitpunkt des Tipps. Dauern, Countdown und beobachtete Zeit werden aus Zeitstempeln berechnet, nie aus laufenden Timern. Die App muss nach Sperren, App-Wechsel oder Neuladen den exakten Zustand wiederherstellen, auch eine laufende Pause.
7. **Jede Eingabe wird sofort persistiert:** Vor jeder sichtbaren Bestätigung im UI ist die IndexedDB-Transaktion abgeschlossen.
8. **Das Kodierschema wird nicht hart codiert.** Kategorien, Regeln und Beschriftungen kommen aus `kodierschema.json` (Abschnitt 5) und werden mit Version in jeden Export geschrieben.
9. **Rohdaten bleiben roh:** Die App speichert jede Episode und Pause so, wie sie getippt wurde. Regeln wie die Mindestdauer von 5 Sekunden wendet erst das Zusammenführungstool an (Abschnitt 9).
10. **Sprache der Oberfläche:** Deutsch. Code-Kommentare auf Deutsch, Bezeichner einheitlich.

## 4. Fachliche Regeln aus dem Kodierhandbuch (v0.2)

- **Blockdauer:** 15:00 Minuten **beobachtete** Zeit (`blockDauerSek: 900`). Pausen zählen nicht dazu. *(Abweichung: wählbar 10 oder 15 min, siehe ENTSCHEIDUNGEN Nr. 7.)*
- **Lückenlose Kodierung der beobachteten Zeit:** Außerhalb von Pausen gilt zu jedem Zeitpunkt genau eine Tätigkeitskategorie (T1–T10) und genau ein Ort (O1–O8). Parallele Tätigkeiten gibt es nicht; die Beobachterin wendet die Prioritätsregel selbst an.
- **Episodenwechsel:** Eine neue Episode beginnt, sobald sich T oder O ändert. Bei Geräteepisoden (T1–T3) zusätzlich bei Wechsel der Nutzungsart (N), bei T3 auch bei Wechsel der Haltung (H).
- **Episodenende:** mit dem Start der nächsten Episode, dem Beginn einer Pause oder dem Blockende.
- **T3 nur in der Post-Phase:** In Prä-Blöcken ist T3 deaktiviert.
- **Nutzungsart:** bei T3 Pflicht (N1–N4, N9). Bei T1 und T2 nur, wenn in der Konfiguration eingeschaltet (`nutzungsartBeiT1T2: true`, Pilot); dann N1–N3, N9 (N4 nur T3). Bei T4–T10 keine Nutzungsart. *(Bei T1/T2 optional, siehe ENTSCHEIDUNGEN Nr. 10.)*
- **Haltung:** nur bei T3, Pflicht (H1–H4).
- **Unvollständige Zusatzkodierung:** Wird N bzw. H nicht direkt gewählt, wird `N9` bzw. `null` gespeichert und die Episode als „unvollständig“ markiert. Ergänzung ist bis zum Blockabschluss möglich.
- **Pause:** Ersetzt die frühere Kategorie T11 „Nicht beobachtbar“ und den Ort O9.
  - „Pause“ beendet die laufende Episode und hält die Blockzeit an.
  - „Fortsetzen“ fragt zuerst den Grund ab (P1–P5, bei P5 Freitext Pflicht), dann die aktuelle Tätigkeit und den Ort (vorbelegt mit den Werten vor der Pause). Danach beginnt eine neue Episode.
  - Dauert eine Pause länger als `pauseMaxSek` (Standard 300), zeigt die App einen deutlichen Hinweis „Block mit A3 abbrechen?“. Sie bricht nicht automatisch ab.
- **Abbruch:** jederzeit möglich, auch während einer Pause, mit Pflichtgrund A1–A4 (bei A4 Kommentar Pflicht). Abgebrochene Blöcke werden mit Endzeit gespeichert und exportiert.
- **Arbeitskontext:** einmal beim Blockstart, Pflicht (K1–K7, Abschnitt 5).
- **HX-Now-Gerät dabei (nur Post-Phase):**
  - Ein Schalter „Gerät dabei“ ist während des ganzen Blocks sichtbar und kann jederzeit gesetzt werden (Zeitpunkt wird gespeichert).
  - Bei der ersten T3-Episode wird er automatisch gesetzt.
  - Beim Blockabschluss fragt die App: „War ein HX-Now-Gerät dabei?“ ja · nein · nicht erkennbar. Vorbelegt mit „ja“, wenn der Schalter gesetzt ist, sonst ohne Vorbelegung. Bei automatisch gesetztem Schalter (T3 kodiert) ist „nein“ nicht wählbar.
- **Nicht angetroffen:** Ist die geplante Person nicht auffindbar, wird ein Versuch ohne Episoden dokumentiert (Store `versuche`).
- **Tageskennzahlen:** pro Beobachtungstag und Bereich: Bettenbelegung bzw. Patientenzugänge, Zahl der anwesenden Ärztinnen und Ärzte, besondere Ereignisse.

## 5. Konfigurationsdatei `kodierschema.json`

Die App lädt diese Datei beim Start; der Service Worker cacht sie. Eine geänderte Version erfordert eine neue App-Version (Cache-Busting über die Versionsnummer im Service Worker). Die Struktur ist verbindlich; die Inhalte entsprechen dem Kodierhandbuch v0.2. Die gültige Datei liegt im Repository-Wurzelverzeichnis; Ergänzungen (`blockDauerOptionenSek`, `nutzungsartPflicht`, `setztGeraetDabei`) siehe ENTSCHEIDUNGEN.

Pflichtinhalte: `schemaVersion`, `studie`, `blockDauerSek`, `warnungVorEndeSek`, `pauseMaxSek`, `nutzungsartBeiT1T2`, `pseudonym` (`muster`, `beispiel`, `pruefziffer`), `beobachter`, `bereiche`, `dienste`, `phasen`, `arbeitskontext` (mit `gruppe`), `taetigkeiten` (mit `kurz`, optional `geraet`, `nurPhase`, `haltung`), `orte`, `nutzungsart` (mit `giltFuer`), `haltung`, `pausengruende` (optional `freitextPflicht`), `abbruchgruende` (optional `kommentarPflicht`), `geraetDabeiOptionen` (J/N/U), `export` (`mailEmpfaenger`, `mailBetreffPraefix`), `regelnAuswertung` (`mindestdauerSek`, `mindestdauerAusnahmen`).

Beim Start validiert die App die Datei: Pflichtfelder vorhanden, Codes eindeutig, Referenzen gültig (`nurPhase`, `giltFuer`). Bei Fehlern erscheint eine klare Fehlermeldung, und es kann kein Block gestartet werden. Ist `nutzungsartBeiT1T2` `false`, werden bei T1/T2 keine Nutzungsart-Tasten angezeigt.

## 6. Datenmodell (IndexedDB)

Datenbank `hxnow-beobachtung` (Version 2: neuer Store `pausen`). IDs sind zufällige UUIDs (`crypto.randomUUID()`). Zeitstempel als Millisekunden seit Epoche; Formatierung erst im Export.

**Store `bloecke`** (Schlüssel `blockId`): `blockId`, `geraeteId`, `schemaVersion`, `appVersion`, `pseudonym`, `beobachter`, `bereich`, `dienst`, `phase`, `arbeitskontext` (K1–K7), `startTs`, `endTs` (Wandzeit), `status` (`laufend` · `pausiert` · `beendet` · `abgebrochen`; zusätzlich `verworfen`, ENTSCHEIDUNGEN Nr. 3), `abbruchCode`, `kommentar`, `hxGeraetMarkiertTs` (erster Zeitpunkt des Schalters, nur POST), `hxGeraetAutomatisch` (Schalter durch T3 gesetzt), `hxGeraetDabei` (J/N/U, Bestätigung am Blockende, nur POST), `exportStatus` (`offen` · `exportiert` · `bestaetigt`), `exportiertTs`, `bestaetigtTs`.

**Store `episoden`** (Schlüssel `episodeId`, Index `blockId`): `episodeId`, `blockId`, `nr`, `startTs`, `taetigkeit` (T1–T10), `ort` (O1–O8), `nutzungsart` (bei T3, bei T1/T2 wenn eingeschaltet), `haltung` (nur T3), `unvollstaendig` (Pflicht-Zusatzkodierung fehlt), `kommentar`, `geloescht` (durch „Rückgängig“; nicht exportiert, bleibt gespeichert).

**Store `pausen`** (Schlüssel `pauseId`, Index `blockId`): `pauseId`, `blockId`, `startTs`, `endTs` (Fortsetzen oder Abbruch), `grund` (P1–P5, gesetzt beim Fortsetzen; bei Abbruch während der Pause optional), `freitext` (bei P5 Pflicht).

Das Ende einer Episode wird nicht gespeichert, sondern beim Export berechnet: Start der nächsten nicht gelöschten Episode, Beginn einer Pause oder `endTs` des Blocks, je nachdem, was zuerst kommt.

**Beobachtete Zeit** = (`endTs` bzw. jetzt) − `startTs` − Summe aller Pausendauern (laufende Pause bis jetzt). Das reguläre Blockende ist der Zeitpunkt, an dem die beobachtete Zeit `blockDauerSek` erreicht.

**Weitere Stores** (unverändert gegenüber Version 1): `versuche` (nicht angetroffene Personen), `tageskennzahlen` (Schlüssel `datum + bereich`), `meta` (`geraeteId`, Installationsdatum, Schema-Version).

Beim ersten Start ruft die App `navigator.storage.persist()` auf und zeigt das Ergebnis in den Einstellungen.

## 7. Bildschirme und Bedienung

Schlicht, hoher Kontrast, große Tasten (mindestens 48 × 48 pt), einhändig bedienbar, Hochformat, Dunkelmodus über `prefers-color-scheme`. Keine Animationen, die Eingaben verzögern.

### 7.1 Startseite

- Großer Knopf **„Neuer Block“**, dazu **„Person nicht angetroffen“** und **„Tageskennzahlen“**.
- **Liste nicht abgeschlossener Exporte** (Blöcke, Versuche, Tageskennzahlen mit `exportStatus` ≠ `bestaetigt`), je mit „Exportieren“ und „Eingang bestätigt“. Rotes Banner, wenn ein Eintrag älter als 24 Stunden nicht bestätigt ist.
- Läuft oder pausiert ein Block, springt die App beim Öffnen direkt in die Kodieransicht.
- Menü: Einstellungen, Datensicherung, Info (App-Version, Schema-Version, Speicherstatus).

### 7.2 Block anlegen

- Felder: Studien-Code (Prüfung gegen `pseudonym.muster`), Beobachter (letzter Wert vorbelegt), Bereich, Dienst, Phase, **Arbeitskontext** (zweistufig: erst Gruppe Station / Funktionsbereich / Ambulanz / Notaufnahme, bei Station und Notaufnahme dann die Unterauswahl). Datum und Uhrzeit setzt die App.
- Erst wenn alle Felder gültig sind, wird **„Block starten“** aktiv.
- Nach dem Start folgt sofort die Wahl von T und O. Die erste Episode beginnt zum Blockstart.

### 7.3 Kodieransicht

Aufbau von oben nach unten:

1. **Kopfzeile:** Studien-Code, Phase, Kontext, verbleibende **beobachtete** Zeit als großer Countdown `mm:ss`. In den letzten `warnungVorEndeSek` Sekunden farbig hervorgehoben. Während einer Pause zeigt der Countdown „PAUSE“ und die laufende Pausendauer.
2. **Nur Post-Phase:** Schalter **„HX-Now-Gerät dabei“** (gut erreichbar, aber deutlich kleiner als die Kodiertasten, damit er nicht versehentlich getippt wird). Zeigt an, ob er automatisch gesetzt wurde.
3. **Aktuelle Episode:** T, O, ggf. N und H, Laufzeit der Episode.
4. **Tätigkeitstasten T1–T10:** Raster mit 3 Spalten, Beschriftung `kurz` plus Code. Aktive Taste hervorgehoben. T3 in der Prä-Phase deaktiviert.
5. **Ortstasten O1–O8:** kleiner, zweizeilig.
6. **Bei aktiver Geräteepisode:** Zeile mit Nutzungsart-Tasten (gefiltert nach `giltFuer`); bei T3 zusätzlich Haltung H1–H4.
7. **Fußzeile:** großer Knopf **„Pause“** (während einer Pause: **„Fortsetzen“**), dazu „Rückgängig“, „Kommentar“, „Abbruch“ (und „Beenden“, ENTSCHEIDUNGEN Nr. 3).

Verhalten:

- Ein Tipp auf eine nicht aktive T- oder O-Taste beendet die laufende Episode und startet eine neue; der jeweils andere Wert wird übernommen. Wechsel zwischen Geräten setzt die Nutzungsart zurück.
- Ein Tipp auf die bereits aktive Taste bewirkt nichts.
- Nutzungsart und Haltung werden in der laufenden Episode gesetzt, solange sie leer sind; ein späterer Wechsel erzeugt eine neue Episode.
- Erster Tipp auf T3 in der Post-Phase setzt den Schalter „Gerät dabei“ automatisch.
- **Rückgängig:** markiert die zuletzt gestartete Episode als `geloescht`; die vorherige läuft weiter. Nicht über die erste Episode und nicht über eine Pause hinweg.
- **Pause / Fortsetzen:** siehe Abschnitt 4. Während einer Pause sind T-, O-, N- und H-Tasten ausgegraut. Nach Überschreiten von `pauseMaxSek` erscheint der Hinweis zum Abbruch mit A3.
- **Abbruch:** Dialog A1–A4, bei A4 Kommentar Pflicht; `endTs = jetzt`, eine laufende Pause wird mit beendet. Weiter zu 7.4.
- **Reguläres Ende:** sobald die beobachtete Zeit `blockDauerSek` erreicht, automatisch, auch wenn die App erst später wieder geöffnet wird (Berechnung aus Zeitstempeln). Eingaben danach sind nicht möglich.
- Optional, wenn verfügbar: Screen Wake Lock während eines laufenden Blocks. Optional: kurzer Ton 1 Minute vor Ende und bei Blockende, abschaltbar. iOS Safari unterstützt keine Vibration.

### 7.4 Blockabschluss und Export

- **Nur Post-Phase, zuerst:** Pflichtabfrage „War ein HX-Now-Gerät dabei?“ ja · nein · nicht erkennbar (Vorbelegung siehe Abschnitt 4).
- **Zusammenfassung:** beobachtete Zeit, Anzahl und Gesamtdauer der Pausen, Anzahl Episoden, Anteil je Tätigkeit, Hinweise auf unvollständige Episoden (hier noch ergänzbar).
- Großer Knopf **„Abschließen und exportieren“**.
- **Wichtige technische Einschränkung:** `navigator.share()` darf in Safari nur direkt aus einer Nutzergeste aufgerufen werden. Deshalb:
  - Das automatische Blockende öffnet das Teilen-Menü **nicht** selbst, sondern zeigt die Abschlussseite.
  - Im Klick-Handler des Export-Knopfs wird die CSV-Datei **synchron aus dem im Speicher gehaltenen Zustand** erzeugt; `navigator.share()` wird ohne vorheriges `await` auf IndexedDB aufgerufen. Statusänderungen in der Datenbank erfolgen danach.
- **Exportwege**, in dieser Reihenfolge:
  1. `navigator.canShare({ files: [file] })` → `navigator.share({ files: [file], title })`. Bei Erfolg `exportStatus = exportiert`; bei `AbortError` bleibt `offen`.
  2. **Download:** Blob-URL mit `<a download="…">`, danach Rückfrage „Datei gespeichert?“.
  3. **Mail:** `mailto:` an `export.mailEmpfaenger` mit Betreff und CSV im Mailtext; nur wenn ein Empfänger konfiguriert ist. Bei mehr als 8.000 Zeichen URL-Länge Hinweis und Weg 4.
  4. **Zwischenablage:** CSV kopieren, mit Hinweis.
- **Eingang bestätigt:** eigener Knopf; erst danach darf gelöscht werden.
- **Löschen:** nur manuell über „Bestätigte Einträge löschen“ in der Datensicherung, mit Sicherheitsabfrage.

### 7.5 Datensicherung

- „Alle Daten exportieren (JSON)“: vollständiger Abzug aller Stores (Notfallsicherung).
- „JSON importieren“: ohne Überschreiben; doppelte IDs werden übersprungen.
- „Bestätigte Einträge löschen“.

## 8. Exportformat

**Dateiname:** `HXNOW_BEOB_<pseudonym>_<JJJJMMTT>_<HHMM>_<blockId-erste-8-Zeichen>.csv`

**Format:** UTF-8 mit BOM, Semikolon, Zeilenende `\r\n`, Quoting nach RFC 4180. Eine Kopfzeile, danach **eine Zeile pro Episode und eine Zeile pro Pause**, chronologisch sortiert (Long-Format). Blockdaten werden in jeder Zeile wiederholt.

| Spalte | Beispiel | Hinweis |
| --- | --- | --- |
| `datensatz` | `episode` / `pause` | Zeilentyp |
| `block_id`, `geraete_id` | UUID | |
| `schema_version`, `app_version` | `0.2`, `2.0.0` | |
| `pseudonym`, `beobachter`, `bereich`, `dienst`, `phase` | `P017`, `B1`, `NEPH`, `F`, `POST` | |
| `arbeitskontext` | `K1` | |
| `datum` | `2026-12-03` | |
| `block_start`, `block_ende` | ISO-Zeit mit Offset | Wandzeit |
| `block_beobachtet_sek` | `900` | ohne Pausen |
| `block_pausen_anzahl`, `block_pausen_sek` | `1`, `74` | |
| `block_status`, `abbruch_code`, `block_kommentar` | `beendet`, leer, Text | |
| `hx_geraet_dabei` | `J` / `N` / `U` / leer | leer in Prä |
| `hx_geraet_automatisch` | `0` / `1` | |
| `nr` | `1` | laufend über Episoden und Pausen |
| `start`, `ende` | ISO-Zeit mit Offset | |
| `dauer_sek` | `47` | ganze Sekunden |
| `taetigkeit`, `ort` | `T3`, `O2` | leer bei Pause |
| `nutzungsart`, `haltung` | `N1`, `H1` | leer, wenn nicht zutreffend |
| `unvollstaendig` | `0` / `1` | |
| `pause_grund`, `pause_freitext` | `P1`, Text | nur bei Pause |
| `kommentar` | Text | Episodenkommentar |
| `n_zeilen_block` | `24` | Anzahl Zeilen dieses Blocks, zur Vollständigkeitsprüfung |

Zusätzliche Spalten laut ENTSCHEIDUNGEN: `block_dauer_soll_sek`, `block_ende_art`, `block_ende_grund`, `hx_geraet_markiert`, `neben_<Code>` (Nr. 19). Bedeutung aller Spalten: [CODEBUCH_EXPORT.md](CODEBUCH_EXPORT.md). Die tatsächliche Spaltenreihenfolge steht in `js/export.js` (`spaltenBeobachtung`) und in der Referenzdatei `tests/unit/referenz/`.

Versuche und Tageskennzahlen werden als eigene kleine CSV-Dateien exportiert (`HXNOW_VERSUCH_…`, `HXNOW_TAG_…`), Spalten analog zu den Stores.

## 9. Zusammenführungstool `zusammenfuehren.html`

Eigenständiges HTML-Dokument im selben Repository, lauffähig per Doppelklick (`file://`) auf einem Windows-PC der Klinik: kein `fetch`, kein Service Worker, Kodierschema per Dateiauswahl oder eingebettet.

1. Mehrfachauswahl aller Export-CSV-Dateien.
2. **Prüfungen** (Ergebnis in `pruefbericht.txt`):
   - Spaltenkopf korrekt, Schema-Version bekannt
   - Codes gültig laut Kodierschema
   - Zeilenzahl = `n_zeilen_block`
   - doppelte `block_id` (identische zusammenfassen, abweichende melden)
   - Lücken oder Überlappungen zwischen Episoden und Pausen
   - Summe der Episodendauern = `block_beobachtet_sek` (±1 s); Summe der Pausen = `block_pausen_sek`
   - beobachtete Zeit ≠ 900 s ohne Abbruchcode *(gegen `block_dauer_soll_sek`, ENTSCHEIDUNGEN Nr. 7)*
   - Pause länger als `pauseMaxSek` ohne anschließenden Abbruch A3 (Hinweis, kein Fehler)
   - T3 in Prä-Phase; Nutzungsart bei T4–T10; N4 bei T1/T2; Haltung ohne T3; `hx_geraet_dabei` in Prä; `N` bei gleichzeitig `hx_geraet_automatisch = 1`
3. **Abgeleitete Spalten** (Rohdaten bleiben erhalten): `episode_bereinigt` und `dauer_bereinigt_sek` nach der Mindestdauer-Regel (Episoden unter `mindestdauerSek` außer T3 der vorangehenden Episode zuschlagen; nicht über eine Pause hinweg).
4. **Ausgaben:**
   - `episoden_gesamt.csv` (roh + bereinigt)
   - `pausen_gesamt.csv`
   - `bloecke_gesamt.csv` (eine Zeile pro Block, inkl. Kontext, Pausen, Gerät dabei)
   - `zeitanteile.csv` (Sekunden und Prozent je Tätigkeit pro Pseudonym × Phase, bereinigt; zusätzlich je Arbeitskontext)
   - `versuche_gesamt.csv`, `tageskennzahlen_gesamt.csv`, `pruefbericht.txt`

Die statistische Auswertung (R/SPSS) gehört nicht zum Umfang.

## 10. Repository-Struktur

```
/
├── index.html                 App-Shell, CSP im <head>
├── manifest.webmanifest       Name, Icons, display: standalone, start_url: "./"
├── sw.js                      Service Worker: versionierter Cache, Cache-first
├── kodierschema.json          siehe Abschnitt 5
├── css/app.css
├── js/
│   ├── main.js                Start, Routing
│   ├── schema.js              Laden + Validieren des Kodierschemas
│   ├── db.js                  IndexedDB-Zugriff
│   ├── block.js               Fachlogik: Episoden, Pausen, Rückgängig, beobachtete Zeit, Blockende, Abbruch, Gerät dabei (DOM-frei)
│   ├── zeit.js                Zeitformatierung, Countdown, ISO mit Offset (DOM-frei)
│   ├── export.js              CSV-Erzeugung (DOM-frei) + Exportwege
│   ├── auswertung.js          Prüf- und Bereinigungslogik für das Zusammenführungstool (DOM-frei)
│   ├── sicherung.js           JSON-Export/-Import
│   └── ui/                    eine Datei pro Ansicht
├── icons/                     App-Icons (180×180 für iOS, 192, 512), schlicht
├── zusammenfuehren.html       eigenständig; auswertung.js per Skript eingebettet (npm run build:merge)
├── tests/
│   ├── unit/                  node --test
│   └── e2e/                   Playwright
├── docs/
│   ├── ANLEITUNG_BEOBACHTERIN.md
│   ├── ANLEITUNG_ZUSAMMENFUEHREN.md
│   └── TESTPROTOKOLL_IPHONE.md
├── CHANGELOG.md
└── README.md                  Hosting, Versionierung, Update-Ablauf
```

Das Einbetten von `auswertung.js` in `zusammenfuehren.html` ist der einzige erlaubte „Build“-Schritt, weil `file://` keine ES-Module von der Festplatte lädt. Das Ergebnis wird mit eingecheckt.

## 11. Umsetzung in Phasen

Nach jeder Phase: anhalten, Ergebnis zusammenfassen, Testergebnisse zeigen, auf Freigabe warten.

| Phase | Inhalt | Abnahmekriterien |
| --- | --- | --- |
| **0. Grundgerüst** | Repository-Struktur, `index.html` mit CSP, Manifest, leerer Service Worker, `kodierschema.json`, `schema.js` mit Validierung, Testinfrastruktur. | App lädt lokal, Schema wird validiert, fehlerhaftes Schema erzeugt verständliche Meldung, Unit-Tests laufen. |
| **1. Fachlogik** | `block.js`, `zeit.js` ohne UI: alle Regeln aus Abschnitt 4. | Unit-Tests für jede Regel, u. a.: T3 in Prä abgelehnt; Nutzungsart-Filter nach `giltFuer` und Schalter `nutzungsartBeiT1T2`; N/H-Wechsel erzeugt neue Episode; Pause beendet Episode und stoppt die beobachtete Zeit; Fortsetzen ohne Grund nicht möglich, P5 ohne Freitext nicht möglich; Blockende nach 900 s beobachteter Zeit auch mit mehreren Pausen und bei verspätetem Aufruf; Rückgängig nicht über Pause hinweg; T3 setzt „Gerät dabei“ automatisch; Summe Episoden + Pausen = Wandzeit des Blocks. |
| **2. Persistenz** | `db.js` mit allen Stores; sofortiges Schreiben; Wiederherstellung laufender und pausierter Blöcke; `navigator.storage.persist()`. | E2E: Block starten, Episoden tippen, pausieren, neu laden → identischer Zustand inklusive laufender Pause und korrektem Countdown. |
| **3. Oberfläche** | Startseite, Block anlegen (inkl. zweistufigem Arbeitskontext), Kodieransicht mit Pause und Gerät-Schalter, Abschlussseite, Tageskennzahlen, Versuche. | Kompletter Block mit 20 Episoden, 2 Pausen, T3 mit N/H und T1 mit N in Playwright (iPhone-Profil); keine Taste kleiner als 48 pt außer dem Gerät-Schalter (mind. 44 pt). |
| **4. Export** | CSV nach Abschnitt 8, vier Exportwege, Statusverwaltung, Banner, JSON-Sicherung und -Import. | CSV entspricht exakt dem Format (Referenzdatei); Teilen-Aufruf ohne `await` davor (Code-Review + Test mit gemocktem `navigator.share`); Import ohne Dubletten. |
| **5. Offline und PWA** | Versionierter Cache, Update-Hinweis („nach dem aktuellen Block neu laden“), Icons, iOS-Meta-Tags. | Lighthouse-PWA-Prüfung ohne Fehler *(ersetzt durch eigene Prüfungen, ENTSCHEIDUNGEN Nr. 5)*; Start im Flugmodus; Update unterbricht keinen laufenden Block. |
| **6. Zusammenführungstool** | `zusammenfuehren.html`, `auswertung.js`, Einbett-Skript. | 30 generierte Testdateien mit absichtlichen Fehlern (Lücke, Dublette, falscher Code, abgeschnittene Datei, zu lange Pause, N4 bei T1): jeder Fehler genau einmal im Prüfbericht; bereinigte Dauern stimmen mit Handrechnung; läuft per Doppelklick unter `file://` in Chrome und Edge. |
| **7. Dokumentation und Testprotokoll** | Anleitungen, README, Vorlage iPhone-Testprotokoll. | Eine Person ohne Vorkenntnisse kann mit der Anleitung einrichten, einen Block mit Pause kodieren und exportieren. |

## 12. Tests

- **Unit-Tests** (`node --test`) für alle DOM-freien Module; Zeit über injizierbare Uhr (`now()`), damit Tests deterministisch sind.
- **E2E-Tests** mit Playwright (Dev-Abhängigkeit), Geräteprofil iPhone; wenn WebKit verfügbar, zusätzlich WebKit. `navigator.share` wird gemockt.
- **Testdaten-Generator** (`tests/generator.js`) für realistische, fiktive Exportdateien inklusive Fehlerfällen.
- **Manuelles Testprotokoll auf echten Dienst-iPhones** (`docs/TESTPROTOKOLL_IPHONE.md`), vor Studienbeginn:
  1. Zum Home-Bildschirm hinzufügen, Start im Vollbild
  2. Flugmodus: App startet, Block läuft
  3. Während eines Blocks 3 Minuten sperren → Countdown und Episoden korrekt
  4. Während einer Pause sperren und nach 2 Minuten fortsetzen → Pausendauer korrekt, Countdown stand still
  5. App-Wechsel und zurück; App aus dem App-Umschalter beenden und neu öffnen → Block wird fortgesetzt
  6. Block läuft ab, während das iPhone gesperrt ist → Abschlussseite beim Öffnen
  7. Export über Teilen-Menü in die Dateien-App und auf das Klinikums-Netzlaufwerk (falls per SMB eingebunden)
  8. Export per Mail an das Studienpostfach
  9. Stromsparmodus / Akku unter 5 %: Eingaben werden weiter gespeichert
  10. iPhone-Neustart → nicht bestätigte Daten noch vorhanden
  11. Nach 8 Tagen ohne Nutzung: Daten noch vorhanden
  12. JSON-Sicherung erstellen und auf einem zweiten Gerät importieren

## 13. Datenschutz-Checkliste für den Code

- [ ] Kein Namensfeld; Freitext-Pflicht nur bei A4 und P5
- [ ] Hinweis „Keine Namen eintragen“ an jedem Kommentar- und Freitextfeld
- [ ] CSP verhindert Netzwerkanfragen außer an die eigene Origin
- [ ] Keine Drittanbieter-Ressourcen
- [ ] Keine Beobachtungsdaten in `localStorage`, Cookies oder URL-Parametern
- [ ] Export-Dateinamen enthalten nur Pseudonym, Datum, Uhrzeit und Block-ID
- [ ] Löschen nur nach Bestätigung, nie automatisch
- [ ] `geraeteId` ist zufällig und enthält keine Gerätemerkmale

## 14. Offene Punkte

1. **Format des Studien-Codes:** Muster und ob eine Prüfziffer verwendet wird. Bis zur Klärung gilt `^P\d{3}$`.
2. **Beobachter-Kürzel und Bereiche:** endgültige Listen.
3. **Nutzungsart bei T1/T2:** Nach den Pilotbeobachtungen entscheiden, ob sie bleibt. Wenn nicht: `nutzungsartBeiT1T2: false` setzen; kein Code-Umbau nötig.
4. **Kodierhandbuch:** Version 0.2 ist ein Entwurf; nach den Pilotbeobachtungen als 1.0 festschreiben und `schemaVersion` anpassen. Maximale Pausendauer `[5]` Minuten bestätigen.
5. **Hosting:** GitHub Pages oder Klinikums-Webserver; Domain muss während der Studie stabil bleiben.
6. **Exportziel:** Netzlaufwerk über die Dateien-App (SMB), Studien-Funktionspostfach oder Klinikums-Cloudspeicher; mit der Klinik-IT klären und den Mail-Empfänger in `kodierschema.json` eintragen.
7. **Dienst-iPhones:** Prüfen, ob das Gerätemanagement „Zum Home-Bildschirm“ oder das Speichern von Dateien einschränkt; iOS-Version.
8. **Zweitkodierung** (Kodierhandbuch 6.3, optional): mögliche Phase 8 im Zusammenführungstool (Paarung von Blöcken, Cohens Kappa).
9. **Studienunterlagen:** Protokoll und Änderungsanzeige an die Ethikkommission um die neuen Erfassungsfelder (Pausen, Arbeitskontext, Nutzungsart bei T1/T2, Gerät dabei) und die Beschreibung „Erfassung lokal auf dem Dienstgerät, Export auf Klinikumssysteme“ ergänzen.
