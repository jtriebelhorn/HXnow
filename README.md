# HX Now Beobachtung

Progressive Web App für die Time-Motion-Studie „HX Now im Klinikalltag“. Reines HTML/CSS/JavaScript,
kein Backend, keine externen Abhängigkeiten zur Laufzeit. Verbindliche Spezifikation:
[docs/ENTWICKLUNGSPLAN.md](docs/ENTWICKLUNGSPLAN.md).

Stand 1.2.0: Beobachtung nach [Kodierhandbuch 2.0](docs/KODIERHANDBUCH_v2.0.md) und Kodierschema 2.2
(Festschreibung 09.11.2026 mit 1.0; seitdem T11 Diagnostik/Intervention), Fragebögen FB1, Kurzbogen und FB2 (Definition 1.0.0), Exportformat 1.1, Teilnehmerliste und Logbuch mit Studienübersicht, Updates mit Migration, Sicherung nach jeder Sitzung,
Wiederherstellen, Korrekturen mit PIN, Widerruf und Zusammenführungstool. Pläne: [docs/plaene/](docs/plaene/);
abgestimmte Abweichungen: [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md).

Für den Studienbetrieb: [Anleitung Doktorandin](docs/ANLEITUNG_DOKTORANDIN.md) ·
[Notfallkarte „Daten weg – was tun?“](docs/NOTFALLKARTE.md) · [Codebuch der Exportdateien](docs/CODEBUCH_EXPORT.md).

## Zusammenführen (am Rechner)

`werkzeuge/zusammenfuehren.html` im Browser öffnen (online unter
https://jtriebelhorn.github.io/HXnow/werkzeuge/zusammenfuehren.html oder lokal mit `npm run serve`), den Exportordner
wählen, ZIP mit Auswertungsdateien und Prüfbericht herunterladen. Die Dateien verlassen den Rechner nicht.

## Lokal ausprobieren

Die App lässt sich **nicht per Doppelklick** auf `index.html` öffnen (Browser blockieren ES-Module und
`kodierschema.json` unter `file://`). Stattdessen im Projektordner:

```
npm run serve
```

und im Browser http://localhost:8080/ öffnen. Daten liegen im Browser (IndexedDB) und bleiben nach dem Schließen erhalten.

## Entwicklung

| Befehl | Zweck |
| --- | --- |
| `npm install` und `npx playwright install chromium webkit` | Dev-Abhängigkeiten (nur für Tests) |
| `npm run serve` | App lokal unter http://localhost:8080/ |
| `npm test` | Unit-Tests (`node --test`) |
| `npm run test:e2e` | E2E-Tests (Playwright, iPhone-Profil mit WebKit und Chromium) |
| `npm run icons` | App-Icons in `icons/` neu erzeugen |
| `npm run version -- <x.y.z> "Hinweis"` | neue Version in `js/version.js`, `sw.js` (inkl. Dateiliste) und `version.json` |
| `npm run codebuch` | Codebuch der Fragebögen (`docs/codebuch/`) neu erzeugen |
| `npm run versionen` | Fingerabdrücke neuer Versionen (Kodierschema, Fragebögen, Exportformat) eintragen |
| `npm run pruefen` | Prüf-Workflow: realitätsnahe Simulation zweier Beobachtungstage, Abgleich aller gespeicherten Daten, Bericht in `pruefberichte/` ([Anleitung](docs/PRUEF_WORKFLOW.md)) |

Die ausgelieferten Dateien im Repository brauchen keinen Build-Schritt.

## Offline-Betrieb

Nach dem ersten Aufruf über HTTPS liegt die App vollständig im Cache des Service Workers und startet ohne Netz.
Beobachtungsdaten liegen ohnehin nur auf dem Gerät. Bei jeder Auslieferung `npm run version -- <x.y.z> "Hinweis"`
ausführen: erhöht `APP_VERSION`, `CACHE_VERSION` und `version.json` gemeinsam und erzeugt die Dateiliste `DATEIEN`
in `sw.js` neu (`npm test` prüft beides; `js/auswertung/` und `werkzeuge/` gehören nicht in den Cache). Geräte erhalten die neue Version, sobald sie online sind, und bieten sie auf der
Startseite zum Aktualisieren an.

## Veröffentlichen (Studienbetrieb)

1. Veröffentlichen darf nur die Studienleitung (Schreibrecht auf `main`); GitHub Pages liefert `main` unter der festen
   Adresse https://jtriebelhorn.github.io/HXnow/ aus. Adresse, Repository-Name und Account nie ändern (iOS bindet den
   Speicher an die Adresse).
2. Jede Version: `npm run version -- <x.y.z> "Hinweistext"` (setzt `js/version.js`, `CACHE_VERSION` in `sw.js` und
   `version.json` gleich; Unit-Test prüft das) und einen Eintrag in `CHANGELOG.md` schreiben: was sich ändert, ob eine
   Datenbank-Migration nötig ist, ob Fragebogen oder Kodierschema betroffen sind.
3. Updates möglichst zwischen den Studienphasen, nicht während eines Beobachtungstags.
4. Datenbank-Migrationen nur ergänzend (neue Stores, Indizes, Felder mit Standardwert), nie löschen oder Schlüssel ändern;
   jede Migration mit Test (`tests/e2e/l0.spec.js`).
5. Testversionen nur mit `TESTVERSION = true` in `js/config.js` (eigene Datenbank, gelbes Band).

## Festschreibung und Versionen (ab 1.0.0)

Kodierschema (`schemaVersion` 1.0), Fragebogen-Definition (`definitionVersion` 1.0.0) und Exportformat
(`EXPORT_FORMAT` 1.0 in `js/export.js`, Spalte `format_version`) sind festgeschrieben. Damit bleiben alle Studiendaten
gleich lesbar, auch wenn die App weiterentwickelt wird:

- Ändert sich der Inhalt eines der drei, muss seine Version steigen: neue Codes, Items oder Spalten → Nebenversion
  (1.1, 1.1.0), geänderte Bedeutung → Hauptversion (2.0). Bestehende Codes, IDs und Spalten nie umdeuten oder löschen.
- `tests/unit/versionen.test.js` vergleicht Fingerabdrücke mit `tests/fixtures/versionen.json`; nach einer bewussten
  Versionserhöhung `npm run versionen` ausführen (alte Einträge bleiben unverändert).
- `tests/unit/referenz/` enthält je Dateityp eine Referenzdatei; jede Abweichung ist eine Formatänderung.
- Kodierhandbuch, Codebuch (`docs/CODEBUCH_EXPORT.md`, `npm run codebuch`) und CHANGELOG gehören zu jeder Änderung.

## Regeln für Fragebögen und IDs

- Item-, Zellen- und Paar-IDs ändern sich nie. Neue Fragen bekommen neue IDs; entfernte bleiben mit `entfernt: true`
  in der Definition (Codebuch und Export bleiben lesbar).
- Inhaltliche Änderung einer Frage: `v` des Items erhöhen. Jede Änderung der Definition: `definitionVersion` erhöhen
  (SemVer, festgeschrieben ab 1.0.0) und `npm run codebuch` ausführen. Ändert sich ein gepaartes Item, schlägt der
  Schnappschuss-Test an (`npm run codebuch -- --snapshot` nur nach bewusster Prüfung).
- Ein Bogen mit `status: 'entwurf'` ist nur mit dem Test-Code möglich.
- Studien-Codes: frei wählbare Pseudonyme (2–20 Zeichen A–Z, 0–9, Bindestrich), keine Klarnamen; Test-Code `P000`;
  die Zuordnung zu Personen liegt nur auf Papier.
