// Fragebogen-Definition (PLAN_Fragebogen-Modus_HX_Now.md, Abschnitt 3). Fest eingebaut: Eine inhaltliche
// Änderung braucht eine neue App-Version. Regeln für Änderungen (stabile IDs, Versionierung, Paar-IDs):
// Abschnitt 4 des Plans und README.
//
// Wortlaut FB1: Fragebogen1_Baseline_v0.3 vom 08.11.2026 (Text in docs/quellen/FB1_v0.3.txt; der Unit-Test
// prüft, dass jeder Fragetext dort wörtlich vorkommt). Hinweise, die nur auf Papier nötig sind
// („→ W2 überspringen“), stehen in `papierHinweis`; in der App übernehmen das die Filter (`showIf`).
//
// Item-Felder: id, v (Item-Version), typ, text, optionen [[code, beschriftung]], freitextBei, min, max, einheit,
// zeilen [[schluessel, beschriftung]], zeilenShowIf, gruppen (Matrix), optionShowIf, showIf, auto
// ({ wenn, wert }: Wert, wenn das Item ausgefiltert ist und die Bedingung gilt), skala, umpolen, paar, entfernt.
// Codes: Optionen 1…n in Papierreihenfolge, „Sonstiges“ = 9, „keine Angabe“ = −99 (gefiltert = −88 beim Export).

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

// Abschnitt W (außer W1) nur, wenn es Diensttage gab; W4 nur, wenn in W3 mindestens einmal Bedarf angegeben wurde
const MIT_DIENST = 'W1 > 0';
const MIT_BEDARF = `${MIT_DIENST} UND (${W3_ZEILEN.map(([z]) => `W3_${z}_A > 0`).join(' ODER ')})`;

