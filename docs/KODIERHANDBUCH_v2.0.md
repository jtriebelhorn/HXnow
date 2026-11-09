# Kodierhandbuch Fremdbeobachtung: HX Now im Klinikalltag

Version 2.0 vom 09.11.2026 – gilt für Kodierschema `schemaVersion` 2.0 und 2.1 und Exportformat 1.0 (Spalte `format_version`). Gegenüber 1.0 neu: T11 Diagnostik/Intervention; T5 umfasst nur noch das Gespräch mit Patientin/Patient oder Angehörigen. Änderungen nur noch nach Abschnitt 6.3 mit neuer Version.

> Kopie zur Referenz für die Entwicklung. Maßgeblich ist das Original der Studienleitung.

## 1. Zweck und Grundprinzip

Das Kodierhandbuch legt fest, wie die beobachtende Person die Arbeitszeit der Teilnehmenden kodiert, damit Prä- und Post-Phase vergleichbar sind. Es gilt für alle Beobachtungsblöcke der Studie (Studienprotokoll Abschnitt 6.1).

- Beobachtet wird jeweils eine Person für 15 Minuten beobachtete Zeit. Pausen der Beobachtung zählen nicht dazu.
- Die beobachtete Zeit wird lückenlos kodiert: Zu jedem beobachteten Zeitpunkt gilt genau ein Ort und genau eine Tätigkeits-/Gerätekategorie (Haupttätigkeit). Was gleichzeitig sichtbar geschieht, wird zusätzlich als Nebentätigkeit markiert (4.8).
- Kodiert wird nur, was von außen sichtbar ist. Bildschirminhalte, Gesprächsinhalte und Patientendaten werden nicht erfasst.
- Im Zweifel wird die vorsichtigere Kategorie gewählt und ein Kommentar vermerkt; Grenzfälle stehen in Abschnitt 5.

## 2. Ablauf eines Beobachtungsblocks

1. **Planung:** Beobachtungszeiten werden so verteilt, dass Tagesabschnitte (Früh-, Spät-, ggf. Nachtdienst), Wochentage und Bereiche in Prä- und Post-Phase vergleichbar sind. Die Beobachtungszeit wird möglichst gleichmäßig auf alle Teilnehmenden verteilt (Rotationsliste nach Studien-Code).
2. **Auswahl der Person:** nächste Person laut Rotationsliste, die im Dienst ist. Ist sie nicht auffindbar: Nachfrage beim Stationspersonal, nachrangig kurzer Anruf. Wie lange gesucht oder gewartet wird, entscheidet die beobachtende Person; danach wird die nächste Person der Liste gewählt und der Versuch dokumentiert („Person nicht angetroffen“).
3. **Start:** kurze Ankündigung („Ich beginne jetzt einen Block“), Arbeitskontext erfassen (4.5), dann Startzeit sekundengenau erfassen. Während des Blocks keine Ansprache.
4. **Kodierung:** fortlaufend nach Abschnitt 3 und 4, bei jedem Wechsel zuerst der Ort, dann die Tätigkeit. Ob ein HX-Now-Gerät dabei ist, wird nebenbei vermerkt (4.6).
5. **Pause:** Ist die Person vorübergehend nicht beobachtbar oder besteht eine Ausschlusssituation, wird der Block pausiert. Die Blockzeit steht still. Beim Fortsetzen wird der Grund erfasst (4.7). Ob bei einer langen Pause weiter gewartet, fortgesetzt oder abgebrochen (A3) wird, entscheidet die beobachtende Person; die App erinnert nach 5 Minuten, bricht aber nie selbst ab.
6. **Ende:** nach 15:00 Minuten beobachteter Zeit; Endzeit erfassen. Eine laufende Episode endet mit dem Block. In der Post-Phase wird abschließend bestätigt, ob ein HX-Now-Gerät dabei war (4.6).
7. **Abbruch:** Die beobachtete Person kann den Block jederzeit ohne Begründung beenden. Die beobachtende Person bricht ab, wenn eine längere Ausschlusssituation eintritt. Abgebrochene Blöcke werden mit Endzeit und Grund (Code A1–A4) gespeichert und gehen mit ihrer beobachteten Zeit in die Auswertung ein.

