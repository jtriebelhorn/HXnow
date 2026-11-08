# HX Now Beobachtung

Progressive Web App für die Time-Motion-Studie „HX Now im Klinikalltag“. Reines HTML/CSS/JavaScript,
kein Backend, keine externen Abhängigkeiten zur Laufzeit. Verbindliche Spezifikation:
[docs/ENTWICKLUNGSPLAN.md](docs/ENTWICKLUNGSPLAN.md).

Stand: Phasen 0–5 nach Spezifikation v2 / Kodierhandbuch v0.3 (Entwurf) (Grundgerüst, Fachlogik mit Pausen, Speicherung, Oberfläche, Export, Offline/PWA). Es folgen Zusammenführungstool (6), Dokumentation (7). Abgestimmte Abweichungen: [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md). Hosting, Versionierung und Update-Ablauf werden in Phase 7 beschrieben.

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
| `npm run pruefen` | Prüf-Workflow: realitätsnahe Simulation zweier Beobachtungstage, Abgleich aller gespeicherten Daten, Bericht in `pruefberichte/` ([Anleitung](docs/PRUEF_WORKFLOW.md)) |

Die ausgelieferten Dateien im Repository brauchen keinen Build-Schritt.

## Offline-Betrieb

Nach dem ersten Aufruf über HTTPS liegt die App vollständig im Cache des Service Workers und startet ohne Netz.
Beobachtungsdaten liegen ohnehin nur auf dem Gerät. Bei jeder Auslieferung `APP_VERSION` (`js/version.js`) und
`CACHE_VERSION` (`sw.js`) gemeinsam erhöhen; neue Dateien in die Liste `DATEIEN` in `sw.js` aufnehmen
(`npm test` prüft beides). Geräte erhalten die neue Version, sobald sie online sind, und bieten sie auf der
Startseite zum Aktualisieren an.

## Veröffentlichen (Studienbetrieb)

1. Veröffentlichen darf nur die Studienleitung (Schreibrecht auf `main`); GitHub Pages liefert `main` unter der festen
   Adresse https://jtriebelhorn.github.io/HXnow/ aus. Adresse, Repository-Name und Account nie ändern (iOS bindet den
   Speicher an die Adresse).
2. Jede Version: `js/version.js`, `CACHE_VERSION` in `sw.js` und `version.json` (Version, Datum, Hinweistext) gleich
   erhöhen (Unit-Test prüft das) und einen Eintrag in `CHANGELOG.md` schreiben: was sich ändert, ob eine
   Datenbank-Migration nötig ist, ob Fragebogen oder Kodierschema betroffen sind.
3. Updates möglichst zwischen den Studienphasen, nicht während eines Beobachtungstags.
4. Datenbank-Migrationen nur ergänzend (neue Stores, Indizes, Felder mit Standardwert), nie löschen oder Schlüssel ändern;
   jede Migration mit Test (`tests/e2e/l0.spec.js`).
5. Testversionen nur mit `TESTVERSION = true` in `js/config.js` (eigene Datenbank, gelbes Band).
