// Fragebogen-Definition (PLAN_Fragebogen-Modus_HX_Now.md, Abschnitt 3). Fest eingebaut: Eine inhaltliche
// Änderung braucht eine neue App-Version. Regeln für Änderungen (stabile IDs, Versionierung, Paar-IDs):
// Abschnitt 4 des Plans und README.
//
// Wortlaut: Fragebogen1_Baseline_v0.3 und Fragebogen2_Post_v0.3 vom 08.11.2026 (Texte in docs/quellen/; der
// Unit-Test prüft, dass jeder Fragetext dort wörtlich vorkommt). Hinweise, die nur auf Papier nötig sind
// („→ W2 überspringen“), stehen in `papierHinweis`; in der App übernehmen das die Filter (`showIf`).
//
// Item-Felder: id, v (Item-Version), typ, text, optionen [[code, beschriftung]], freitextBei, min, max, einheit,
// zeilen [[schluessel, beschriftung]], zeilenShowIf, gruppen (Matrix), optionShowIf, showIf, auto
// ({ wenn, wert }: Wert, wenn das Item ausgefiltert ist und die Bedingung gilt), skala, umpolen, paar, entfernt.
// Codes: Optionen 1…n in Papierreihenfolge, „Sonstiges“ = 9, „keine Angabe“ = −99, „nicht genutzt“ = 0
// (gefiltert = −88 beim Export). `reihenfolge`: Anzeige abweichend von der Code-Reihenfolge (FB2 W6c, Paar mit FB1 W4c).
// `zusatz`: Skala mit zusätzlicher Antwort außerhalb min–max. `paarZeilen`: Paar-ID je Matrixzeile (<Präfix>_<Nr>).

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

const SUS_ANKER = { 1: 'stimme gar nicht zu', 2: 'stimme nicht zu', 3: 'unentschieden', 4: 'stimme eher zu', 5: 'stimme voll zu' };
const VERAENDERUNG_ANKER = { 1: 'deutlich weniger', 2: 'etwas weniger', 3: 'unverändert', 4: 'etwas mehr', 5: 'deutlich mehr' };
const NICHT_GENUTZT = [[0, 'nicht genutzt']];

// HX Now genutzt (für W7): eine Funktion in W5 mindestens einmal genutzt oder in W3 „teils“/„meist“ mit HX Now
const W5_ZEILEN = [
  ['01', 'Krankenakte / Verlauf einsehen'],
  ['02', 'Laborwerte einsehen'],
  ['03', 'Bildgebung (PACS-Viewer)'],
  ['04', 'PMDs bearbeiten (z. B. Basisanamnese, Konsil)'],
  ['05', 'Fotodokumentation'],
  ['06', 'Dokumentenscan'],
  ['07', 'Sprachgestützte Dokumentation'],
];
const HX_GENUTZT = `${MIT_DIENST} UND (${[...W5_ZEILEN.map(([z]) => `W5_${z}_A > 0`), ...W3_ZEILEN.map(([z]) => `W3_${z}_C > 1`)].join(' ODER ')})`;