| Code | Abbruchgrund |
| --- | --- |
| A1 | Wunsch der beobachteten Person |
| A2 | Ausschlusssituation (siehe unten) |
| A3 | Person dauerhaft nicht mehr beobachtbar (Einschätzung der beobachtenden Person, z. B. verlässt den Bereich) |
| A4 | Sonstiges (Kommentar) |

**Ausschlusssituationen (keine Beobachtung, ggf. Abbruch):** Reanimation und Notfallversorgung, Schockraumversorgung, vertrauliche Gespräche (z. B. Überbringen schlechter Nachrichten, Personalgespräche), intime Untersuchungen, sowie wenn eine Patientin oder ein Patient der Anwesenheit nicht zustimmt. Kurze derartige Situationen innerhalb eines Blocks werden als Pause erfasst (Grund P2), statt den Block abzubrechen.

**Verhalten der beobachtenden Person:**

- Angemessener Abstand nach Einschätzung der beobachtenden Person, kein Blick auf Bildschirme oder Unterlagen.
- Kein Gespräch mit der beobachteten Person während des Blocks; Fragen von Dritten kurz und freundlich mit Hinweis auf die Studie beantworten.
- Patientenzimmer nur nach kurzer Erklärung und Einverständnis der Patientin oder des Patienten betreten; sonst vor der Tür warten und den Block pausieren (Grund P1).
- Die Versorgung hat immer Vorrang: Wege nicht versperren, bei Bedarf sofort zurücktreten.
- Schweigepflicht über alles, was während der Beobachtung wahrgenommen wird.

## 3. Kodierregeln

- **Kontinuierliche Zeitkodierung:** Jede Episode wird mit Startzeit (hh:mm:ss) erfasst; sie endet mit dem Beginn der nächsten Episode, einer Pause oder dem Blockende. Die Summe aller Episoden ergibt die beobachtete Blockzeit.
- **Episodenwechsel:** Eine neue Episode beginnt, sobald sich der Ort **oder** die Tätigkeits-/Gerätekategorie ändert oder eine Nebentätigkeit (4.8) beginnt bzw. endet. Bei Geräteepisoden (T1–T3) beginnt zusätzlich eine neue Episode, wenn die Nutzungsart wechselt, bei T3 auch bei Wechsel der Körperhaltung.
- **Reihenfolge der Eingabe:** Ändern sich Ort und Tätigkeit, zuerst den Ort, dann die Tätigkeit tippen. Jeder Tipp wird unverändert mit seinem Zeitpunkt gespeichert; dazwischen entsteht eine kurze Zwischenepisode (z. B. 1 s „PC im Patientenzimmer“). Sie wird nicht in der App korrigiert, sondern in der Auswertung über die Mindestdauer bereinigt. „Rückgängig“ nur für echte Vertipper; ist die letzte Episode älter als 10 s, fragt die App nach, weil ihre Zeit der Episode davor zugeschlagen wird.
- **Mindestdauer:** Tätigkeiten unter 3 Sekunden müssen nicht kodiert werden. Entstehen sie trotzdem (Zwischenepisoden, kurze Blicke), bleiben sie in den Rohdaten (`beobachtung.csv`) und werden in der Auswertung der vorangehenden Episode zugeschlagen (`beobachtung_bereinigt.csv`; ist keine vorangehende Episode da, der folgenden). Gleich kodierte Nachbarn werden danach zu einer Episode vereint. Ausnahme: jede erkennbare Nutzung von HX Now wird kodiert und bleibt erhalten, auch wenn sie kürzer ist (für die Zählung der Nutzungsepisoden).
- **Wege (Ort „Unterwegs“, O6):** Wer zwischen zwei Orten unterwegs ist, befindet sich am Ort O6. Haupttätigkeit ist, was dabei geschieht, nach der Prioritätsregel unten (z. B. Telefonat: T7 mit O6; HX Now lesen: T3 mit O6). T9 „Gehen“ wird nur kodiert, wenn ausschließlich gegangen wird. Ein Tipp auf „Gehen“ setzt den Ort automatisch auf „Unterwegs“. PC und Visitenwagen (T1, T2) sind unterwegs nicht möglich: Wird „Unterwegs“ während T1/T2 getippt, wechselt die App automatisch zu T9. Gehen innerhalb eines Raumes zählt zum Ort des Raumes. Das Ziel eines Weges ergibt sich aus dem nächsten Ort.
- **Unterbrechungen:** Wird eine Tätigkeit unterbrochen und danach fortgesetzt, entstehen zwei Episoden derselben Kategorie.
- **Prioritätsregel bei gleichzeitigen Tätigkeiten:** Haupttätigkeit ist die Kategorie, die in der folgenden Rangfolge zuerst kommt; die anderen sichtbaren Tätigkeiten werden als Nebentätigkeit markiert (4.8):
  1. Gerätenutzung (T1–T4), wenn die Person sichtbar mit dem Gerät interagiert (tippt, scrollt, spricht hinein, blickt auf den Bildschirm)
  2. Telefonat (T7)
  3. Diagnostik/Intervention (T11)
  4. Patientenkontakt – Gespräch (T5)
  5. Gespräch mit Kolleginnen, Kollegen oder Pflege (T6)
  6. Papierdokumente (T8)
  7. Gehen (T9)
  8. Sonstiges (T10)
