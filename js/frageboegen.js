// Fragebogen-Definition (PLAN_Fragebogen-Modus_HX_Now.md, Abschnitt 3). Fest eingebaut: Eine inhaltliche
// Änderung braucht eine neue App-Version. Regeln für Änderungen (stabile IDs, Versionierung, Paar-IDs): Plan
// Abschnitt 4 und README.
//
// Quelle: Spezifikationen FB1_Baseline_v0.3.md, FB2_Post_v0.3.md, KB_Gewoehnung_v0.3.md vom 08.11.2026
// (docs/quellen/). tests/unit/definition.test.js vergleicht jedes Item mit der Spezifikation und den Wortlaut von
// FB1 und FB2 zusätzlich mit den Papierfassungen.
//
// Item-Felder: id, v (Item-Version), typ, text („___“ = Eingabefeld im Satz), optionen [[code, beschriftung]],
// freitextBei (→ Zelle <ID>_TXT), min, max, einheit, zeilen [[suffix, beschriftung]], gruppen (Matrix-Spalten,
// `paarJeZelle`), zeilenShowIf, zeilenAuto, optionShowIf, showIf, auto ({ wenn, wert }: Wert statt −88, wenn das Item
// ausgeblendet ist und die Bedingung gilt), zusatz (Skala: Antwort außerhalb min–max), validierung, skala (Score),
// umpolen, paar, paarZeilen (Paar-ID je Matrixzeile), paarUmkodierung (Codes für den Vergleich mit FB1), hinweis, entfernt.
//
// Bedingungen: `ID = Wert`, `!=`, `>`, `<`, `>=`, `<=`, `ID IN (a, b)`, `UND`, `ODER`, Klammern,
// `IRGENDEIN(Muster) > 0`, `ALLE(Muster) = 0`, `UNBEKANNT(ID)` (unbeantwortet oder ausgeblendet). Auswertung: js/fb/filter.js.
// Fehlwerte: leer = nicht beantwortet, −88 = ausgeblendet, −99 = keine Angabe, 9 = nicht genutzt (wo als Option vorgesehen).

/** Skalen-Items gleicher Bauart, z. B. ATI C1–C9. */
function skalaItems(praefix, texte, gemeinsam, extra = () => ({})) {
  return texte.map((text, i) => ({ id: `${praefix}${i + 1}`, v: 1, typ: 'skala', text, ...gemeinsam, ...extra(i + 1) }));
}

const ATI_ANKER = {
  1: 'stimmt gar nicht', 2: 'stimmt weitgehend nicht', 3: 'stimmt eher nicht',
  4: 'stimmt eher', 5: 'stimmt weitgehend', 6: 'stimmt völlig',
};
const TAM_ANKER = { 1: 'stimme gar nicht zu', 4: 'teils/teils', 7: 'stimme voll zu' };
const NUTZEN_ANKER = { 1: 'gar nicht nützlich', 5: 'sehr nützlich' };
const ZUSTIMMUNG_5_ANKER = {
  1: 'stimme gar nicht zu', 2: 'stimme eher nicht zu', 3: 'teils/teils', 4: 'stimme eher zu', 5: 'stimme voll zu',
};
const SUS_ANKER = { 1: 'stimme gar nicht zu', 2: 'stimme nicht zu', 3: 'unentschieden', 4: 'stimme eher zu', 5: 'stimme voll zu' };
const VERAENDERUNG_ANKER = { 1: 'deutlich weniger', 2: 'etwas weniger', 3: 'unverändert', 4: 'etwas mehr', 5: 'deutlich mehr' };
const NICHT_GENUTZT = 9;
const KEINE_NAMEN = 'Keine Namen eintragen';

