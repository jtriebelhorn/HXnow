// Filter, Auto-Werte und Prüfhinweise der Fragebögen (Fragebogenplan 5, Spezifikationen v0.3).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FRAGEBOGEN_DEFINITION as DEF } from '../../js/frageboegen.js';
import { bogen, items } from '../../js/fb/definition.js';
import { parse, erfuellt, BedingungsFehler } from '../../js/fb/filter.js';
import { berechneStand, seiten, offeneFragen, pruefhinweise, sichtbareOptionen, zusammenfassungStand } from '../../js/fb/stand.js';

const FB1 = bogen(DEF, 'FB1');
const FB2 = bogen(DEF, 'FB2');
const ant = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? { wertText: v } : { wert: v }]));
const st = (b, o) => berechneStand(b, ant(o));
const z = (s, id) => { const e = s.zellen.get(id); return [e.sichtbar, e.wert, e.status]; };
const item = (b, id) => items(b).find((x) => x.id === id);

describe('Bedingungssyntax', () => {
  const werte = { A: 1, B: 2, C: null, D: -88, X_1_A: 0, X_2_A: 3, X_1_C: 1, X_2_C: -88 };
  const ids = Object.keys(werte);
  const e = (t) => erfuellt(t, (id) => werte[id] ?? null, ids);
  test('Vergleiche, UND vor ODER, Klammern, IN, Vergleich mit anderer Frage', () => {
    assert.equal(e('A = 1'), true);
    assert.equal(e('A != 1'), false);
    assert.equal(e('B > 1 UND A < 1'), false);
    assert.equal(e('A = 9 ODER B = 2 UND A = 1'), true);
    assert.equal(e('(A = 9 ODER B = 2) UND A = 9'), false);
    assert.equal(e('B IN (1, 2)'), true);
    assert.equal(e('A <= B'), true);
    assert.equal(e('A >= B'), false);
    assert.equal(e(''), true);
  });
  test('unbeantwortet oder ausgeblendet ist nie erfüllt – außer UNBEKANNT und ALLE mit −88', () => {
    assert.equal(e('C = 1'), false);
    assert.equal(e('C != 1'), false);
    assert.equal(e('D != 1'), false);
    assert.equal(e('UNBEKANNT(C)'), true);
    assert.equal(e('UNBEKANNT(D)'), true);
    assert.equal(e('UNBEKANNT(A)'), false);
    assert.equal(e('A <= C'), false);
    assert.equal(e('IRGENDEIN(X_*_A) > 0'), true);
    assert.equal(e('ALLE(X_*_A) = 0'), false);
    assert.equal(e('ALLE(X_*_C) IN (1, -88)'), true);
  });
  test('Syntaxfehler werden gemeldet', () => {
    assert.throws(() => parse('A = '), BedingungsFehler);
    assert.throws(() => parse('A = 1 UND'), BedingungsFehler);
    assert.throws(() => parse('A § 1'), BedingungsFehler);
    for (const b of DEF.boegen) for (const it of items(b)) if (it.showIf) parse(it.showIf);
  });
});