- **Pause statt Kodierung:** Ist die Person nicht sichtbar oder besteht eine Ausschlusssituation, wird nicht kodiert, sondern pausiert (Abschnitt 2, Schritt 5). Die frühere Kategorie T11 „Nicht beobachtbar“ und der Ort O9 „Unbekannt“ entfallen.

## 4. Kategorien

### 4.1 Tätigkeit und Gerät (Primärkategorie)

| Code | Kategorie | Definition | Abgrenzung |
| --- | --- | --- | --- |
| T1 | Stationärer Arbeitsplatz-PC | Arbeit an einem fest installierten PC (KIS, PACS, E-Mail, Recherche), auch Warten am PC (Anmeldung, Laden, PC belegt) | Auch im Stehen am Stationsstützpunkt; nicht: Visitenwagen. Unterwegs nicht möglich. Nutzungsart 4.3 optional |
| T2 | Mobiler Visitenwagen / Laptop | Arbeit an einem fahrbaren Computer oder klinikeigenen Laptop | Auch wenn der Wagen gerade steht; Schieben des Wagens ist T9. Unterwegs nicht möglich. Nutzungsart 4.3 optional |
| T3 | HX Now | Sichtbare Interaktion mit einem gekennzeichneten HX-Now-Gerät | Nur Post-Phase möglich; Zusatzkodierung 4.3 und 4.4 |
| T4 | Sonstiges mobiles Gerät | Interaktion mit privatem Smartphone oder anderem Gerät ohne HX-Now-Kennzeichnung, außer Telefonieren | Zweck nicht kodieren (dienstlich/privat nicht erkennbar) |
| T5 | Patientenkontakt (Gespräch) | Gespräch mit Patientin/Patient oder Angehörigen ohne Untersuchung oder Prozedur (Anamnese, Aufklärung, Visitengespräch) | Mit Geräteinteraktion gilt T1–T4, Patientenkontakt dann NT5. Untersuchung oder Prozedur: T11 |
| T11 | Diagnostik/Intervention | Jede Untersuchung oder Prozedur an der Patientin/dem Patienten: körperliche Untersuchung (auch Auskultation), Blutentnahme, Zugang legen, Ultraschall, EKG, Punktion, Injektion, BGA, Verbandswechsel | Gespräch dabei als Nebentätigkeit NT5. Mit sichtbarer Geräteinteraktion (z. B. HX Now) gilt T1–T4; T11 ist nicht als Nebentätigkeit markierbar |
| T6 | Gespräch mit Kolleginnen, Kollegen, Pflege | Persönliches dienstliches Gespräch, Übergabe, Besprechung ohne Gerät | Mit Blick auf Bildschirm gilt T1–T4, Gespräch dann NT6 |
| T7 | Telefonat | Gespräch über Diensttelefon, Pieper-Rückruf oder Smartphone | Telefonat im Gehen: Ort O6, T7 |
| T8 | Papierdokumente | Lesen oder Schreiben in Papierakte, Kurve, Ausdrucken, Formularen |  |
| T9 | Gehen | Ausschließlich Gehen zwischen zwei Orten (Ort O6) | Telefonat, HX Now oder Gespräch im Gehen sind Haupttätigkeit (mit O6), nicht T9 |
| T10 | Sonstiges | Warten ohne Tätigkeit, Pause, persönliche Zeit, nicht zuordenbare Tätigkeit | Kommentar bei unklaren Fällen |

### 4.2 Ort