const W3_ZEILEN = [
  ['01', 'Auf Wegstrecken (Flur, zwischen Stationen)'],
  ['02', 'In Wartesituationen (z. B. Aufzug, vor Untersuchung)'],
  ['03', 'Am Patientenbett / im Patientenzimmer'],
  ['04', 'Während der Visite'],
  ['05', 'Bei der Übergabe'],
  ['06', 'Im Behandlungsbereich der Notaufnahme'],
  ['07', 'Außerhalb des eigenen Bereichs (z. B. Konsil, andere Station)'],
  ['08', 'In Pausen'],
  ['09', 'Im Bereitschafts- bzw. Nachtdienst'],
  ['10', 'Vor Dienstbeginn oder nach Dienstende'],
];
const FUNKTIONEN = [
  ['1', 'Krankenakte / Verlauf einsehen'],
  ['2', 'Laborwerte einsehen'],
  ['3', 'Bildgebung (PACS-Viewer)'],
  ['4', 'PMDs bearbeiten (z. B. Basisanamnese, Konsil)'],
  ['5', 'Fotodokumentation'],
  ['6', 'Dokumentenscan'],
  ['7', 'Sprachgestützte Dokumentation'],
];
const HAEUFIGKEIT_14_TAGE = [[0, '0'], [1, '1–3'], [2, '4–10'], [3, '11–20'], [4, '> 20']];
const FUNKTION_HAEUFIGKEIT = [[0, 'nie'], [1, '1–3×'], [2, '4–10×'], [3, '11–20×'], [4, '> 20×']];
const GELOEST = [[1, 'sofort vor Ort'], [2, 'Weg zum PC'], [3, 'Anruf / Rückfrage'], [4, 'Aufschub'], [5, 'Verzicht']];
const GELOEST_MIT_HX = [[1, 'mit HX Now'], [2, 'anders vor Ort (z. B. Visitenwagen)'], [3, 'Weg zum PC'], [4, 'Anruf / Rückfrage'], [5, 'aufgeschoben'], [6, 'verzichtet']];
// FB2 W6c und KB G3 → Codes von FB1 W4c (1 und 2 → 1 „sofort vor Ort“, 3 → 2, 4 → 3, 5 → 4, 6 → 5)
const GELOEST_MIT_HX_ALS_FB1 = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };
const GERAET_DABEI = [[1, 'nie'], [2, 'selten'], [3, 'meistens'], [4, 'immer']];
const DAUER = [[1, 'sofort'], [2, '< 5 Minuten'], [3, '5–30 Minuten'], [4, '> 30 Minuten'], [5, 'gar nicht']];
const INFO_ART = [[1, 'Laborwerte'], [2, 'Befunde/Bildgebung'], [3, 'Vorbefunde/Arztbriefe'], [4, 'Medikation'], [5, 'Verlauf/Kurve'], [9, 'Sonstiges']];
const ORTE = [[1, 'Flur/Wegstrecke'], [2, 'Patientenzimmer'], [3, 'Visite'], [4, 'Übergabe'], [5, 'Behandlungsbereich Notaufnahme'], [6, 'anderer Bereich'], [7, 'Bereitschafts-/Nachtdienst']];

const MIT_DIENST = 'W1 > 0';
// Nur in der App (nicht im Papierbogen): Wer die Tabelle überspringt, verliert die Folgefragen W4/W6 (Filter MIT_BEDARF).
const W3_HINWEIS = 'Bitte für jede Situation eine Häufigkeit angeben – auch „0“, wenn es nicht vorkam. Die folgenden Fragen hängen davon ab.';
const MIT_BEDARF = 'W1 > 0 UND IRGENDEIN(W3_*_A) > 0';