describe('FB1-Regeln', () => {
  test('W1b = 0: Rest von W ausgeblendet (−88); Seiten ohne W-Fragen bleiben', () => {
    const s = st(FB1, { W1b: 0 });
    assert.deepEqual(z(s, 'W2b'), [false, -88, 'gefiltert']);
    assert.deepEqual(z(s, 'W3_01_A'), [false, -88, 'gefiltert']);
    assert.deepEqual(z(s, 'W5'), [false, null, 'gefiltert']);
    assert.deepEqual(seiten(FB1, s), ['A', 'B', 'W', 'C', 'D', 'E', 'F']);
  });
  test('W2b: bei A8 = nein automatisch 0, bei unbeantwortetem A8b ausgeblendet, bei ja sichtbar; Hinweis bei W2b > W1b', () => {
    assert.deepEqual(z(st(FB1, { W1b: 5, A8b: 2 }), 'W2b'), [false, 0, 'automatisch']);
    assert.deepEqual(z(st(FB1, { W1b: 5 }), 'W2b'), [false, -88, 'gefiltert']);
    const s = st(FB1, { W1b: 5, A8b: 1, W2b: 7 });
    assert.deepEqual(z(s, 'W2b'), [true, 7, 'beantwortet']);
    assert.deepEqual(pruefhinweise(FB1, s, 'W').map((h) => h.itemId), ['W2b']);
  });
  test('W3: Zeilen 04/06/09 nach A6/A8; Spalte B nur bei A > 0; W4 nur mit Bedarf; W4d automatisch bei verzichtet', () => {
    let s = st(FB1, { W1b: 5, A8b: 2, A6_FUNK: 1 });
    assert.deepEqual(['W3_04_A', 'W3_06_A', 'W3_09_A', 'W3_01_A'].map((id) => s.zellen.get(id).sichtbar), [false, false, false, true]);
    s = st(FB1, { W1b: 5, A8b: 1, A6_STAT: 1, A6_ZNA_BEH: 1 });
    assert.deepEqual(['W3_04_A', 'W3_06_A', 'W3_09_A'].map((id) => s.zellen.get(id).sichtbar), [true, true, true]);
    s = st(FB1, { W1b: 5, W3_01_A: 0, W3_02_A: 2 });
    assert.deepEqual([z(s, 'W3_01_B')[0], z(s, 'W3_02_B')[0], z(s, 'W4a')[0]], [false, true, true]);
    assert.equal(st(FB1, { W1b: 5, W3_01_A: 0 }).zellen.get('W4a').sichtbar, false);
    assert.deepEqual(z(st(FB1, { W1b: 5, W3_01_A: 1, W4c: 5 }), 'W4d'), [false, 5, 'automatisch']);
  });
  test('W4b: Optionen „Behandlungsbereich Notaufnahme“ und „Bereitschafts-/Nachtdienst“ nur passend zu A6/A8b', () => {
    const codes = (o) => sichtbareOptionen(item(FB1, 'W4b'), st(FB1, o)).map(([c]) => c);
    assert.deepEqual(codes({}), [1, 2, 3, 4, 6]);
    assert.deepEqual(codes({ A6_ZNA_BEH: 1, A8b: 1 }), [1, 2, 3, 4, 5, 6, 7]);
  });
  test('A6: ein Bereich → 100 % automatisch; mehrere → Summe prüfen; Freitext bei Sonstiges; A3-Freitext bei 9', () => {
    let s = st(FB1, { A6_ZNA_BEH: 1 });
    assert.deepEqual(z(s, 'A6_ZNA_BEH_PCT'), [true, 100, 'automatisch']);
    assert.deepEqual(z(s, 'A6_STAT'), [true, 0, 'beantwortet']);
    assert.deepEqual(z(s, 'A6_STAT_PCT'), [false, -88, 'gefiltert']);
    s = st(FB1, { A6_STAT: 1, A6_SONST: 1, A6_STAT_PCT: 60, A6_SONST_PCT: 30, A6_SONST_TXT: 'Lehre' });
    assert.deepEqual(pruefhinweise(FB1, s, 'A').map((h) => h.text), ['Die Anteile ergeben 90 % statt 100 %.']);
    assert.deepEqual(z(s, 'A6_SONST_TXT'), [true, null, 'beantwortet']);
    assert.deepEqual(pruefhinweise(FB1, st(FB1, {}), 'A').map((h) => h.text), ['Bitte mindestens einen Bereich ankreuzen.']);
    assert.equal(st(FB1, { A3: 2 }).zellen.get('A3_TXT').sichtbar, false);
    assert.equal(st(FB1, { A3: 9 }).zellen.get('A3_TXT').sichtbar, true);
    assert.deepEqual(z(st(FB1, { A2: -99 }), 'A2'), [true, -99, 'keine_angabe']);
  });
  test('Offene Fragen: nur sichtbare, ohne Freitexte', () => {
    assert.equal(offeneFragen(st(FB1, {}), 'A'), 7); // A1–A5, A7, A8; A6 (Häkchen) hat eine eigene Prüfung
  });
});