| Code | Ort | Definition |
| --- | --- | --- |
| O1 | Arztzimmer | Ärztlicher Arbeitsraum (in der Notaufnahme z. B. Arztarbeitsplatz) |
| O4 | Beim Patienten | Patientenzimmer, Behandlungsbox, Dialyseplatz, Untersuchungsraum – überall direkt bei der Patientin bzw. dem Patienten |
| O2 | Bei der Pflege | Pflegestützpunkt bzw. Arbeitsplatz der Pflege |
| O4 | Flur (Aufenthalt) | Aufenthalt auf dem Flur, ohne unterwegs zu sein (z. B. Gespräch im Stehen). Wer über den Flur geht, ist unterwegs (O6) |
| O5 | Pausenraum | Pausen- und Aufenthaltsraum, auch für eine Pause |
| O6 | Unterwegs | Auf dem Weg zwischen zwei Orten (Gehen); Haltung bei HX Now automatisch „gehend“ |
| O7 | Außerhalb des eigenen Bereichs | Andere Station, Funktionsdiagnostik, Konsil |
| O8 | Sonstiges | Aufzug, Treppenhaus, Außengelände, nicht zuordenbar |

Der Ort beschreibt, **wo innerhalb des Bereichs** sich die Person aufhält, nicht den Bereich selbst (Station, Notaufnahme, Dialyse oder Ambulanz ergeben sich aus Bereich und Arbeitskontext beim Blockstart).

### 4.3 Nutzungsart (Pflicht bei T3, optional bei T1 und T2)

| Code | Nutzungsart | Erkennbar an | Gilt für |
| --- | --- | --- | --- |
| N1 | Einsicht | Scrollen, Wischen, Lesen ohne Texteingabe | T1–T3 |
| N2 | Texteingabe | Tippen auf Tastatur oder Bildschirmtastatur | T1–T3 |
| N3 | Sprachdokumentation | Person spricht in das Gerät, ohne zu telefonieren | T1–T3, sofern erkennbar |
| N4 | Foto / Scan | Gerät wird auf Patientin/Patient oder Dokument gerichtet | nur T3 |
| N5 | Warten | Person wartet auf das Gerät: Anmeldung, Hochfahren, Ladezeit, PC belegt | T1–T3 |
| N9 | Sonstige | Nutzung sichtbar, Art nicht erkennbar oder nicht kodiert. Bei T3 automatisch, solange nichts gewählt ist | T1–T3 |

Ob die Nutzungsart bei T1 und T2 zuverlässig und ohne Verzögerung kodiert werden kann, wird in den Pilotbeobachtungen geprüft. Wenn nicht, gilt 4.3 nur für T3.

### 4.4 Körperhaltung (nur bei T3)

| Code | Haltung | Definition |
| --- | --- | --- |
| H1 | Gehend | Person bewegt sich während der Nutzung fort; am Ort O6 automatisch gesetzt |
| H2 | Stehend | Steht, ohne in einer Wartesituation zu sein |
| H3 | Sitzend | Sitzt |
| H4 | Wartend | Wartesituation unabhängig von der Haltung (z. B. Aufzug, vor einer Untersuchung, auf Rückruf); hat Vorrang vor H2 und H3 |
| H9 | Sonstige | Haltung nicht erkennbar oder nicht kodiert; automatisch, solange nichts gewählt ist |

### 4.5 Arbeitskontext (einmal beim Blockstart)

Erfasst wird der überwiegende Kontext des Blocks. Die Kategorien entsprechen den Arbeitsbereichen im Fragebogen (A6).

| Code | Kontext |
| --- | --- |
| K1 | Station – Visite |
| K2 | Station – Übergabe |
| K3 | Station – Stationsarbeit |
| K4 | Funktionsbereich (z. B. Dialyse) |
| K5 | Ambulanz |
| K6 | Notaufnahme – Behandlungsbereich |
| K7 | Notaufnahme – Notaufnahmestation |

### 4.6 HX-Now-Gerät dabei (nur Post-Phase)

Ob die beobachtete Person ein HX-Now-Gerät bei sich hat, wird ohne Ansprache vermerkt: Das Häkchen kann jederzeit während des Blocks gesetzt werden und wird bei der ersten T3-Episode automatisch gesetzt. Am Blockende bestätigt die beobachtende Person: ja · nein · nicht erkennbar.

### 4.7 Pausengründe