// ===================================================================== FB1
const FB1 = {
  id: 'FB1',
  titel: 'Fragebogen 1 – Ausgangslage vor Einführung von HX Now',
  phase: 'PRE',
  quelle: 'FB1_Baseline_v0.3.md vom 08.11.2026 (Papier: Fragebogen1_Baseline_v0.3)',
  dauerMin: 14,
  einleitung: 'Bitte kreuzen Sie pro Frage bzw. Zeile eine Antwort an, sofern nicht anders angegeben. Es gibt keine richtigen oder falschen Antworten. Ihre Angaben werden pseudonymisiert ausgewertet.',
  abschluss: 'Vielen Dank für Ihre Teilnahme!',
  abschnitte: [
    {
      id: 'A', titel: 'Angaben zur Person',
      items: [
        { id: 'A1', v: 1, typ: 'einfach', text: 'Alter', optionen: [[1, '< 30 Jahre'], [2, '30–39 Jahre'], [3, '40–49 Jahre'], [4, '≥ 50 Jahre']] },
        { id: 'A2', v: 1, typ: 'einfach', text: 'Geschlecht', optionen: [[1, 'weiblich'], [2, 'männlich'], [3, 'divers'], [-99, 'keine Angabe']] },
        {
          id: 'A3', v: 1, typ: 'einfach', text: 'Funktion',
          optionen: [[1, 'Assistenzärztin/-arzt'], [2, 'Fachärztin/-arzt'], [3, 'Oberärztin/-arzt'], [9, 'Sonstiges']], freitextBei: 9,
        },
        { id: 'A4', v: 1, typ: 'einfach', text: 'Ärztliche Berufserfahrung', optionen: [[1, '< 2 Jahre'], [2, '2–5 Jahre'], [3, '6–10 Jahre'], [4, '> 10 Jahre']] },
        { id: 'A5', v: 1, typ: 'einfach', text: 'Tätigkeit im aktuellen Bereich', optionen: [[1, '< 6 Monate'], [2, '6–12 Monate'], [3, '> 12 Monate']] },
        {
          id: 'A6', v: 1, typ: 'prozentgruppe', summe: 100, mindestensEine: true, autoHundert: true,
          text: 'In welchen Bereichen arbeiten Sie im Studienzeitraum, und mit welchem Anteil Ihrer Arbeitszeit? (Mehrfachnennung möglich; Summe 100 %)',
          zeilen: [['STAT', 'Station'], ['AMB', 'Ambulanz'], ['FUNK', 'Funktionsbereich (z. B. Dialyse)'],
            ['ZNA_BEH', 'Notaufnahme: Behandlungsbereich'], ['ZNA_STAT', 'Notaufnahme: Notaufnahmestation'], ['SONST', 'Sonstiges']],
          freitextBei: 'SONST',
        },
        { id: 'A7', v: 1, typ: 'zahl', text: 'Beschäftigungsumfang: ___ % einer Vollzeitstelle', einheit: '%', min: 10, max: 100 },
        { id: 'A8', v: 1, typ: 'einfach', text: 'Nehmen Sie im Studienzeitraum an Bereitschafts- oder Nachtdiensten teil?', optionen: [[1, 'ja'], [2, 'nein']] },
      ],
    },
    {
      id: 'B', titel: 'Bisherige Nutzung mobiler Geräte und des Klinikinformationssystems',
      items: [
        {
          id: 'B1', v: 1, typ: 'einfach', text: 'Wie häufig nutzen Sie derzeit einen mobilen Visitenwagen bzw. Laptop für Patienteninformationen?',
          optionen: [[1, 'nie'], [2, 'seltener als wöchentlich'], [3, 'wöchentlich'], [4, 'täglich']],
        },
        {
          id: 'B2', v: 1, typ: 'einfach', text: 'Wie häufig nutzen Sie bei der Arbeit Ihr privates Smartphone für medizinische Informationen (z. B. Apps, Leitlinien)?',
          optionen: [[1, 'nie'], [2, 'seltener als wöchentlich'], [3, 'wöchentlich'], [4, 'täglich']],
        },
        {
          id: 'B3', v: 1, typ: 'einfach', text: 'Haben Sie HX Now vor dieser Studie bereits genutzt?',
          optionen: [[1, 'nein'], [2, 'ja, kurz ausprobiert'], [3, 'ja, regelmäßig']],
        },
        {
          id: 'B4', v: 1, typ: 'einfach', text: 'Wie zufrieden sind Sie mit dem Zugriff auf Patientendaten über das bestehende Klinikinformationssystem (SAP)?',
          optionen: [[1, 'sehr unzufrieden'], [2, 'eher unzufrieden'], [3, 'teils/teils'], [4, 'eher zufrieden'], [5, 'sehr zufrieden']],
        },
        {
          id: 'B5', v: 1, typ: 'einfach', text: 'Betriebssystem Ihres privaten Smartphones',
          optionen: [[1, 'iOS'], [2, 'Android'], [3, 'anderes'], [4, 'kein Smartphone']],
        },
      ],
    },
    {
      id: 'W', titel: 'Informationsbedarf in den letzten 14 Tagen',
      items: [
        { id: 'W1', v: 1, typ: 'zahl', text: 'An wie vielen Tagen hatten Sie in den letzten 14 Tagen Dienst?', einheit: 'Tage', min: 0, max: 14 },
        {
          id: 'W2', v: 1, typ: 'zahl', text: 'Davon Bereitschafts- oder Nachtdienste:', min: 0, max: 14,
          showIf: 'W1 > 0 UND A8 = 1', auto: { wenn: 'A8 = 2', wert: 0 }, validierung: 'W2 <= W1',
        },
        {
          id: 'W_INFO', v: 1, typ: 'info', showIf: MIT_DIENST,
          text: 'Informationsbedarf abseits eines PCs: Sie benötigten eine patientenbezogene Information (z. B. Laborwert, Befund, Bildgebung, Medikation), während kein stationärer Arbeitsplatz-PC unmittelbar erreichbar war. Sofort vor Ort: ohne Ortswechsel, Anruf oder Aufschub, z. B. über einen Visitenwagen, ein anderes mobiles Gerät oder Papierunterlagen.',
        },
        {
          id: 'W3', v: 1, typ: 'matrix', showIf: MIT_DIENST,
          text: 'Bitte geben Sie für jede Situation an, wie oft in den letzten 14 Tagen Informationsbedarf abseits eines PCs entstand (A) und wie Sie ihn überwiegend gelöst haben (B).',
          zeilen: W3_ZEILEN,
          hinweis: W3_HINWEIS,
          zeilenShowIf: { '04': 'A6_STAT = 1 ODER A6_ZNA_STAT = 1', '06': 'A6_ZNA_BEH = 1', '09': 'A8 = 1' },
          gruppen: [
            { id: 'A', titel: 'Wie oft?', optionen: HAEUFIGKEIT_14_TAGE, paarJeZelle: true },
            { id: 'B', titel: 'Wie überwiegend gelöst?', showIf: 'W3_*_A > 0', optionen: GELOEST, paarJeZelle: true },
          ],
        },
        {
          id: 'W4a', v: 1, typ: 'einfach', showIf: MIT_BEDARF,
          text: 'Denken Sie an den Informationsbedarf abseits eines PCs, der in den letzten 14 Tagen am häufigsten vorkam. Welche Information wurde am häufigsten benötigt?',
          optionen: INFO_ART, freitextBei: 9, paar: 'INFO_HAEUF_ART',
        },
        {
          id: 'W4b', v: 1, typ: 'einfach', text: 'Wo entstand dieser Bedarf meistens?', showIf: MIT_BEDARF,
          optionen: ORTE, optionShowIf: { 5: 'A6_ZNA_BEH = 1', 7: 'A8 = 1' }, paar: 'INFO_HAEUF_ORT',
        },
        {
          id: 'W4c', v: 1, typ: 'einfach', text: 'Wie haben Sie ihn meistens gelöst?', showIf: MIT_BEDARF,
          optionen: [[1, 'sofort vor Ort (z. B. Visitenwagen)'], [2, 'Weg zum PC'], [3, 'Anruf / Rückfrage'], [4, 'aufgeschoben'], [5, 'verzichtet']],
          paar: 'INFO_HAEUF_LOES',
        },
        {
          id: 'W4d', v: 1, typ: 'einfach', text: 'Wie lange dauerte es typischerweise, bis Sie die Information hatten?',
          showIf: `${MIT_BEDARF} UND W4c != 5`, auto: { wenn: 'W4c = 5', wert: 5 }, optionen: DAUER, paar: 'INFO_HAEUF_DAUER',
        },
        { id: 'W5', v: 1, typ: 'freitext', text: 'Möchten Sie etwas zu den letzten 14 Tagen anmerken?', showIf: MIT_DIENST, hinweis: KEINE_NAMEN },
      ],
    },
    {
      id: 'C', titel: 'Affinität zur Technikinteraktion (ATI-Skala)',
      items: [
        {
          id: 'C_INFO', v: 1, typ: 'info',
          text: 'Im Folgenden geht es um Ihre Interaktion mit technischen Systemen. Mit „technischen Systemen“ sind sowohl Apps und andere Software-Anwendungen als auch komplette digitale Geräte (z. B. Handy, Computer, Fernseher, Auto-Navigation) gemeint. Bitte geben Sie den Grad Ihrer Zustimmung zu folgenden Aussagen an.',
        },
        ...skalaItems('C', [
          'Ich beschäftige mich gern genauer mit technischen Systemen.',
          'Ich probiere gern die Funktionen neuer technischer Systeme aus.',
          'In erster Linie beschäftige ich mich mit technischen Systemen, weil ich muss.',
          'Wenn ich ein neues technisches System vor mir habe, probiere ich es intensiv aus.',
          'Ich verbringe sehr gern Zeit mit dem Kennenlernen eines neuen technischen Systems.',
          'Es genügt mir, dass ein technisches System funktioniert, mir ist es egal, wie oder warum.',
          'Ich versuche zu verstehen, wie ein technisches System genau funktioniert.',
          'Es genügt mir, die Grundfunktionen eines technischen Systems zu kennen.',
          'Ich versuche, die Möglichkeiten eines technischen Systems vollständig auszunutzen.',
        ], { min: 1, max: 6, anker: ATI_ANKER, skala: 'ATI' }, (n) => ([3, 6, 8].includes(n) ? { umpolen: true } : {})),
      ],
    },
    {
      id: 'D', titel: 'Erwartungen an HX Now (Technologieakzeptanzmodell, TAM)',
      items: [
        { id: 'D_INFO', v: 1, typ: 'info', text: 'Bitte geben Sie an, was Sie von HX Now erwarten.' },
        { id: 'D_PU_INFO', v: 1, typ: 'info', text: 'Wahrgenommene Nützlichkeit', unterueberschrift: true },
        ...skalaItems('D', [
          'Mit HX Now werde ich meine Aufgaben schneller erledigen können.',
          'HX Now wird die Qualität meiner Arbeit verbessern.',
          'HX Now wird meine Produktivität steigern.',
          'HX Now wird meine Effektivität bei der Arbeit steigern.',
          'HX Now wird meine Arbeit erleichtern.',
          'HX Now wird für meine Arbeit nützlich sein.',
        ], { min: 1, max: 7, anker: TAM_ANKER, skala: 'TAM_PU' }, (n) => ({ paar: `TAM_PU_${n}` })),
        { id: 'D_PEOU_INFO', v: 1, typ: 'info', text: 'Wahrgenommene Benutzerfreundlichkeit', unterueberschrift: true },
        ...skalaItems('D', [
          'Den Umgang mit HX Now zu erlernen, wird für mich leicht sein.',
          'Es wird leicht sein, mit HX Now das zu erreichen, was ich möchte.',
          'Die Bedienung von HX Now wird klar und verständlich sein.',
          'HX Now wird flexibel in der Bedienung sein.',
          'Es wird leicht sein, im Umgang mit HX Now geübt zu werden.',
          'HX Now wird einfach zu bedienen sein.',
        ], { min: 1, max: 7, anker: TAM_ANKER, skala: 'TAM_PEOU' }, (n) => ({ id: `D${n + 6}`, paar: `TAM_PEOU_${n}` })),
        { id: 'D_BI_INFO', v: 1, typ: 'info', text: 'Nutzungsabsicht', unterueberschrift: true },
        ...skalaItems('D', [
          'Ich beabsichtige, HX Now regelmäßig zu nutzen.',
          'Ich werde HX Now nutzen, wann immer es sinnvoll ist.',
        ], { min: 1, max: 7, anker: TAM_ANKER, skala: 'TAM_BI' }, (n) => ({ id: `D${n + 12}`, paar: `TAM_BI_${n}` })),
      ],
    },
    {
      id: 'E', titel: 'Erwarteter Nutzen der Funktionen',
      items: [
        { id: 'E_INFO', v: 1, typ: 'info', text: 'Wie nützlich erwarten Sie diese Funktionen für Ihre Arbeit?' },
        ...skalaItems('E', FUNKTIONEN.map(([, l]) => l), { min: 1, max: 5, anker: NUTZEN_ANKER }, (n) => ({ paar: `FUNK_NUTZEN_${n}` })),
      ],
    },
    {
      id: 'F', titel: 'Erreichbarkeit und IT-Belastung',
      items: skalaItems('F', [
        'Durch die Möglichkeit, jederzeit auf Patientendaten zuzugreifen, wird es mir schwerer fallen, in Pausen und nach Dienstende abzuschalten.',
        'Die IT-Systeme, mit denen ich arbeite, verursachen mir Stress.',
      ], { min: 1, max: 5, anker: ZUSTIMMUNG_5_ANKER }, (n) => ({ paar: n === 1 ? 'ABSCHALTEN' : 'IT_STRESS' })),
    },
  ],
};