const FB2 = {
  id: 'FB2',
  titel: 'Fragebogen 2 – Ende des Regelbetriebs mit HX Now',
  phase: 'POST',
  quelle: 'Fragebogen2_Post_v0.3 vom 08.11.2026',
  einleitung: 'Bearbeitungszeit ca. 18 Minuten. Bitte kreuzen Sie pro Frage bzw. Zeile eine Antwort an, sofern nicht anders angegeben. Es gibt keine richtigen oder falschen Antworten. Ihre Angaben werden pseudonymisiert ausgewertet.',
  abschluss: 'Vielen Dank für Ihre Teilnahme!',
  abschnitte: [
    {
      id: 'W', titel: 'Informationsbedarf und Nutzung in den letzten 14 Tagen',
      items: [
        {
          id: 'W1', v: 1, typ: 'zahl', text: 'An wie vielen Tagen hatten Sie in den letzten 14 Tagen Dienst?', einheit: 'Tage', min: 0, max: 14,
          papierHinweis: '(bei 0 weiter mit Abschnitt A)',
        },
        { id: 'W2', v: 1, typ: 'zahl', text: 'Davon Bereitschafts- oder Nachtdienste:', min: 0, max: 14, showIf: MIT_DIENST },
        {
          id: 'W_INFO', v: 1, typ: 'info', showIf: MIT_DIENST,
          text: 'Informationsbedarf abseits eines PCs: Sie benötigten eine patientenbezogene Information (z. B. Laborwert, Befund, Bildgebung, Medikation), während kein stationärer Arbeitsplatz-PC unmittelbar erreichbar war. Sofort vor Ort: ohne Ortswechsel, Anruf oder Aufschub, z. B. über HX Now, einen Visitenwagen oder Papierunterlagen.',
        },
        {
          id: 'W3', v: 1, typ: 'matrix', showIf: MIT_DIENST,
          text: 'Bitte geben Sie für jede Situation an, wie oft in den letzten 14 Tagen Informationsbedarf abseits eines PCs entstand (A), wie Sie ihn überwiegend gelöst haben (B) und ob Sie dabei HX Now genutzt haben (C).',
          papierHinweis: '(B und C bei „0“ leer lassen)',
          zeilen: W3_ZEILEN,
          gruppen: [
            { id: 'A', titel: 'Wie oft?', optionen: [[0, '0'], [1, '1–3'], [2, '4–10'], [3, '11–20'], [4, '> 20']] },
            {
              id: 'B', titel: 'Wie überwiegend gelöst?', showIf: 'W3_*_A > 0',
              optionen: [[1, 'sofort vor Ort'], [2, 'Weg zum PC'], [3, 'Anruf / Rückfrage'], [4, 'Aufschub'], [5, 'Verzicht']],
            },
            { id: 'C', titel: 'HX Now genutzt?', showIf: 'W3_*_A > 0', optionen: [[1, 'nie'], [2, 'teils'], [3, 'meist']] },
          ],
          paarJeZelle: true,
        },
        {
          id: 'W4', v: 1, typ: 'einfach', text: 'Wie oft hatten Sie in den letzten 14 Tagen ein Gerät mit HX Now bei sich?', showIf: MIT_DIENST,
          optionen: [[1, 'nie'], [2, 'selten'], [3, 'meistens'], [4, 'immer']], paar: 'GERAET_DABEI',
        },
        {
          id: 'W5', v: 1, typ: 'matrix', text: 'Wie oft haben Sie die folgenden Funktionen in den letzten 14 Tagen genutzt?', showIf: MIT_DIENST,
          zeilen: W5_ZEILEN,
          gruppen: [{ id: 'A', titel: 'Anzahl in den letzten 14 Tagen', optionen: [[0, 'nie'], [1, '1–3×'], [2, '4–10×'], [3, '11–20×'], [4, '> 20×']] }],
          paarZeilen: 'FUNK_HAEUF',
        },
        {
          id: 'W6', v: 1, typ: 'info', showIf: MIT_BEDARF,
          text: 'Denken Sie an den Informationsbedarf abseits eines PCs, der in den letzten 14 Tagen am häufigsten vorkam.',
          papierHinweis: '(falls in W3 überall „0“: weiter mit W7)',
        },
        {
          id: 'W6a', v: 1, typ: 'einfach', text: 'Welche Information wurde am häufigsten benötigt? (eine Antwort)', showIf: MIT_BEDARF,
          optionen: [[1, 'Laborwerte'], [2, 'Befunde/Bildgebung'], [3, 'Vorbefunde/Arztbriefe'], [4, 'Medikation'], [5, 'Verlauf/Kurve'], [9, 'Sonstiges']],
          freitextBei: 9, paar: 'INFO_HAEUF_ART',
        },
        {
          id: 'W6b', v: 1, typ: 'einfach', text: 'Wo entstand dieser Bedarf meistens? (eine Antwort)', showIf: MIT_BEDARF,
          optionen: [[1, 'Flur/Wegstrecke'], [2, 'Patientenzimmer'], [3, 'Visite'], [4, 'Übergabe'], [5, 'Behandlungsbereich Notaufnahme'],
            [6, 'anderer Bereich'], [7, 'Bereitschafts-/Nachtdienst']],
          paar: 'INFO_HAEUF_ORT',
        },
        {
          // Codes 1–5 wie FB1 W4c (1 = sofort vor Ort ohne HX Now), 6 = mit HX Now; angezeigt in Papierreihenfolge
          id: 'W6c', v: 1, typ: 'einfach', text: 'Wie haben Sie ihn meistens gelöst? (eine Antwort)', showIf: MIT_BEDARF,
          optionen: [[1, 'anders vor Ort (z. B. Visitenwagen)'], [2, 'Weg zum PC'], [3, 'Anruf / Rückfrage'], [4, 'aufgeschoben'], [5, 'verzichtet'], [6, 'mit HX Now']],
          reihenfolge: [6, 1, 2, 3, 4, 5],
          papierHinweis: 'verzichtet → W6d überspringen', paar: 'INFO_HAEUF_LOES',
        },
        {
          id: 'W6d', v: 1, typ: 'einfach', text: 'Wie lange dauerte es typischerweise, bis Sie die Information hatten?',
          showIf: `${MIT_BEDARF} UND W6c != 5`, auto: { wenn: 'W6c = 5', wert: 5 },
          optionen: [[1, 'sofort'], [2, '< 5 Minuten'], [3, '5–30 Minuten'], [4, '> 30 Minuten'], [5, 'gar nicht']],
          paar: 'INFO_HAEUF_DAUER',
        },
        {
          id: 'W7', v: 1, typ: 'info', showIf: HX_GENUTZT,
          text: 'Wofür haben Sie HX Now in den letzten 14 Tagen am häufigsten genutzt?',
          papierHinweis: '(falls Sie HX Now nicht genutzt haben: weiter mit W8)',
        },
        {
          id: 'W7a', v: 1, typ: 'einfach', text: 'Häufigster Verwendungszweck (eine Antwort)', showIf: HX_GENUTZT,
          optionen: [[1, 'Laborwerte'], [2, 'Befunde/Bildgebung'], [3, 'Vorbefunde/Arztbriefe'], [4, 'Verlauf/Kurve'], [5, 'PMD-Dokumentation'],
            [6, 'Sprachdokumentation'], [7, 'Foto/Scan'], [9, 'Sonstiges']],
          freitextBei: 9,
        },
        {
          id: 'W7b', v: 1, typ: 'einfach', text: 'Wo nutzten Sie HX Now dafür meistens? (eine Antwort)', showIf: HX_GENUTZT,
          optionen: [[1, 'Flur/Wegstrecke'], [2, 'Patientenzimmer'], [3, 'Visite'], [4, 'Übergabe'], [5, 'Behandlungsbereich Notaufnahme'],
            [6, 'anderer Bereich'], [7, 'Bereitschafts-/Nachtdienst'], [8, 'Pause']],
        },
        {
          id: 'W7c', v: 1, typ: 'einfach', text: 'Was hätten Sie ohne HX Now meistens getan?', showIf: HX_GENUTZT,
          optionen: [[1, 'Weg zum PC'], [2, 'Anruf / Rückfrage'], [3, 'aufgeschoben'], [4, 'verzichtet'], [5, 'anders vor Ort gelöst (z. B. Visitenwagen)']],
        },
        { id: 'W8', v: 1, typ: 'freitext', text: 'Möchten Sie etwas zu den letzten 14 Tagen anmerken?', showIf: MIT_DIENST },
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
        { id: 'B_PU_INFO', v: 1, typ: 'info', text: 'Wahrgenommene Nützlichkeit' },
        ...skalaItems('B', [
          'Mit HX Now kann ich meine Aufgaben schneller erledigen.',
          'HX Now verbessert die Qualität meiner Arbeit.',
          'HX Now steigert meine Produktivität.',
          'HX Now steigert meine Effektivität bei der Arbeit.',
          'HX Now erleichtert meine Arbeit.',
          'HX Now ist für meine Arbeit nützlich.',
        ], { min: 1, max: 7, anker: TAM_ANKER, skala: 'TAM_PU' }, (n) => ({ paar: `TAM_PU_${n}` })),
        { id: 'B_PEOU_INFO', v: 1, typ: 'info', text: 'Wahrgenommene Benutzerfreundlichkeit' },
        ...skalaItems('B', [
          'Den Umgang mit HX Now zu erlernen, ist für mich leicht.',
          'Es ist leicht, mit HX Now das zu erreichen, was ich möchte.',
          'Die Bedienung von HX Now ist klar und verständlich.',
          'HX Now ist flexibel in der Bedienung.',
          'Es ist leicht, im Umgang mit HX Now geübt zu werden.',
          'HX Now ist einfach zu bedienen.',
        ], { min: 1, max: 7, anker: TAM_ANKER, skala: 'TAM_PEOU' }, (n) => ({ id: `B${n + 6}`, paar: `TAM_PEOU_${n}` })),
        { id: 'B_BI_INFO', v: 1, typ: 'info', text: 'Nutzungsabsicht' },
        ...skalaItems('B', [
          'Ich beabsichtige, HX Now auch künftig regelmäßig zu nutzen.',
          'Ich werde HX Now nutzen, wann immer es sinnvoll ist.',
        ], { min: 1, max: 7, anker: TAM_ANKER, skala: 'TAM_BI' }, (n) => ({ id: `B${n + 12}`, paar: `TAM_BI_${n}` })),
      ],
    },
    {
      id: 'E', titel: 'Nützlichkeit der Funktionen',
      items: skalaItems('E', W5_ZEILEN.map(([, l]) => l), { min: 1, max: 5, anker: NUTZEN_ANKER, zusatz: NICHT_GENUTZT },
        (n) => ({ paar: `FUNK_NUTZEN_${n}` })),
    },
    {
      id: 'T', titel: 'Technik',
      items: [
        {
          id: 'T1', v: 1, typ: 'matrix', text: 'Wie oft sind bei der Nutzung von HX Now folgende Probleme aufgetreten?',
          zeilen: [
            ['01', 'Keine oder schlechte Netzverbindung (WLAN)'], ['02', 'Akku leer oder zu schwach'], ['03', 'Probleme bei der Anmeldung'],
            ['04', 'Lange Ladezeiten'], ['05', 'Absturz oder Fehlermeldung'], ['06', 'Fehlerhafte Spracherkennung'], ['07', 'Gerät nicht griffbereit'],
          ],
          gruppen: [{ id: 'A', titel: 'Problem', optionen: [[1, 'nie'], [2, 'selten'], [3, 'gelegentlich'], [4, 'oft'], [5, 'sehr oft']] }],
        },
        {
          id: 'T2', v: 1, typ: 'matrix', text: 'Wie bewerten Sie folgende Funktionen?',
          zeilen: [
            ['01', 'Die Spracherkennung ist genau.'], ['02', 'Die Bildgebung ist auf dem Smartphone ausreichend beurteilbar.'],
            ['03', 'Fotos und Scans werden zuverlässig dem richtigen Patienten zugeordnet.'], ['04', 'PMDs lassen sich vollständig in der App bearbeiten.'],
          ],
          gruppen: [{
            id: 'A', titel: '1 = stimme gar nicht zu · 5 = stimme voll zu',
            optionen: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [0, 'nicht genutzt']],
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
        { id: 'D1', v: 1, typ: 'freitext', text: 'In welchen Situationen hat Ihnen HX Now am meisten geholfen?' },
        { id: 'D2', v: 1, typ: 'freitext', text: 'Was hat die Nutzung von HX Now erschwert oder verhindert?' },
        { id: 'D3', v: 1, typ: 'freitext', text: 'Was sollte an HX Now oder an der Einführung verbessert werden?' },
        { id: 'D4', v: 1, typ: 'freitext', text: 'Sonstige Anmerkungen' },
      ],
    },
  ],
};

export const FRAGEBOGEN_DEFINITION = Object.freeze({
  definitionVersion: '0.1.0', // SemVer (Plan 4.2); 1.0.0 erst nach dem Pretest
  stand: '2026-11-08',
  boegen: [FB1, FB2], // KB (Kurzbogen Gewöhnung) folgt, sobald der Wortlaut vorliegt
});
