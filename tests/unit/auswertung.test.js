// Zusammenführungstool (F5/L6): Änderungen angewendet, Widerruf, Probeläufe, Doppelte, zwei Geräte, Scores,
// Prä-Post mit Umkodierung, Prüfbericht, ZIP.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fuehreZusammen, score } from '../../js/auswertung/zusammenfuehren.js';
import { bereinigeBlock } from '../../js/auswertung/bereinigen.js';
import { zipDatei } from '../../js/auswertung/zip.js';
import { leseCsv } from '../../js/csvlesen.js';
import { logbuchDatei } from '../../js/logbuchdatei.js';
import { fbDatei } from '../../js/fb/export.js';
import { versuchDatei } from '../../js/export.js';
import { bogen, alleZellen } from '../../js/fb/definition.js';
import { FRAGEBOGEN_DEFINITION as DEF } from '../../js/frageboegen.js';
import { SCHEMA, START } from './hilfen.js';

process.env.TZ = 'Europe/Berlin';

const BLOCK = readFileSync(new URL('./referenz/HXNOW_BEOB_P017_20261203_0915_id-0001.csv', import.meta.url), 'utf8');
const skalaWerte = (b, f) => Object.fromEntries(alleZellen(bogen(DEF, b)).filter((z) => z.skala).map((z, i) => [z.id, { wert: f(z, i) }]));
const fb = (art, id, code, antworten, start = START) => fbDatei(bogen(DEF, art), {
  sitzungId: id, geraeteId: 'g1', appVersion: '0.13.0', bogen: art, pseudonym: code, bereich: 'NEPH', erhebungsmodus: 'APP', startTs: start, endTs: start + 600_000,
}, antworten, { definitionVersion: DEF.definitionVersion });
const e = (id, art, p, phase, extra = {}) => ({ eintragId: id, art, pseudonym: p, phase, bereich: 'NEPH', dienst: 'F', arbeitskontext: 'K1', startTs: START, endTs: START + 900_000, beobachtetSek: 900, pausenAnzahl: 0, pausenSek: 0, status: art === 'BLOCK' ? 'beendet' : art === 'VERSUCH' ? 'nicht_angetroffen' : 'abgeschlossen', endeArt: null, abbruchCode: null, erhebungsmodus: '', exportStatus: 'exportiert', geraeteId: 'g1', testmodus: false, ...extra });
const t = (p, status = 'aktiv') => ({ pseudonym: p, bereich: 'NEPH', status, statusTs: START, registriertTs: START, notiz: '', phasenAbweichung: null });
const kopf = (g, now) => ({ geraeteId: g, appVersion: '0.13.0', dbVersion: 3, definitionVersion: '0.1.0', schemaVersion: '0.3', now, test: false });
const csv = (aus, name) => leseCsv(aus.ausgaben.find((a) => a.name === name).inhalt).zeilen;