// ===================================================================== FB2
const HX_GENUTZT = 'W1 > 0 UND (IRGENDEIN(W5_*) > 0 ODER IRGENDEIN(W3_*_C) > 1)';
const W5_GENUTZT = (k) => `W5_${k} > 0 ODER UNBEKANNT(W5_${k})`;

const FB2 = {
  id: 'FB2',
  titel: 'Fragebogen 2 – Ende des Regelbetriebs mit HX Now',
  phase: 'POST',
  // freigegeben mit Definition 1.0.0 (ENTSCHEIDUNGEN Nr. 47); `status: 'entwurf'` würde ihn wieder auf den Probelauf beschränken
  quelle: 'FB2_Post_v0.3.md vom 08.11.2026 (Papier: Fragebogen2_Post_v0.3)',
  dauerMin: 18,
  einleitung: FB1.einleitung,
  abschluss: 'Vielen Dank für Ihre Teilnahme!',
  softSkips: [{
    id: 'SKIP_HX', nachAbschnitt: 'W', abschnitte: ['A', 'B', 'E', 'T'],
    wenn: 'W1 > 0 UND ALLE(W5_*) = 0 UND ALLE(W3_*_C) IN (1, -88)',
    text: 'Sie haben HX Now in den letzten 14 Tagen offenbar nicht genutzt. Möchten Sie die Fragen zur Bewertung der App (Abschnitte A, B, E, T) überspringen?',
  }],
  abschnitte: [
    {
      id: 'W', titel: 'Informationsbedarf und Nutzung in den letzten 14 Tagen',
      items: [
        { id: 'W1', v: 1, typ: 'zahl', text: 'An wie vielen Tagen hatten Sie in den letzten 14 Tagen Dienst?', einheit: 'Tage', min: 0, max: 14 },
        { id: 'W2', v: 1, typ: 'zahl', text: 'Davon Bereitschafts- oder Nachtdienste:', min: 0, max: 14, showIf: MIT_DIENST, validierung: 'W2 <= W1' },
        {
          id: 'W_INFO', v: 1, typ: 'info', showIf: MIT_DIENST,
          text: 'Informationsbedarf abseits eines PCs: Sie benötigten eine patientenbezogene Information (z. B. Laborwert, Befund, Bildgebung, Medikation), während kein stationärer Arbeitsplatz-PC unmittelbar erreichbar war. Sofort vor Ort: ohne Ortswechsel, Anruf oder Aufschub, z. B. über HX Now, einen Visitenwagen oder Papierunterlagen.',
        },
        {
          id: 'W3', v: 1, typ: 'matrix', showIf: MIT_DIENST,
          text: 'Bitte geben Sie für jede Situation an, wie oft in den letzten 14 Tagen Informationsbedarf abseits eines PCs entstand (A), wie Sie ihn überwiegend gelöst haben (B) und ob Sie dabei HX Now genutzt haben (C).',
          zeilen: W3_ZEILEN,
          hinweis: W3_HINWEIS,
          zeilenShowIf: { '09': 'W2 > 0 ODER UNBEKANNT(W2)' },
          gruppen: [
            { id: 'A', titel: 'Wie oft?', optionen: HAEUFIGKEIT_14_TAGE, paarJeZelle: true },
            { id: 'B', titel: 'Wie überwiegend gelöst?', showIf: 'W3_*_A > 0', optionen: GELOEST, paarJeZelle: true },
            { id: 'C', titel: 'HX Now genutzt?', showIf: 'W3_*_A > 0', optionen: [[1, 'nie'], [2, 'teils'], [3, 'meist']] },
          ],
        },
        {
          id: 'W4', v: 1, typ: 'einfach', text: 'Wie oft hatten Sie in den letzten 14 Tagen ein Gerät mit HX Now bei sich?', showIf: MIT_DIENST,
          optionen: GERAET_DABEI, paar: 'GERAET_DABEI',
        },
        {
          id: 'W5', v: 1, typ: 'matrix', text: 'Wie oft haben Sie die folgenden Funktionen in den letzten 14 Tagen genutzt?',
          showIf: 'W1 > 0 UND W4 != 1', auto: { wenn: 'W4 = 1', wert: 0 },
          zeilen: FUNKTIONEN, gruppen: [{ id: 'A', titel: 'Anzahl in den letzten 14 Tagen', optionen: FUNKTION_HAEUFIGKEIT }],
          paarZeilen: 'FUNK_HAEUF',
        },
        {
          id: 'W6a', v: 1, typ: 'einfach', showIf: MIT_BEDARF,
          text: 'Denken Sie an den Informationsbedarf abseits eines PCs, der in den letzten 14 Tagen am häufigsten vorkam. Welche Information wurde am häufigsten benötigt?',
          optionen: INFO_ART, freitextBei: 9, paar: 'INFO_HAEUF_ART',
        },
        {
          id: 'W6b', v: 1, typ: 'einfach', text: 'Wo entstand dieser Bedarf meistens?', showIf: MIT_BEDARF,
          optionen: ORTE, optionShowIf: { 7: 'W2 > 0 ODER UNBEKANNT(W2)' }, paar: 'INFO_HAEUF_ORT',
        },
        {
          id: 'W6c', v: 1, typ: 'einfach', text: 'Wie haben Sie ihn meistens gelöst?', showIf: MIT_BEDARF,
          optionen: GELOEST_MIT_HX, paar: 'INFO_HAEUF_LOES', paarUmkodierung: GELOEST_MIT_HX_ALS_FB1,
        },
        {
          id: 'W6d', v: 1, typ: 'einfach', text: 'Wie lange dauerte es typischerweise, bis Sie die Information hatten?',
          showIf: `${MIT_BEDARF} UND W6c != 6`, auto: { wenn: 'W6c = 6', wert: 5 }, optionen: DAUER, paar: 'INFO_HAEUF_DAUER',
        },
        {
          id: 'W7a', v: 1, typ: 'einfach', showIf: HX_GENUTZT,
          text: 'Wofür haben Sie HX Now in den letzten 14 Tagen am häufigsten genutzt? Häufigster Verwendungszweck',
          optionen: [[1, 'Laborwerte'], [2, 'Befunde/Bildgebung'], [3, 'Vorbefunde/Arztbriefe'], [4, 'Verlauf/Kurve'], [5, 'PMD-Dokumentation'],
            [6, 'Sprachdokumentation'], [7, 'Foto/Scan'], [9, 'Sonstiges']],
          freitextBei: 9,
        },
        {
          id: 'W7b', v: 1, typ: 'einfach', text: 'Wo nutzten Sie HX Now dafür meistens?', showIf: HX_GENUTZT,
          optionen: [...ORTE, [8, 'Pause']],
        },
        {
          id: 'W7c', v: 1, typ: 'einfach', text: 'Was hätten Sie ohne HX Now meistens getan?', showIf: HX_GENUTZT,
          optionen: [[1, 'Weg zum PC'], [2, 'Anruf / Rückfrage'], [3, 'aufgeschoben'], [4, 'verzichtet'], [5, 'anders vor Ort gelöst (z. B. Visitenwagen)']],
        },
        { id: 'W8', v: 1, typ: 'freitext', text: 'Möchten Sie etwas zu den letzten 14 Tagen anmerken?', showIf: MIT_DIENST, hinweis: KEINE_NAMEN },
      ],
    },
    {
      id: 'A', titel: 'Gebrauchstauglichkeit (System Usability Scale, SUS)',
      items: [
        { id: 'A_INFO', v: 1, typ: 'info', text: 'Bitte beziehen Sie sich in den folgenden Abschnitten auf Ihre gesamte Erfahrung mit HX Now.' },
        ...skalaItems('A', [
          'Ich denke, dass ich HX Now gerne häufig benutzen würde.',
          'Ich fand HX Now unnötig komplex.',
          'Ich fand HX Now einfach zu benutzen.',
          'Ich glaube, ich würde die Hilfe einer technisch versierten Person benötigen, um HX Now benutzen zu können.',
          'Ich fand, die verschiedenen Funktionen in HX Now waren gut integriert.',
          'Ich denke, HX Now enthielt zu viele Inkonsistenzen.',
          'Ich kann mir vorstellen, dass die meisten Menschen den Umgang mit HX Now sehr schnell lernen.',
          'Ich fand HX Now sehr umständlich zu nutzen.',
          'Ich fühlte mich bei der Benutzung von HX Now sicher.',
          'Ich musste eine Menge lernen, bevor ich anfangen konnte, HX Now zu verwenden.',
        ], { min: 1, max: 5, anker: SUS_ANKER, skala: 'SUS' }, (n) => (n % 2 === 0 ? { umpolen: true } : {})),
      ],
    },
    {
      id: 'B', titel: 'Akzeptanz (Technologieakzeptanzmodell, TAM)',
      items: [
        { id: 'B_PU_INFO', v: 1, typ: 'info', text: 'Wahrgenommene Nützlichkeit', unterueberschrift: true },
        ...skalaItems('B', [
          'Mit HX Now kann ich meine Aufgaben schneller erledigen.',
          'HX Now verbessert die Qualität meiner Arbeit.',
          'HX Now steigert meine Produktivität.',
          'HX Now steigert meine Effektivität bei der Arbeit.',
          'HX Now erleichtert meine Arbeit.',
          'HX Now ist für meine Arbeit nützlich.',
        ], { min: 1, max: 7, anker: TAM_ANKER, skala: 'TAM_PU' }, (n) => ({ paar: `TAM_PU_${n}` })),
        { id: 'B_PEOU_INFO', v: 1, typ: 'info', text: 'Wahrgenommene Benutzerfreundlichkeit', unterueberschrift: true },
        ...skalaItems('B', [
          'Den Umgang mit HX Now zu erlernen, ist für mich leicht.',
          'Es ist leicht, mit HX Now das zu erreichen, was ich möchte.',
          'Die Bedienung von HX Now ist klar und verständlich.',
          'HX Now ist flexibel in der Bedienung.',
          'Es ist leicht, im Umgang mit HX Now geübt zu werden.',
          'HX Now ist einfach zu bedienen.',
        ], { min: 1, max: 7, anker: TAM_ANKER, skala: 'TAM_PEOU' }, (n) => ({ id: `B${n + 6}`, paar: `TAM_PEOU_${n}` })),
        { id: 'B_BI_INFO', v: 1, typ: 'info', text: 'Nutzungsabsicht', unterueberschrift: true },
        ...skalaItems('B', [
          'Ich beabsichtige, HX Now auch künftig regelmäßig zu nutzen.',
          'Ich werde HX Now nutzen, wann immer es sinnvoll ist.',
        ], { min: 1, max: 7, anker: TAM_ANKER, skala: 'TAM_BI' }, (n) => ({ id: `B${n + 12}`, paar: `TAM_BI_${n}` })),
      ],
    },
    {
      id: 'E', titel: 'Nützlichkeit der Funktionen',
      items: skalaItems('E', FUNKTIONEN.map(([, l]) => l), { min: 1, max: 5, anker: NUTZEN_ANKER, zusatz: [[NICHT_GENUTZT, 'nicht genutzt']] },
        (n) => ({ paar: `FUNK_NUTZEN_${n}`, showIf: W5_GENUTZT(n), auto: { wenn: `W5_${n} = 0`, wert: NICHT_GENUTZT } })),
    },
    {
      id: 'T', titel: 'Technik',
      items: [
        {
          id: 'T1', v: 1, typ: 'matrix', text: 'Wie oft sind bei der Nutzung von HX Now folgende Probleme aufgetreten?',
          zeilen: [
            ['1', 'Keine oder schlechte Netzverbindung (WLAN)'], ['2', 'Akku leer oder zu schwach'], ['3', 'Probleme bei der Anmeldung'],
            ['4', 'Lange Ladezeiten'], ['5', 'Absturz oder Fehlermeldung'], ['6', 'Fehlerhafte Spracherkennung'], ['7', 'Gerät nicht griffbereit'],
          ],
          zeilenShowIf: { 6: W5_GENUTZT(7) },
          gruppen: [{ id: 'A', titel: 'Problem', optionen: [[1, 'nie'], [2, 'selten'], [3, 'gelegentlich'], [4, 'oft'], [5, 'sehr oft']] }],
        },
        {
          id: 'T2', v: 1, typ: 'matrix', text: 'Wie bewerten Sie folgende Funktionen?',
          zeilen: [
            ['1', 'Die Spracherkennung ist genau.'], ['2', 'Die Bildgebung ist auf dem Smartphone ausreichend beurteilbar.'],
            ['3', 'Fotos und Scans werden zuverlässig dem richtigen Patienten zugeordnet.'], ['4', 'PMDs lassen sich vollständig in der App bearbeiten.'],
          ],
          zeilenShowIf: { 1: W5_GENUTZT(7), 2: W5_GENUTZT(3), 3: 'W5_5 > 0 ODER W5_6 > 0 ODER UNBEKANNT(W5_5)', 4: W5_GENUTZT(4) },
          zeilenAuto: NICHT_GENUTZT, // ausgeblendete Zeile = nicht genutzt
          gruppen: [{
            id: 'A', titel: '1 = stimme gar nicht zu · 5 = stimme voll zu',
            optionen: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [NICHT_GENUTZT, 'nicht genutzt']],
          }],
        },
        {
          id: 'T3', v: 1, typ: 'skala', text: 'Wie wahrscheinlich ist es, dass Sie HX Now Kolleginnen und Kollegen empfehlen?',
          min: 0, max: 10, anker: { 0: 'sehr unwahrscheinlich', 10: 'sehr wahrscheinlich' },
        },
      ],
    },
    {
      id: 'C', titel: 'Veränderung Ihrer Arbeitsweise',
      items: [
        { id: 'C_INFO', v: 1, typ: 'info', text: 'Wie hat sich seit der Einführung von HX Now Folgendes bei Ihnen verändert?' },
        ...skalaItems('C', [
          'Zeit am stationären Arbeitsplatz-PC',
          'Wege zu einem PC, um Informationen nachzusehen',
          'Telefonische Rückfragen zu Patienteninformationen',
          'Aufgeschobene Aufgaben wegen fehlender Information',
          'Zeit am Patientenbett',
          'Aufwand für Dokumentation',
          'Unterbrechungen meiner Arbeit',
          'Arbeitsbelastung insgesamt',
        ], { min: 1, max: 5, anker: VERAENDERUNG_ANKER }),
        {
          id: 'C9', v: 1, typ: 'einfach', text: 'Wie häufig haben Sie HX Now insgesamt genutzt?',
          optionen: [[1, 'nie'], [2, 'seltener als wöchentlich'], [3, 'wöchentlich'], [4, 'täglich'], [5, 'mehrmals täglich']],
        },
        {
          id: 'C10', v: 1, typ: 'einfach', text: 'Würden Sie HX Now weiterhin nutzen, wenn die Nutzung freiwillig wäre?',
          optionen: [[1, 'ja'], [2, 'eher ja'], [3, 'eher nein'], [4, 'nein']],
        },
      ],
    },
    {
      id: 'F', titel: 'Erreichbarkeit und IT-Belastung',
      items: skalaItems('F', [
        'Durch die Möglichkeit, jederzeit auf Patientendaten zuzugreifen, fällt es mir schwerer, in Pausen und nach Dienstende abzuschalten.',
        'Die IT-Systeme, mit denen ich arbeite, verursachen mir Stress.',
      ], { min: 1, max: 5, anker: ZUSTIMMUNG_5_ANKER }, (n) => ({ paar: n === 1 ? 'ABSCHALTEN' : 'IT_STRESS' })),
    },
    {
      id: 'D', titel: 'Offene Fragen',
      items: [
        { id: 'D1', v: 1, typ: 'freitext', text: 'In welchen Situationen hat Ihnen HX Now am meisten geholfen?', hinweis: KEINE_NAMEN },
        { id: 'D2', v: 1, typ: 'freitext', text: 'Was hat die Nutzung von HX Now erschwert oder verhindert?', hinweis: KEINE_NAMEN },
        { id: 'D3', v: 1, typ: 'freitext', text: 'Was sollte an HX Now oder an der Einführung verbessert werden?', hinweis: KEINE_NAMEN },
        { id: 'D4', v: 1, typ: 'freitext', text: 'Sonstige Anmerkungen', hinweis: KEINE_NAMEN },
      ],
    },
  ],
};