| Code | Grund |
| --- | --- |
| P1 | Patientin oder Patient lehnt Anwesenheit ab |
| P2 | Ausschlusssituation (Notfall, vertrauliches Gespräch, intime Untersuchung) |
| P3 | Person nicht sichtbar oder Bereich ohne Zutritt |
| P4 | Beobachtende Person wird angesprochen oder gestört |
| P5 | Sonstiges (Freitext) |

### 4.8 Nebentätigkeiten (NT)

Läuft neben der Haupttätigkeit sichtbar eine weitere Tätigkeit, wird sie als Nebentätigkeit markiert. Nebentätigkeiten haben eigene Codes, deren Nummer der jeweiligen Tätigkeit entspricht:

| Code | Nebentätigkeit | Entspricht |
| --- | --- | --- |
| NT3 | HX Now (nur Post) | T3 |
| NT4 | Sonstiges Mobilgerät | T4 |
| NT5 | Patientenkontakt | T5 |
| NT6 | Gespräch mit Kolleginnen, Kollegen, Pflege | T6 |
| NT7 | Telefonat | T7 |

- Mehrere Nebentätigkeiten können gleichzeitig laufen. Der Schalter bleibt an, auch wenn Ort oder Haupttätigkeit wechseln, und wird abgewählt, sobald die Nebentätigkeit endet.
- Wechselt die Nebentätigkeit (z. B. von Gespräch zu Telefonat), die alte abwählen und die neue einschalten. Jeder Wechsel ist eine eigene Episode und steht im Ablauf auf der Abschlussseite und im Export.
- Wird die Nebentätigkeit zur Haupttätigkeit, entfällt der Schalter automatisch.
- Unterwegs (O6) ist die inhaltliche Tätigkeit Haupttätigkeit; weitere gleichzeitige Tätigkeiten werden als Nebentätigkeit markiert (z. B. Telefonat mit Blick auf HX Now: T3 mit NT7).
- NT3 setzt „Gerät dabei“ (4.6) ebenso wie T3. Zusätzlich können Nutzungsart (4.3) und Haltung (4.4) erfasst werden. Was nicht angegeben wird, gilt automatisch als Sonstige (N9, H9); am Ende des Blocks wird nichts nachgefragt. Das gilt auch für T3.
- In der App sind die Nebentätigkeiten zugeklappt und werden bei Bedarf geöffnet; eingeschaltete bleiben in der Kopfzeile sichtbar.

Da Haupt- und Nebentätigkeiten vollständig gespeichert werden, kann die Auswertung die Prioritätsregel nachprüfen und z. B. „Dokumentation mit beteiligter Patientin“ (T1–T3 mit NT5) getrennt ausweisen.

## 5. Grenzfälle