function eingabe() {
  // FB1 von P021: ATI alle 4 (C3/6/8 umgepolt → 3), TAM 5; GERAET_DABEI-Paar fehlt in FB1; FB2 W6c umkodiert
  const fb1 = fb('FB1', 's-fb1', 'P021', { ...skalaWerte('FB1', (z) => (z.skala === 'ATI' ? 4 : 5)), A1: { wert: 2 } });
  const fb2 = fb('FB2', 's-fb2', 'P021', { ...skalaWerte('FB2', (z, i) => (z.skala === 'SUS' ? 5 - (i % 2) * 4 : 6)), W1: { wert: 5 }, W3_01_A: { wert: 2 }, W4: { wert: 3 }, W6c: { wert: 3 } }, START + 86_400_000 * 40);
  const fbW = fb('FB1', 's-weg', 'P099', { A1: { wert: 1 } });
  const versuch = versuchDatei({ versuchId: 'v-0001', geraeteId: 'g2', pseudonym: 'P021', beobachter: 'B1', bereich: 'NEPH', dienst: 'F', phase: 'PRE', ts: START }, SCHEMA);
  const test = fb('FB1', 's-test', 'P000', {});
  const lbAlt = logbuchDatei({ teilnehmende: [t('P017'), t('P021'), t('P099')], phasenplan: [], logbuch: [e('id-0001', 'BLOCK', 'P017', 'POST')], aenderungen: [] }, kopf('g1aaaaaa', START));
  const lbNeu = logbuchDatei({
    teilnehmende: [t('P017'), t('P021'), t('P099', 'widerrufen'), t('P020')],
    phasenplan: [{ bereich: 'NEPH', baselineStart: '2026-11-30', einfuehrungStart: '2026-12-14', regelbetriebStart: '2026-12-28', abschlussStart: '2027-02-01', ende: '2027-02-07' }],
    logbuch: [e('id-0001', 'BLOCK', 'P017', 'POST'), e('s-fb1', 'FB1', 'P021', 'PRE'), e('s-fb2', 'FB2', 'P021', 'POST'), e('fehlt-01', 'BLOCK', 'P020', 'PRE')],
    aenderungen: [
      { aenderungId: 'a1', ts: START + 1, geraeteId: 'g1', appVersion: '0.13.0', art: 'ZUORDNUNG', zielTyp: 'eintrag', zielId: 'id-0001', feld: 'pseudonym', alt: 'P017', neu: 'P020', grund: null, text: 'verwechselt' },
      { aenderungId: 'a2', ts: START + 2, geraeteId: 'g1', appVersion: '0.13.0', art: 'UNGUELTIG', zielTyp: 'eintrag', zielId: 'fehlt-01', feld: null, alt: null, neu: null, grund: 'U1', text: '' },
    ],
  }, kopf('g1aaaaaa', START + 5000));
  const lbG2 = logbuchDatei({ teilnehmende: [t('P021')], phasenplan: [], logbuch: [e('v-0001', 'VERSUCH', 'P021', 'PRE', { geraeteId: 'g2' })], aenderungen: [] }, kopf('g2bbbbbb', START + 3000));
  const kaputt = { name: 'HXNOW_Logbuch_kaputt.csv', text: lbNeu.inhalt.replace('verwechselt', 'vertauscht') };
  return [
    { name: 'HXNOW_BEOB_P017_20261203_0915_id-0001.csv', text: BLOCK }, { name: 'kopie.csv', text: BLOCK },
    { name: fb1.dateiname, text: fb1.inhalt }, { name: fb2.dateiname, text: fb2.inhalt }, { name: fbW.dateiname, text: fbW.inhalt },
    { name: versuch.dateiname, text: versuch.inhalt }, { name: `HXNOW_TEST_${test.dateiname}`, text: test.inhalt },
    { name: lbAlt.dateiname, text: lbAlt.inhalt }, { name: 'neu.csv', text: lbNeu.inhalt }, { name: lbG2.dateiname, text: lbG2.inhalt }, kaputt,
    { name: 'notiz.txt', text: 'hallo' },
  ];
}