describe('FB2-Regeln', () => {
  test('W5 bei „Gerät nie dabei“ automatisch 0; E bei nicht genutzter Funktion automatisch 9, sonst sichtbar', () => {
    let s = st(FB2, { W1b: 5, W4: 1 });
    assert.deepEqual(z(s, 'W5_1'), [false, 0, 'automatisch']);
    assert.deepEqual(z(s, 'E1'), [false, 9, 'automatisch']);
    s = st(FB2, { W1b: 5, W4: 3, W5_1: 0, W5_2: 2 });
    assert.deepEqual([z(s, 'E1'), z(s, 'E2')[0], z(s, 'E3')[0]], [[false, 9, 'automatisch'], true, true]);
    assert.equal(st(FB2, { W1b: 0 }).zellen.get('E1').sichtbar, true, 'W1b = 0: W5 unbekannt → E sichtbar');
  });
  test('T2-Zeilen: ausgeblendet = nicht genutzt (9); T1 Zeile 6 nur bei Spracherkennung', () => {
    const s = st(FB2, { W1b: 5, W4: 3, W5_7: 0, W5_3: 2 });
    assert.deepEqual([z(s, 'T2_1'), z(s, 'T2_2')[0], z(s, 'T1_6')], [[false, 9, 'automatisch'], true, [false, -88, 'gefiltert']]);
  });
  test('W6c verzichtet (6) → W6d automatisch „gar nicht“; W7 nur bei HX-Nutzung; Zeile 9 nach W2', () => {
    assert.deepEqual(z(st(FB2, { W1b: 5, W3_01_A: 1, W6c: 6 }), 'W6d'), [false, 5, 'automatisch']);
    assert.equal(st(FB2, { W1b: 5, W4: 3, W5_1: 0 }).zellen.get('W7a').sichtbar, false);
    assert.equal(st(FB2, { W1b: 5, W4: 3, W5_1: 2 }).zellen.get('W7a').sichtbar, true);
    assert.equal(st(FB2, { W1b: 5, W3_02_A: 1, W3_02_C: 3 }).zellen.get('W7a').sichtbar, true);
    assert.equal(st(FB2, { W1b: 5, W2b: 0 }).zellen.get('W3_09_A').sichtbar, false);
    assert.equal(st(FB2, { W1b: 5 }).zellen.get('W3_09_A').sichtbar, true);
  });
  test('Weiche Sprungregel: nur bei offensichtlicher Nichtnutzung; „ja“ blendet A, B, E, T aus, C/F/D bleiben', () => {
    const nicht = { W1b: 5, W4: 3, ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((k) => [`W5_${k}`, 0])) };
    assert.equal(st(FB2, nicht).zellen.get('SKIP_HX').sichtbar, true);
    assert.equal(st(FB2, { ...nicht, W5_3: 1 }).zellen.get('SKIP_HX').sichtbar, false);
    assert.equal(st(FB2, { ...nicht, W3_01_A: 1, W3_01_C: 2 }).zellen.get('SKIP_HX').sichtbar, false);
    const s = st(FB2, { ...nicht, SKIP_HX: 1 });
    assert.deepEqual([z(s, 'A1'), z(s, 'B1')[0], z(s, 'T3')[0], z(s, 'C1')[0], z(s, 'F1')[0]], [[false, -88, 'gefiltert'], false, false, true, true]);
    assert.deepEqual(seiten(FB2, s), ['W', 'C', 'F', 'D']);
    assert.equal(st(FB2, { ...nicht, SKIP_HX: 2 }).zellen.get('A1').sichtbar, true);
  });
  test('W6c wird in Papierreihenfolge angezeigt', () => {
    assert.deepEqual(sichtbareOptionen(item(FB2, 'W6c'), st(FB2, {})).map(([c]) => c), [1, 2, 3, 4, 5, 6]);
  });
});