| Situation | Kodierung | Begründung |
| --- | --- | --- |
| Visite am Bett mit Blick auf den Visitenwagen | T2, O2, N1 | Geräteinteraktion hat Vorrang vor Patientenkontakt |
| Visite am Bett, Visitenwagen steht daneben, Gespräch mit Patientin | T5, O2 | Keine sichtbare Geräteinteraktion |
| Körperliche Untersuchung (Abhören, Abtasten) mit Gespräch | T11, O2, Nebentätigkeit NT5 | Untersuchung vor Gespräch (Rangfolge) |
| Blutentnahme oder Zugang legen | T11, O2 | Prozedur |
| Ultraschall am Bett, Befund wird der Patientin erklärt | T11, O2, Nebentätigkeit NT5 | Diagnostik vor Gespräch |
| Während des Verbandswechsels Foto mit HX Now | T3, N4, O2 | Geräteinteraktion vor Diagnostik/Intervention; T11 ist keine Nebentätigkeit |
| Gehen auf dem Flur und dabei HX Now lesen | O6, T3, N1, H1 | Unterwegs; Haupttätigkeit ist die Gerätenutzung |
| Auf dem Weg telefonieren | O6, T7 | Unterwegs; Haupttätigkeit ist das Telefonat (T9 nur bei reinem Gehen) |
| Vom PC aufstehen und zum Patientenzimmer gehen | O6 → T9 automatisch, dann O2 und Tätigkeit | PC ist unterwegs nicht möglich |
| Gespräch im Stehen auf dem Flur | O4, T6 | Aufenthalt, nicht unterwegs |
| Am PC sitzend telefonieren, Blick auf Bildschirm | O1, T1, N1, Nebentätigkeit NT7 | Sichtbare Interaktion mit dem PC |
| Am PC sitzend telefonieren, abgewandt | T7, O1 | Keine Bildschirminteraktion |
| Übergabe am Pflegestützpunkt, beide schauen auf den PC | O3, T1, N1, Nebentätigkeit NT6 | Gemeinsamer Blick auf den Bildschirm gilt als Interaktion |
| Am PC, KIS lädt bzw. Anmeldung läuft | O1, T1, N5 | Warten am Gerät |
| Wartet, bis ein PC frei wird | O1, T1, N5 | Warten auf das Gerät |
| Dokumentation in HX Now am Bett, Gespräch mit der Patientin läuft weiter | O2, T3, N2, Nebentätigkeit NT5 | Gerät vor Patientenkontakt; Kontakt bleibt sichtbar |
| Gespräch mit der Patientin, HX Now nur kurz zum Fotografieren der Wunde | O2, T5, Nebentätigkeit NT3 mit N4 | Nur wenn das Gespräch die Haupttätigkeit bleibt; sonst T3 mit N4 |
| Warten auf den Aufzug mit HX Now | O8, T3, H4 | Wartesituation |
| Kaffeepause im Pausenraum | O5, T10 | Pause der beobachteten Person, keine Beobachtungspause |
| Diktat in HX Now am Patientenbett | O2, T3, N3 | Sprachdokumentation, nicht Telefonat |
| Privates Smartphone kurz angesehen (unter 3 s) | laufende Episode | Mindestdauer nicht erreicht (gilt nicht für HX Now) |
| Person betritt Patientenzimmer, Patient lehnt Beobachtung ab | Pause, P1 | Fortsetzen, sobald die Person wieder beobachtbar ist |
| Person geht in einen Bereich ohne Zutritt (z. B. OP, Sterilbereich) | Pause, P3 | Abbruch A3 nach Einschätzung der beobachtenden Person |
| Tippen auf HX Now und gleichzeitig Gespräch mit Pflege | T3, N2, Nebentätigkeit NT6 | Geräteinteraktion hat Vorrang |
| HX-Now-Gerät in der Kitteltasche sichtbar, aber nicht genutzt | keine Episode; Häkchen 4.6 setzen | Gerät dabei, keine Nutzung |

## 6. Erfassung und Qualitätssicherung

### 6.1 Blockprotokoll

Je Block werden erfasst: Block-ID, Studien-Code, Datum, Bereich, Arbeitskontext (K1–K7), Dienst (Früh, Spät, Nacht), Start- und Endzeit, Pausen (Beginn, Ende, Grund P1–P5), Abbruch (ja/nein, Code A1–A4), bei vorzeitigem Beenden der Grund (Freitext), in der Post-Phase HX-Now-Gerät dabei (ja/nein/nicht erkennbar) und Kommentar. Je Episode: Startzeit, Ort (O1–O8), Tätigkeit/Gerät (T1–T11), bei T1–T3 Nutzungsart (N), bei T3 zusätzlich Haltung (H), Nebentätigkeiten (4.8), optional Kommentar. Die Erfassung erfolgt mit einer Beobachtungs-App auf einem Smartphone oder Tablet: Jede Kategorie wird per Tastendruck gewählt, die App vergibt den Zeitstempel sekundengenau. Die Eingabemaske bildet die hier genannten Felder ab; es werden keine weiteren Daten erfasst. Aufbau und Bedeutung aller Spalten der Exportdateien: [CODEBUCH_EXPORT.md](CODEBUCH_EXPORT.md).

### 6.2 Tageskennzahlen

Je Beobachtungstag, Bereich und Teilbereich (Nephrologie: Normalstation, Dialyse, Ambulanz, Konsile; Notaufnahme:
Notaufnahme, Notaufnahmestation) werden zur Einordnung der Arbeitslast erfasst:

- Belegung: belegte Betten (nur stationäre Teilbereiche: Normalstation, Notaufnahmestation)
- Tagesumsatz: Zahl der Patientinnen und Patienten, die aufgenommen, entlassen oder ambulant betreut wurden (Aufnahmen,
  Entlassungen, ambulant – z. B. Ambulanz, Dialyse, Konsile, Notaufnahme); die Summe bildet die App (`umsatz`)
- Zahl der anwesenden Ärztinnen und Ärzte im Dienst
- Besondere Ereignisse (z. B. Personalausfall, Systemstörung, Massenanfall)

