// Referenzdateien des Exportformats 1.0 (ENTSCHEIDUNGEN Nr. 47): Versuch, Tageskennzahlen, Fragebogen und Logbuch werden
// aus festen Eingaben erzeugt und Zeichen für Zeichen mit tests/unit/referenz/ verglichen (Block: export.test.js).
// Ändert sich eine Datei, ist das eine Formatänderung: EXPORT_FORMAT erhöhen, Codebuch nachziehen, dann
// `REFERENZ_SCHREIBEN=1 node --test tests/unit/referenzen.test.js` und die neuen Dateien prüfen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { versuchDatei, tagDatei } from '../../js/export.js';
import { fbDatei } from '../../js/fb/export.js';
import { bogen } from '../../js/fb/definition.js';
import { FRAGEBOGEN_DEFINITION as DEF } from '../../js/frageboegen.js';
import { logbuchDatei } from '../../js/logbuchdatei.js';
import { SCHEMA, START } from './hilfen.js';

process.env.TZ = 'Europe/Berlin';

const DATEIEN = {
  versuch: () => versuchDatei({
    versuchId: 'abcdef12-0000-4000-8000-000000000000', geraeteId: 'g', schemaVersion: SCHEMA.schemaVersion, appVersion: '1.0.0',
    pseudonym: 'P099', beobachter: 'B1', bereich: 'ZNA', dienst: 'N', phase: 'PRE', ts: START, kommentar: 'OP; "dringend"',
  }, SCHEMA),
  tag: () => tagDatei({
    datum: '2026-12-03', bereich: 'NEPH', teilbereich: 'STATION', belegung: 28, aufnahmen: 4, entlassungen: 5, ambulant: null, aerzteAnwesend: 6,
    ereignisse: 'Personalausfall; KIS 10–11 Uhr', beobachter: 'B1', geraeteId: 'g', schemaVersion: SCHEMA.schemaVersion, appVersion: '1.0.0', ts: START,
  }),
  fragebogen: () => fbDatei(bogen(DEF, 'KB'), {
    sitzungId: 'fb000001-0000-4000-8000-000000000000', geraeteId: 'g', appVersion: '1.0.0', bogen: 'KB', pseudonym: 'P021', bereich: 'ZNA',
    erhebungsmodus: 'APP', startTs: START, endTs: START + 95_000, seitenzeiten: { G: 95 },
  }, { G1: { wert: 3 }, G2_1: { wert: 2 } }, { definitionVersion: DEF.definitionVersion }),
  logbuch: () => logbuchDatei({
    teilnehmende: [{ pseudonym: 'P021', bereich: 'ZNA', status: 'aktiv', statusTs: START, registriertTs: START, notiz: '', phasenAbweichung: null }],
    phasenplan: [{ bereich: 'ZNA', baselineStart: '2026-11-30', einfuehrungStart: '2026-12-14', regelbetriebStart: '2026-12-28', abschlussStart: '2027-02-01', ende: '2027-02-07' }],
    logbuch: [
      { eintragId: 'b0000001', art: 'BLOCK', pseudonym: 'P021', phase: 'PRE', bereich: 'ZNA', dienst: 'F', arbeitskontext: 'K6', startTs: START, endTs: START + 900_000, beobachtetSek: 840, pausenAnzahl: 1, pausenSek: 60, status: 'beendet', endeArt: 'regulaer', abbruchCode: null, erhebungsmodus: '', exportStatus: 'exportiert', geraeteId: 'g', testmodus: false },
      { eintragId: 'fb000001', art: 'KB', pseudonym: 'P021', phase: 'EINF', bereich: 'ZNA', startTs: START, endTs: START + 95_000, beobachtetSek: null, dauerSek: 95, pausenAnzahl: 0, pausenSek: 0, status: 'abgeschlossen', erhebungsmodus: 'APP', beantwortet: 2, ausgelassen: 8, exportStatus: 'offen', geraeteId: 'g', testmodus: false },
    ],
    aenderungen: [{ aenderungId: 'a0000001', ts: START + 1234, geraeteId: 'g', appVersion: '1.0.0', art: 'KOMMENTAR', zielTyp: 'eintrag', zielId: 'b0000001', text: 'Visite verlängert' }],
  }, { geraeteId: 'g0000000', appVersion: '1.0.0', dbVersion: 4, definitionVersion: DEF.definitionVersion, schemaVersion: SCHEMA.schemaVersion, now: START + 5000, test: false }),
};

for (const [art, erzeuge] of Object.entries(DATEIEN)) {
  test(`Referenzdatei ${art} (Exportformat 1.0)`, () => {
    const d = erzeuge();
    const pfad = new URL(`./referenz/${d.dateiname}`, import.meta.url);
    if (process.env.REFERENZ_SCHREIBEN === '1' || !existsSync(pfad)) writeFileSync(pfad, d.inhalt);
    assert.equal(d.inhalt, readFileSync(pfad, 'utf8'), `${d.dateiname} weicht von der Referenz ab`);
  });
}