describe('Definition 1.1.0: W1b, W2b, W2c, A8b (Korrekturauftrag A1)', () => {
  test('W1b > 0 mit A8b = nein: W2b automatisch 0, W2c entfällt; mit A8b = ja: W2b sichtbar, W2c bei W2b > 0', () => {
    let s = st(FB1, { W1b: 9, A8b: 2 });
    assert.deepEqual(z(s, 'W2b'), [false, 0, 'automatisch']);
    assert.equal(s.zellen.get('W2c_1').sichtbar, false);
    assert.equal(s.zellen.get('W3_09_A').sichtbar, false);
    s = st(FB1, { W1b: 9, A8b: 1, W2b: 2 });
    assert.deepEqual(z(s, 'W2b'), [true, 2, 'beantwortet']);
    assert.equal(s.zellen.get('W2c_1').sichtbar, true);
    assert.equal(s.zellen.get('W3_09_A').sichtbar, true);
    assert.equal(st(FB1, { W1b: 9, A8b: 1, W2b: 0 }).zellen.get('W2c_1').sichtbar, false);
  });
  test('W1b = 0: Abschnitt W entfällt bis auf W1b; W2b ohne A8b-Filter in FB2', () => {
    const s = st(FB1, { W1b: 0, A8b: 1 });
    const sichtbarW = [...s.zellen.values()].filter((e) => e.zelle.abschnitt === 'W' && e.sichtbar).map((e) => e.zelle.id);
    assert.deepEqual(sichtbarW, ['W1b']);
    assert.equal(st(FB2, { W1b: 5 }).zellen.get('W2b').sichtbar, true);
  });
  test('Plausibilität: W2b > W1b oder W2b > 7 → Hinweis mit Wert, keine Sperre', () => {
    assert.deepEqual(pruefhinweise(FB2, st(FB2, { W1b: 10, W2b: 8 }), 'W').map((h) => h.text), ['Bitte prüfen Sie Ihre Angabe: 8 Dienste in 14 Tagen.']);
    assert.deepEqual(pruefhinweise(FB2, st(FB2, { W1b: 3, W2b: 4 }), 'W').map((h) => h.itemId), ['W2b']);
    assert.deepEqual(pruefhinweise(FB2, st(FB2, { W1b: 10, W2b: 4 }), 'W'), []);
  });
  test('W2c Mehrfachauswahl: angekreuzte = 1, übrige 0; Sonstige mit Freitext; offen zählt einmal', () => {
    let s = st(FB2, { W1b: 9, W2b: 2 });
    assert.equal(offeneFragen(s, 'W') >= 1, true);
    const vorher = offeneFragen(s, 'W');
    s = st(FB2, { W1b: 9, W2b: 2, W2c_2: 1, W2c_9: 1, W2c_TXT: 'Rufdienst' });
    assert.deepEqual(['W2c_1', 'W2c_2', 'W2c_3', 'W2c_9'].map((id) => s.zellen.get(id).wert), [0, 1, 0, 1]);
    assert.deepEqual(z(s, 'W2c_TXT').slice(0, 1).concat(s.zellen.get('W2c_TXT').text), [true, 'Rufdienst']);
    assert.equal(offeneFragen(s, 'W'), vorher - 1);
  });
  test('Bogen mit Definition 1.0.0 (schon erhoben): neue Items „nicht gestellt“ (−88), Bedingungen nutzen W1/A8', () => {
    const alt = berechneStand(FB1, ant({ W1: 12, W2: 8, A8: 1, W3_01_A: 2 }), { definitionVersion: '1.0.0' });
    assert.deepEqual(z(alt, 'W1'), [true, 12, 'beantwortet']);
    assert.deepEqual(z(alt, 'W1b'), [false, -88, 'gefiltert']);
    assert.equal(alt.zellen.get('W1b').nichtGestellt, true);
    assert.deepEqual(z(alt, 'W3_01_A'), [true, 2, 'beantwortet'], 'W3 bleibt über W1 sichtbar');
    assert.equal(alt.zellen.get('W3_09_A').sichtbar, true, 'Zeile 09 über A8');
    const neu = berechneStand(FB1, ant({ W1b: 12 }));
    assert.equal(neu.zellen.has('W1'), false, 'entfernte Items nur bei älteren Sitzungen');
  });
  test('Nachtrag: Bedingungen aus Original (A8 = ja, 1.0.0) und Nachtrag (W1b) gemeinsam', () => {
    const basis = ant({ A8: 1, W1: 0 });
    const s = berechneStand(FB1, { ...basis, ...ant({ W1b: 10, W2b: 3, W3_09_A: 2 }) });
    assert.deepEqual(z(s, 'W2b'), [true, 3, 'beantwortet'], 'A8b fehlt → A8 aus dem Original');
    assert.equal(s.zellen.get('W3_09_A').sichtbar, true);
    assert.equal(zusammenfassungStand(s).beantwortet >= 3, true);
  });
});