### 6.3 Qualitätssicherung

- **Schulung:** Einweisung der beobachtenden Person in Studienprotokoll, Kodierhandbuch und Verhaltensregeln durch die Studienleitung. Übungs- und Testblöcke immer mit dem Studien-Code P000 erfassen; sie werden als Probelauf gekennzeichnet (Dateien `HXNOW_TEST_…`) und nicht ausgewertet.
- **Pilotbeobachtungen und Übereinstimmung:** liegen bei der Studienleitung und sind nicht Teil dieses Handbuchs; Pilotblöcke mit P000 erfassen.
- **Eigene Entscheidung:** Ob ein Block behalten, verworfen oder ein nicht exportierter Eintrag gelöscht wird, entscheidet die beobachtende Person (Grund im Kommentar bzw. beim Beenden). Gelöschte Studiensitzungen bleiben im Logbuch als „gelöscht“ vermerkt.
- **Datenprüfung:** tägliche Kontrolle auf Lücken, Überlappungen und beobachtete Blockzeiten (ohne Pausen) ungleich der gewählten Blockdauer ohne Abbruchcode bzw. ohne Grund für ein vorzeitiges Ende; Ortswechsel zwischen Räumen ohne „Unterwegs“ dazwischen werden gezählt (Hinweis für die Schulung).
- **Änderungen:** Nach der Festschreibung werden keine Kategorien mehr geändert. Unvermeidbare Klarstellungen werden mit Datum und Begründung im Änderungsprotokoll dokumentiert und gelten für Prä- und Post-Phase gleichermaßen. Jede Änderung am Kodierschema erhöht `schemaVersion` (neue Codes 1.1, geänderte Bedeutung 2.0); die App verweigert die Auslieferung sonst (Test gegen `tests/fixtures/versionen.json`).

| Version | Datum | Änderung |
| --- | --- | --- |
| 0.1 | 10.10.2026 | Entwurf |
| 0.2 | 02.11.2026 | Pause mit Grund (P1–P5) ersetzt T11 und O9, Pausen zählen nicht zur Blockzeit; Arbeitskontext K1–K7; Nutzungsart auch für T1/T2 (Pilot); HX-Now-Gerät dabei (Post); Smartphone als Erfassungsgerät |
| 0.3 | 04.11.2026 | Nach den ersten Pilotblöcken: erst Ort, dann Tätigkeit; Orte neu: wo im Bereich (O1 Arztzimmer, O2 beim Patienten, O3 bei der Pflege, O4 Flur, O5 Pausenraum, O6 unterwegs, O7 außerhalb, O8 Sonstiges) statt Bereiche wie Notaufnahme/Dialyse/Ambulanz; T9 wird „Gehen“; Nebentätigkeiten NT3–NT7 (4.8); Nutzungsart N5 „Warten“; nicht Angegebenes gilt als Sonstige (N9, H9), keine Nachfrage am Blockende; Mindestdauer nur in der Auswertung (kein Korrekturfenster in der App). |
| 1.0 | 09.11.2026 | Festschreibung: keine offenen Werte mehr; Zeitgrenzen und Abstand nach Ermessen der beobachtenden Person; Mindestdauer 3 s (Bereinigung nur in der Auswertung, HX Now ausgenommen); unterwegs ist die inhaltliche Tätigkeit Haupttätigkeit (T9 nur bei reinem Gehen); Nutzungsart bei T1/T2 optional; Tageskennzahlen je Teilbereich mit Belegung (stationär) und Tagesumsatz; Pilot und Zweitkodierung außerhalb des Handbuchs. |
| 2.0 | 09.11.2026 | Neue Tätigkeit T11 „Diagnostik/Intervention“ (körperliche Untersuchung, Blutentnahme, Ultraschall, EKG, Punktion u. a.); T5 nur noch Gespräch mit Patientin/Patient oder Angehörigen (geänderte Bedeutung → Hauptversion); Rangfolge: T11 nach Telefonat, vor T5; T11 nur als Haupttätigkeit. Der Code T11 hatte in den Entwürfen 0.1/0.2 eine andere Bedeutung („nicht beobachtbar“); solche Daten stammen aus der Zeit vor der Festschreibung. |
| 2.1 (Schema) | 09.11.2026 | Nur Anzeige: Taste T11 heißt „Diagnostik/ Intervention“ statt „Diagnostik“. Bedeutung unverändert. |
