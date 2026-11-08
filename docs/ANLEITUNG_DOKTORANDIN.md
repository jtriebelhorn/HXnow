# Anleitung für die Doktorandin

Gilt ab App-Version 0.14.0. Die App läuft auf dem Studien-iPhone als Symbol auf dem Home-Bildschirm
(„Beobachtung“). Alle Daten liegen nur auf dem iPhone, bis Sie sie in den Exportordner teilen.

> **Wichtigste Regel:** Nach jeder Sitzung (Block, Fragebogen, „nicht angetroffen“) sofort **Exportieren** und die
> Dateien im Exportordner speichern. Erst dann sind sie gesichert.

## 1. Vor dem ersten Studientag

1. App über Safari öffnen (https://jtriebelhorn.github.io/HXnow/), **Teilen → Zum Home-Bildschirm**. Ab dann nur noch
   über das Symbol starten. Im Safari-Tab sperrt die App das Erfassen (rote Seite).
2. Beim ersten Start fragt die App: „Keine Studiendaten gefunden. Letzte Sicherung laden?“ Auf einem neuen Gerät
   **Neu beginnen** tippen (zweimal bestätigen).
3. **Studie → Studienplan:**
   - Phasenplan je Bereich eintragen (Beginn Baseline, Einführung, Regelbetrieb, Abschluss, Ende).
   - Exportordner beschreiben, z. B. den Pfad auf dem Klinik-Laufwerk. Der Text erscheint auf der Startseite.
4. Bei der ersten geschützten Änderung legt die App eine **PIN** fest (4–8 Ziffern). Nur Sie und die Studienleitung
   kennen sie.
5. Für Übungen immer den Test-Code **P000** verwenden. Diese Dateien heißen `HXNOW_TEST_…` und werden nicht ausgewertet.

## 2. Probanden

- Jeder Proband bekommt einen **frei wählbaren Code** (2–20 Zeichen: Buchstaben, Ziffern, Bindestrich), z. B.
  `NEPH-A` oder `OA3`. **Keine Klarnamen** und nichts, was auf die Person schließen lässt: Der Code steht in jeder
  Exportdatei. Die Zuordnung Code ↔ Person bleibt auf Papier bei der Studienleitung.
- Feld **Proband** antippen: Die Liste aller angelegten Probanden klappt auf. Beim Tippen wird sie gefiltert;
  Antippen eines Codes wählt ihn.
- Gibt es den Code noch nicht, erscheint **Neuen Probanden anlegen: …**. Antippen legt ihn mit Datum in der
  Teilnehmerliste an (steht damit auch im Logbuch).
- **Studie → Teilnehmerliste:** Liste exportieren (CSV) oder eine Liste laden. Beim Laden werden nur fehlende Codes
  ergänzt.
- Pausierte, ausgeschiedene und widerrufene Codes lassen sich nicht mehr erfassen.

## 3. Fragebogen

1. Startseite → **Fragebogen**.
2. Bogen wählen: „Fragebogen 1 – Baseline“, „Kurzbogen Gewöhnung“ (Einführung) oder „Fragebogen 2 – Ende Regelbetrieb“.
3. Studien-Code und Bereich wählen. Danach entweder:
   - **Ausfüllen durch die teilnehmende Person:** Gerät übergeben. Die Person tippt **Start**, beantwortet die
     Seiten und gibt das Gerät zurück. Zurück in Ihre Ansicht kommen Sie auf der Dankeseite mit **Zurück zur
     Studienansicht** (2 Sekunden gedrückt halten).
   - **Papierbogen nacherfassen:** das Datum auf dem Papier eintragen; Sie geben die Antworten selbst ein.
4. Die Statusansicht zeigt keine Antworten, nur Eckdaten. **Exportieren** tippen.
5. Wird der Bogen unterbrochen (Anruf, Akku …): Auf der Startseite steht er unter „Nicht abgeschlossene Fragebögen“
   → **Fortsetzen**. Solange ein Bogen offen ist, startet kein Beobachtungsblock und kein Update.
6. Fragebogen 2 ist noch ein Entwurf und nur mit P000 möglich, bis der Pretest abgeschlossen ist.

## 3a. Tageskennzahlen

Startseite → **Tageskennzahlen**: Datum, Bereich und **Teilbereich** wählen – Nephrologie: Normalstation, Dialyse,
Ambulanz oder Konsile; Notaufnahme: Notaufnahme oder Notaufnahmestation. Für jeden Teilbereich gibt es je Tag einen
eigenen Eintrag (Belegung bzw. Zugänge, anwesende Ärztinnen und Ärzte, besondere Ereignisse). Danach exportieren wie
jede Sitzung.

## 4. Exportieren und sichern

- **Exportieren** öffnet das Teilen-Menü mit **zwei Dateien**: der Sitzungsdatei und dem Logbuch
  (`HXNOW_Logbuch_<Gerät>.csv`). Beide in den Exportordner speichern. Das Logbuch hat immer denselben Namen, bei der
  Frage „Ersetzen?“ also **Ersetzen** wählen.
- Kann das iPhone nur eine Datei teilen, meldet die App das. Dann zusätzlich **Logbuch sichern** tippen.
- Wenn das Teilen nicht klappt: **Andere Wege**.
  - **Herunterladen:** lädt beide Dateien.
  - **Mail** oder **Zwischenablage:** überträgt nur die Sitzungsdatei; das Logbuch danach mit **Logbuch sichern**.
- Die Startseite zeigt **Letzte Sicherung: …**. Ein gelber Hinweis heißt, dass Sitzungen noch nicht gesichert sind.
  Nach 24 Stunden wird er rot.
- Ist eine Datei sicher auf dem Klinik-System, **Eingang bestätigt** tippen. Bestätigte Einträge können unter
  **Sicherung → Bestätigte Einträge löschen** vom iPhone entfernt werden. Das Logbuch bleibt dabei erhalten.
- **Komplettsicherung** (Sicherung → Komplettsicherung erstellen): vor jedem Update, am Ende jeder Phase und vor
  einem Gerätewechsel.

## 5. Studie: Überblick und Fällig-Liste

Menü **Studie** zeigt auf einen Blick:
- Oben Summen: Probanden, Blöcke, beobachtete Stunden, Fragebögen, nicht angetroffen; darunter der Studientag je
  Bereich.
- Eine Zeile je Proband: „3/5 ✓“ = 3 von 5 Blöcken, Fragebogen der Phase ausgefüllt („–“ = noch offen). Die Farbe am
  Zeilenanfang ist die Ampel: grün = im Plan, gelb = knapp, rot = Ziel nicht mehr erreichbar oder Phase vorbei. Eine
  rote Zahl rechts = Sitzungen noch nicht exportiert.
- Antippen eines Probanden öffnet die Detailansicht mit allen Beobachtungen (Datum, Uhrzeit, Dauer, Pausen),
  Fragebögen und Phasen.
- Zum Aufklappen: **Fällig** (offene Fragebögen, fehlende Blöcke, nicht Gesichertes) und **Verteilung** der Blöcke
  über alle Probanden (Arbeitskontext, Dienst, Tageszeit).

Das Logbuch zeigt bewusst keine Tätigkeiten und keine Antworten einzelner Personen.

Beim **Neuen Block** schlägt die App die Phase aus dem Phasenplan vor. Bitte trotzdem prüfen.

## 6. Korrekturen

Erfasste Daten werden nie überschrieben. Korrekturen werden als Änderung gespeichert und erscheinen im Verlauf.
Weg: **Studie → Proband antippen → Eintrag antippen**.

| Was | Wo | PIN |
| --- | --- | --- |
| Kommentar, Kommentar zurückziehen | Eintrag oder Proband | nein |
| Als ungültig markieren (Grund U1 Testeintrag, U2 falscher Proband, U3 Fehlbedienung, U4 doppelt, U9 Sonstiges mit Text) bzw. aufheben | Eintrag | ja |
| Anderer Proband (Code verwechselt) | Eintrag | ja |
| Phase ändern | Eintrag (Block, nicht angetroffen) | ja |
| Status (aktiv, pausiert, ausgeschieden) | Proband | ja |
| Eigene Phasendaten (z. B. später eingestiegen) | Proband | ja |
| Phasenplan des Bereichs | Studienplan | ja |

Eine richtig eingegebene PIN gilt 10 Minuten. Nach 5 falschen Eingaben ist die PIN 5 Minuten gesperrt.
Nach jeder Änderung fragt die App: **Logbuch jetzt sichern?** Ja, damit die Korrektur auch im Exportordner steht.

## 7. Widerruf

Widerruft eine Person ihre Teilnahme:
1. **Studie → Proband → Widerruf**, PIN, Code zur Bestätigung eintippen.
2. Die App löscht alle Daten dieses Codes vom iPhone und zeigt die Liste der Dateien, die im Exportordner zu löschen
   sind.
3. **Protokoll und Logbuch teilen** und beide im Exportordner speichern. Dann die aufgelisteten Dateien dort löschen
   und die Studienleitung informieren.

Bis das Logbuch gesichert ist, zeigt die Startseite einen roten Hinweis.

## 8. Updates

- Neue Versionen werden angezeigt, sobald das iPhone online ist (oder über **Nach Updates suchen**).
- Installieren nur, wenn kein Block läuft und kein Fragebogen offen ist. Die App bietet vorher eine Komplettsicherung
  an; bitte annehmen.
- Danach steht kurz „Aktualisiert auf …“ auf der Startseite. Die Daten bleiben erhalten.

## 9. Gerät wechseln oder Daten weg

Siehe [NOTFALLKARTE.md](NOTFALLKARTE.md).