// ===================================================================== KB
const KB = {
  id: 'KB',
  titel: 'Kurzbogen Gewöhnung (KB) – Ende der Einführungsphase',
  phase: 'EINF',
  quelle: 'KB_Gewoehnung_v0.3.md vom 08.11.2026',
  dauerMin: 2,
  einleitung: 'Bitte beziehen Sie sich auf die letzten 14 Tage seit der Einführung von HX Now.',
  abschluss: 'Vielen Dank!',
  abschnitte: [
    {
      id: 'G', titel: 'Gewöhnung',
      items: [
        { id: 'G1', v: 1, typ: 'einfach', text: 'Wie oft hatten Sie in den letzten 14 Tagen ein Gerät mit HX Now bei sich?', optionen: GERAET_DABEI, paar: 'GERAET_DABEI' },
        {
          id: 'G2', v: 1, typ: 'matrix', text: 'Wie oft haben Sie die folgenden Funktionen in den letzten 14 Tagen genutzt?',
          zeilen: FUNKTIONEN, gruppen: [{ id: 'A', titel: 'Anzahl in den letzten 14 Tagen', optionen: FUNKTION_HAEUFIGKEIT }],
          paarZeilen: 'FUNK_HAEUF',
        },
        {
          id: 'G3', v: 1, typ: 'einfach',
          text: 'Wenn Sie in den letzten 14 Tagen eine patientenbezogene Information benötigten, während kein Arbeitsplatz-PC unmittelbar erreichbar war: Wie haben Sie das meistens gelöst?',
          optionen: GELOEST_MIT_HX, paar: 'INFO_HAEUF_LOES', paarUmkodierung: GELOEST_MIT_HX_ALS_FB1,
        },
        { id: 'G4', v: 1, typ: 'skala', text: 'Wie vertraut sind Sie inzwischen mit HX Now?', min: 1, max: 5, anker: { 1: 'gar nicht vertraut', 5: 'sehr vertraut' } },
      ],
    },
  ],
};

export const FRAGEBOGEN_DEFINITION = Object.freeze({
  definitionVersion: '1.0.0', // SemVer (Plan 4.2); festgeschrieben vor Studienbeginn (ENTSCHEIDUNGEN Nr. 47)
  stand: '2026-11-08',
  boegen: [FB1, KB, FB2],
});