describe('Zusammenführen', () => {
  const aus = fuehreZusammen(eingabe(), { def: DEF, schema: SCHEMA, jetzt: START + 86_400_000 });
  test('Ausgabedateien vollständig', () => {
    assert.deepEqual(aus.ausgaben.map((a) => a.name), ['beobachtung.csv', 'beobachtung_bereinigt.csv', 'versuche.csv', 'tageskennzahlen.csv', 'fb_long.csv', 'fb1_wide.csv', 'kb_wide.csv', 'fb2_wide.csv',
      'prae_post.csv', 'scores.csv', 'logbuch_gesamt.csv', 'alle_eintraege.csv', 'phasen.csv', 'aenderungen.csv', `HXNOW_CODEBUCH_FB_${DEF.definitionVersion}.csv`, 'pruefbericht.txt']);
  });
  test('Beobachtung: Zuordnung angewendet, Original erhalten, Doppelte nur einmal', () => {
    const b = csv(aus, 'beobachtung.csv');
    assert.equal(b.length, leseCsv(BLOCK).zeilen.length);
    assert.ok(b.every((z) => z.pseudonym === 'P020' && z.pseudonym_original === 'P017' && z.gueltig === '1'));
    assert.equal(aus.zahlen.doppelt, 1);
  });
  test('Widerruf und Probelauf verworfen; Logbuch mit falscher Prüfsumme nicht verwendet', () => {
    assert.ok(!csv(aus, 'fb_long.csv').some((z) => z.pseudonym === 'P099' || z.pseudonym === 'P000'));
    assert.equal(aus.zahlen.widerrufen, 1);
    assert.equal(aus.zahlen.uebersprungenTest, 1);
    assert.equal(aus.zahlen.logbuchFehler, 1);
    assert.equal(aus.zahlen.unbekannt, 1);
    assert.equal(aus.zahlen.logbuecher, 2, 'je Gerät die neueste');
  });
  test('Scores: ATI mit Umpolung, TAM, SUS', () => {
    const s = csv(aus, 'scores.csv');
    const fb1 = s.find((z) => z.bogen === 'FB1');
    assert.equal(fb1.ATI, '3.6667'); // (6 × 4 + 3 × 3) / 9, auf 4 Stellen
    assert.equal(fb1.TAM_PU, '5');
    assert.equal(fb1.SUS, '');
    const fb2 = s.find((z) => z.bogen === 'FB2');
    assert.equal(fb2.SUS, '100');
    assert.equal(fb2.TAM_BI, '6');
    assert.equal(score([{ id: 'x', min: 1, max: 5 }], { x: -88 }), '');
  });
  test('Prä-Post: Paare beider Bögen, FB2-Codes auf FB1 umkodiert', () => {
    const pp = csv(aus, 'prae_post.csv').filter((z) => z.pseudonym === 'P021');
    const tam = pp.find((z) => z.paar === 'TAM_PU_1');
    assert.deepEqual([tam.fb1_wert, tam.fb2_wert, tam.fb2_wert_wie_fb1], ['5', '6', '6']);
    const loes = pp.find((z) => z.paar === 'INFO_HAEUF_LOES');
    assert.deepEqual([loes.fb2_item, loes.fb2_wert, loes.fb2_wert_wie_fb1], ['W6c', '3', '2']);
  });
  test('Wide: eine Zeile je gültigem Bogen; Phasen und Abgleich; Prüfbericht', () => {
    assert.equal(csv(aus, 'fb1_wide.csv').length, 1);
    assert.equal(csv(aus, 'fb1_wide.csv')[0].C3, '4');
    const alle = csv(aus, 'alle_eintraege.csv');
    assert.equal(alle.find((z) => z.eintrag_id === 'fehlt-01').pruefung, 'Datei fehlt');
    const lb = csv(aus, 'logbuch_gesamt.csv');
    assert.equal(lb.find((z) => z.eintrag_id === 'fehlt-01').gueltig, '0');
    assert.equal(lb.find((z) => z.eintrag_id === 'v-0001').geraete_id, 'g2');
    const ph = csv(aus, 'phasen.csv').filter((z) => z.pseudonym === 'P021');
    assert.equal(ph.find((z) => z.phase === 'baseline').bogen_vorhanden, '1');
    assert.equal(ph.find((z) => z.phase === 'baseline').nicht_angetroffen, '1');
    const text = aus.bericht.join('\n');
    assert.match(text, /Widerrufene Codes: P099/);
    assert.match(text, /Datei fehlt \(1\):\n  - HXNOW_BEOB_P020_/);
    assert.match(text, /Logbuch-Datei nicht verwendet \(Prüfsumme/);
    assert.ok(!text.includes('verwechselt'));
  });
});

test('ZIP ist mit unzip lesbar und enthält die Dateien unverändert', () => {
  const zip = zipDatei([{ name: 'a.csv', inhalt: '﻿x;ä\r\n' }, { name: 'ordner/b.txt', inhalt: 'Prüfbericht' }]);
  const dir = mkdtempSync(join(tmpdir(), 'hxzip-'));
  writeFileSync(join(dir, 't.zip'), zip);
  let ausgabe;
  try { ausgabe = execFileSync('unzip', ['-t', join(dir, 't.zip')]).toString(); } catch (err) { if (err.code === 'ENOENT') return; throw err; }
  assert.match(ausgabe, /No errors detected/);
  assert.equal(execFileSync('unzip', ['-p', join(dir, 't.zip'), 'ordner/b.txt']).toString(), 'Prüfbericht');
});

describe('Bereinigung kurzer Episoden (Mindestdauer 3 s, T3 ausgenommen)', () => {
  const ep = (nr, t, o, dauer, extra = {}) => ({ datensatz: 'episode', block_id: 'b', nr: String(nr), taetigkeit: t, ort: o, nutzungsart: '', haltung: '', nebentaetigkeiten: '', dauer_sek: String(dauer), start: `s${nr}`, ende: `e${nr}`, ...extra });
  const regeln = { mindestdauerSek: 3, mindestdauerAusnahmen: ['T3'] };
  test('Zwischenzeile (Ort zuerst getippt) geht in der vorangehenden Episode auf; Gesamtdauer bleibt', () => {
    const r = bereinigeBlock([ep(1, 'T5', 'O4', 34), ep(2, 'T5', 'O8', 1.4), ep(3, 'T6', 'O8', 86)], regeln);
    assert.deepEqual(r.map((z) => [z.taetigkeit, z.ort, Number(z.dauer_sek), z.zusammengelegt, z.ende]), [['T5', 'O4', 35.4, 2, 'e2'], ['T6', 'O8', 86, 1, 'e3']]);
  });
  test('HX Now bleibt immer; kurze erste Episode geht in die folgende; Pause trennt', () => {
    const r = bereinigeBlock([ep(1, 'T1', 'O1', 2), ep(2, 'T6', 'O1', 20), ep(3, 'T3', 'O1', 1, { nutzungsart: 'N1', haltung: 'H1' }),
      { datensatz: 'pause', nr: '4', dauer_sek: '60' }, ep(5, 'T5', 'O2', 2), ep(6, 'T5', 'O2', 30)], regeln);
    assert.deepEqual(r.map((z) => [z.datensatz, z.taetigkeit ?? '', Number(z.dauer_sek), z.zusammengelegt]),
      [['episode', 'T6', 22, 2], ['episode', 'T3', 1, 1], ['pause', '', 60, 1], ['episode', 'T5', 32, 2]]);
    assert.equal(r[0].start, 's1');
  });
  test('gleich kodierte Nachbarn nach dem Entfernen werden vereint (Nebentätigkeiten zählen mit)', () => {
    const r = bereinigeBlock([ep(1, 'T6', 'O2', 10), ep(2, 'T5', 'O2', 2), ep(3, 'T6', 'O2', 10), ep(4, 'T6', 'O2', 10, { nebentaetigkeiten: 'NT4', NT4: '1' })], regeln);
    assert.deepEqual(r.map((z) => [Number(z.dauer_sek), z.zusammengelegt, z.nebentaetigkeiten]), [[22, 3, ''], [10, 1, 'NT4']]);
  });
  test('Dateien ohne format_version (vor der Festschreibung) werden nicht ausgewertet', () => {
    const alt = BLOCK.split('\r\n').map((z) => z.replace('datensatz;format_version;', 'datensatz;').replace(/^(episode|pause|block);1\.0;/, '$1;')).join('\r\n');
    const aus = fuehreZusammen([{ name: 'alt.csv', text: alt }], { def: DEF, schema: SCHEMA });
    assert.equal(aus.zahlen.vorFestschreibung, 1);
    assert.equal(leseCsv(aus.ausgaben[0].inhalt).zeilen.length, 0);
    assert.match(aus.bericht.join('\n'), /Vor der Festschreibung erzeugt/);
  });
});