const FB1 = {
  id: 'FB1',
  titel: 'Fragebogen 1 – Ausgangslage vor Einführung von HX Now',
  phase: 'PRE',
  quelle: 'Fragebogen1_Baseline_v0.3 vom 08.11.2026',
  einleitung: 'Bearbeitungszeit ca. 14 Minuten. Bitte kreuzen Sie pro Frage bzw. Zeile eine Antwort an, sofern nicht anders angegeben. Es gibt keine richtigen oder falschen Antworten. Ihre Angaben werden pseudonymisiert ausgewertet.',
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
          id: 'A6', v: 1, typ: 'prozentgruppe', summe: 100,
          text: 'In welchen Bereichen arbeiten Sie im Studienzeitraum, und mit welchem Anteil Ihrer Arbeitszeit? (Mehrfachnennung möglich; Summe 100 %)',
          zeilen: [['STAT', 'Station'], ['AMB', 'Ambulanz'], ['FUNK', 'Funktionsbereich (z. B. Dialyse)'],
            ['ZNA_BEH', 'Notaufnahme: Behandlungsbereich'], ['ZNA_STAT', 'Notaufnahme: Notaufnahmestation'], ['SONST', 'Sonstiges']],
          freitextBei: 'SONST',
        },
        { id: 'A7', v: 1, typ: 'zahl', text: 'Beschäftigungsumfang:', einheit: '% einer Vollzeitstelle', min: 1, max: 100 },
        {
          id: 'A8', v: 1, typ: 'einfach', text: 'Nehmen Sie im Studienzeitraum an Bereitschafts- oder Nachtdiensten teil?',
          optionen: [[1, 'ja'], [2, 'nein']], papierHinweis: 'nein → W2 überspringen',
        },
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
        {
          id: 'W1', v: 1, typ: 'zahl', text: 'An wie vielen Tagen hatten Sie in den letzten 14 Tagen Dienst?', einheit: 'Tage', min: 0, max: 14,
          papierHinweis: 'bei 0 weiter mit Abschnitt C',
        },
        {
          id: 'W2', v: 1, typ: 'zahl', text: 'Davon Bereitschafts- oder Nachtdienste:', min: 0, max: 14,
          showIf: `${MIT_DIENST} UND A8 = 1`, auto: { wenn: 'A8 = 2', wert: 0 },
        },
        {
          id: 'W_INFO', v: 1, typ: 'info', showIf: MIT_DIENST,
          text: 'Informationsbedarf abseits eines PCs: Sie benötigten eine patientenbezogene Information (z. B. Laborwert, Befund, Bildgebung, Medikation), während kein stationärer Arbeitsplatz-PC unmittelbar erreichbar war. Sofort vor Ort: ohne Ortswechsel, Anruf oder Aufschub, z. B. über einen Visitenwagen, ein anderes mobiles Gerät oder Papierunterlagen.',
        },
        {
          id: 'W3', v: 1, typ: 'matrix', showIf: MIT_DIENST,
          text: 'Bitte geben Sie für jede Situation an, wie oft in den letzten 14 Tagen Informationsbedarf abseits eines PCs entstand (A) und wie Sie ihn überwiegend gelöst haben (B).',
          papierHinweis: '(B bei „0“ leer lassen)',
          zeilen: W3_ZEILEN,
          zeilenShowIf: { '04': 'A6.STAT = 1 ODER A6.ZNA_STAT = 1', '06': 'A6.ZNA_BEH = 1', '09': 'A8 = 1' },
          gruppen: [
            { id: 'A', titel: 'Wie oft? (letzte 14 Tage)', optionen: [[0, '0'], [1, '1–3'], [2, '4–10'], [3, '11–20'], [4, '> 20']] },
            {
              id: 'B', titel: 'Wie überwiegend gelöst? (eine Antwort)', showIf: 'W3_*_A > 0',
              optionen: [[1, 'sofort vor Ort'], [2, 'Weg zum PC'], [3, 'Anruf / Rückfrage'], [4, 'Aufschub'], [5, 'Verzicht']],
            },
          ],
          paarJeZelle: true, // Paar-ID = Zellen-ID (W3_01_A …), in FB2 gleich
        },
        {
          id: 'W4', v: 1, typ: 'info', showIf: MIT_BEDARF,
          text: 'Denken Sie an den Informationsbedarf abseits eines PCs, der in den letzten 14 Tagen am häufigsten vorkam.',
          papierHinweis: '(falls in W3 überall „0“: weiter mit W5)',
        },
        {
          id: 'W4a', v: 1, typ: 'einfach', text: 'Welche Information wurde am häufigsten benötigt? (eine Antwort)', showIf: MIT_BEDARF,
          optionen: [[1, 'Laborwerte'], [2, 'Befunde/Bildgebung'], [3, 'Vorbefunde/Arztbriefe'], [4, 'Medikation'], [5, 'Verlauf/Kurve'], [9, 'Sonstiges']],
          freitextBei: 9, paar: 'INFO_HAEUF_ART',
        },
        {
          id: 'W4b', v: 1, typ: 'einfach', text: 'Wo entstand dieser Bedarf meistens? (eine Antwort)', showIf: MIT_BEDARF,
          optionen: [[1, 'Flur/Wegstrecke'], [2, 'Patientenzimmer'], [3, 'Visite'], [4, 'Übergabe'], [5, 'Behandlungsbereich Notaufnahme'],
            [6, 'anderer Bereich'], [7, 'Bereitschafts-/Nachtdienst']],
          optionShowIf: { 5: 'A6.ZNA_BEH = 1', 7: 'A8 = 1' },
          paar: 'INFO_HAEUF_ORT',
        },
        {
          id: 'W4c', v: 1, typ: 'einfach', text: 'Wie haben Sie ihn meistens gelöst? (eine Antwort)', showIf: MIT_BEDARF,
          optionen: [[1, 'sofort vor Ort (z. B. Visitenwagen)'], [2, 'Weg zum PC'], [3, 'Anruf / Rückfrage'], [4, 'aufgeschoben'], [5, 'verzichtet']],
          papierHinweis: 'verzichtet → W4d überspringen', paar: 'INFO_HAEUF_LOES',
        },
        {
          id: 'W4d', v: 1, typ: 'einfach', text: 'Wie lange dauerte es typischerweise, bis Sie die Information hatten?',
          showIf: `${MIT_BEDARF} UND W4c != 5`, auto: { wenn: 'W4c = 5', wert: 5 },
          optionen: [[1, 'sofort'], [2, '< 5 Minuten'], [3, '5–30 Minuten'], [4, '> 30 Minuten'], [5, 'gar nicht']],
          paar: 'INFO_HAEUF_DAUER',
        },
        { id: 'W5', v: 1, typ: 'freitext', text: 'Möchten Sie etwas zu den letzten 14 Tagen anmerken?', showIf: MIT_DIENST },
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
        { id: 'D_PU_INFO', v: 1, typ: 'info', text: 'Wahrgenommene Nützlichkeit' },
        ...skalaItems('D', [
          'Mit HX Now werde ich meine Aufgaben schneller erledigen können.',
          'HX Now wird die Qualität meiner Arbeit verbessern.',
          'HX Now wird meine Produktivität steigern.',
          'HX Now wird meine Effektivität bei der Arbeit steigern.',
          'HX Now wird meine Arbeit erleichtern.',
          'HX Now wird für meine Arbeit nützlich sein.',
        ], { min: 1, max: 7, anker: TAM_ANKER, skala: 'TAM_PU' }, (n) => ({ paar: `TAM_PU_${n}` })),
        { id: 'D_PEOU_INFO', v: 1, typ: 'info', text: 'Wahrgenommene Benutzerfreundlichkeit' },
        ...skalaItems('D', [
          'Den Umgang mit HX Now zu erlernen, wird für mich leicht sein.',
          'Es wird leicht sein, mit HX Now das zu erreichen, was ich möchte.',
          'Die Bedienung von HX Now wird klar und verständlich sein.',
          'HX Now wird flexibel in der Bedienung sein.',
          'Es wird leicht sein, im Umgang mit HX Now geübt zu werden.',
          'HX Now wird einfach zu bedienen sein.',
        ], { min: 1, max: 7, anker: TAM_ANKER, skala: 'TAM_PEOU' }, (n) => ({ id: `D${n + 6}`, paar: `TAM_PEOU_${n}` })),
        { id: 'D_BI_INFO', v: 1, typ: 'info', text: 'Nutzungsabsicht' },
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
        ...skalaItems('E', [
          'Krankenakte / Verlauf einsehen',
          'Laborwerte einsehen',
          'Bildgebung (PACS-Viewer)',
          'PMDs bearbeiten (z. B. Basisanamnese, Konsil)',
          'Fotodokumentation',
          'Dokumentenscan',
          'Sprachgestützte Dokumentation',
        ], { min: 1, max: 5, anker: NUTZEN_ANKER }, (n) => ({ paar: `FUNK_NUTZEN_${n}` })),
      ],
    },
    {
      id: 'F', titel: 'Erreichbarkeit und IT-Belastung',
      items: [
        ...skalaItems('F', [
          'Durch die Möglichkeit, jederzeit auf Patientendaten zuzugreifen, wird es mir schwerer fallen, in Pausen und nach Dienstende abzuschalten.',
          'Die IT-Systeme, mit denen ich arbeite, verursachen mir Stress.',
        ], { min: 1, max: 5, anker: ZUSTIMMUNG_5_ANKER }, (n) => ({ paar: n === 1 ? 'ABSCHALTEN' : 'IT_STRESS' })),
      ],
    },
  ],
};

export const FRAGEBOGEN_DEFINITION = Object.freeze({
  definitionVersion: '0.1.0', // SemVer (Plan 4.2); 1.0.0 erst nach dem Pretest
  stand: '2026-11-08',
  boegen: [FB1], // KB (Kurzbogen Gewöhnung) und FB2 folgen, sobald der Wortlaut vorliegt
});
