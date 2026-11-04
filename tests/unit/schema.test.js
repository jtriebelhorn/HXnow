import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validiereSchema, pruefeSchemaText, ladeSchema, pflichtangaben, nebentaetigkeiten, ntCode, istTestPseudonym } from '../../js/schema.js';

const ORIGINAL_TEXT = readFileSync(new URL('../../kodierschema.json', import.meta.url), 'utf8');
const original = () => JSON.parse(ORIGINAL_TEXT);

// Hilfsfunktion: genau ein Fehler, der den erwarteten Teiltext enthält
function erwarteFehler(schema, teiltext) {
  const fehler = validiereSchema(schema);
  assert.ok(
    fehler.some((f) => f.includes(teiltext)),
    `Erwartet Fehler mit „${teiltext}“, erhalten: ${JSON.stringify(fehler)}`,
  );
  return fehler;
}

test('ausgeliefertes kodierschema.json ist gültig', () => {
  assert.deepEqual(validiereSchema(original()), []);
});

test('kein Objekt', () => {
  assert.equal(validiereSchema(null).length, 1);
  assert.equal(validiereSchema([]).length, 1);
});

test('kein gültiges JSON → verständliche Meldung', () => {
  const { schema, fehler } = pruefeSchemaText('{ "schemaVersion": ');
  assert.equal(schema, null);
  assert.match(fehler[0], /kein gültiges JSON/);
});

test('fehlende Pflichtfelder werden einzeln gemeldet', () => {
  const s = original();
  delete s.schemaVersion;
  delete s.orte;
  delete s.export;
  const fehler = validiereSchema(s);
  assert.ok(fehler.some((f) => f.includes('schemaVersion')));
  assert.ok(fehler.some((f) => f.includes('„orte“ fehlt')));
  assert.ok(fehler.some((f) => f.includes('„export“ fehlt')));
});

test('blockDauerSek und warnungVorEndeSek', () => {
  let s = original(); s.blockDauerSek = 0;
  erwarteFehler(s, 'blockDauerSek');
  s = original(); s.blockDauerSek = '900';
  erwarteFehler(s, 'blockDauerSek');
  s = original(); s.warnungVorEndeSek = 900;
  erwarteFehler(s, 'kleiner als');
});

test('blockDauerOptionenSek', () => {
  let s = original(); s.blockDauerOptionenSek = [600, 600, 900];
  erwarteFehler(s, '600 kommt mehrfach vor');
  s = original(); s.blockDauerOptionenSek = [600];
  erwarteFehler(s, 'Standarddauer');
  s = original(); s.blockDauerOptionenSek = [30, 900];
  erwarteFehler(s, 'kleiner als jede Dauer');
  s = original(); s.blockDauerOptionenSek = ['10 min'];
  erwarteFehler(s, 'positiver ganzer Zahlen');
  s = original(); delete s.blockDauerOptionenSek;
  assert.deepEqual(validiereSchema(s), [], 'Angabe ist optional');
});

test('pflichtangaben: unbekannte Felder und Einträge, Wahrheitswerte; Abschnitt optional', () => {
  let s = original(); s.pflichtangaben.block = ['pseudonym', 'name'];
  erwarteFehler(s, 'unbekanntes Feld „name“');
  s = original(); s.pflichtangaben.pauseGrund = 'ja';
  erwarteFehler(s, '„pflichtangaben.pauseGrund“ muss true oder false sein');
  s = original(); s.pflichtangaben.alles = true;
  erwarteFehler(s, 'unbekannter Eintrag „alles“');
  s = original(); delete s.pflichtangaben;
  assert.deepEqual(validiereSchema(s), []);
});

test('doppelter Code innerhalb einer Liste', () => {
  const s = original();
  s.taetigkeiten.push({ code: 'T5', label: 'Doppelt', kurz: 'X' });
  erwarteFehler(s, 'Code „T5“ kommt mehrfach vor');
});

test('doppeltes Beobachter-Kürzel', () => {
  const s = original();
  s.beobachter = ['B1', 'B1'];
  erwarteFehler(s, 'Kürzel „B1“ kommt mehrfach vor');
});

test('Eintrag ohne label / Tätigkeit ohne kurz', () => {
  const s = original();
  delete s.orte[3].label;
  delete s.taetigkeiten[0].kurz;
  erwarteFehler(s, '„orte“, Eintrag 4 (O4): „label“ fehlt');
  erwarteFehler(s, 'Tätigkeit T1: „kurz“');
});

test('nurPhase verweist auf unbekannte Phase', () => {
  const s = original();
  s.taetigkeiten.find((t) => t.code === 'T3').nurPhase = 'NACH';
  erwarteFehler(s, '„nurPhase“ verweist auf unbekannte Phase „NACH“');
});

test('giltFuer: unbekannte Tätigkeit bzw. kein Gerät', () => {
  let s = original();
  s.nutzungsart.find((n) => n.code === 'N1').giltFuer = ['T1', 'T12'];
  erwarteFehler(s, '„giltFuer“ verweist auf unbekannte Tätigkeit „T12“');
  s = original();
  s.nutzungsart.find((n) => n.code === 'N2').giltFuer = ['T5'];
  erwarteFehler(s, 'kein Gerät');
  s = original();
  delete s.nutzungsart.find((n) => n.code === 'N3').giltFuer;
  erwarteFehler(s, 'Nutzungsart N3: „giltFuer“');
});

test('N9 muss für Tätigkeiten mit Pflicht-Nutzungsart gelten', () => {
  const s = original();
  s.nutzungsart.find((n) => n.code === 'N9').giltFuer = ['T1', 'T2'];
  erwarteFehler(s, '„N9“ muss für T3 gelten');
});

test('Tätigkeits-Schalter: Wahrheitswerte, nutzungsartPflicht nur bei Geräten', () => {
  let s = original();
  s.taetigkeiten.find((t) => t.code === 'T5').nutzungsartPflicht = true;
  erwarteFehler(s, 'nur bei Geräten');
  s = original();
  s.taetigkeiten.find((t) => t.code === 'T3').haltung = 'ja';
  erwarteFehler(s, '„haltung“ muss true oder false sein');
});

test('Pausen, Arbeitskontext, Gerät dabei, neue Pflichtfelder', () => {
  let s = original(); delete s.pausengruende;
  erwarteFehler(s, 'Liste „pausengruende“ fehlt');
  s = original(); s.pausengruende[4].freitextPflicht = 'ja';
  erwarteFehler(s, '„freitextPflicht“');
  s = original(); delete s.arbeitskontext[0].gruppe;
  erwarteFehler(s, 'Arbeitskontext K1: „gruppe“');
  s = original(); s.geraetDabeiOptionen = s.geraetDabeiOptionen.filter((g) => g.code !== 'U');
  erwarteFehler(s, 'Code „U“ fehlt');
  s = original(); s.pauseMaxSek = 0;
  erwarteFehler(s, 'pauseMaxSek');
  s = original(); delete s.nutzungsartBeiT1T2;
  erwarteFehler(s, 'nutzungsartBeiT1T2');
});

test('ungültiges Pseudonym-Muster und unpassendes Beispiel', () => {
  let s = original(); s.pseudonym.muster = '^P(\\d{3}$';
  erwarteFehler(s, 'kein gültiger regulärer Ausdruck');
  s = original(); s.pseudonym.beispiel = 'X17';
  erwarteFehler(s, 'passt nicht zum Muster');
});

test('N9 als Ersatzwert für unvollständige Episoden muss vorhanden sein', () => {
  const s = original();
  s.nutzungsart = s.nutzungsart.filter((n) => n.code !== 'N9');
  erwarteFehler(s, '„N9“');
});

test('mindestdauerAusnahmen verweist auf unbekannte Tätigkeit', () => {
  const s = original();
  s.regelnAuswertung.mindestdauerAusnahmen = ['T99'];
  erwarteFehler(s, 'unbekannte Tätigkeit „T99“');
});

test('ladeSchema: HTTP-Fehler und Netzwerkfehler', async () => {
  const r1 = await ladeSchema(async () => ({ ok: false, status: 404 }));
  assert.match(r1.fehler[0], /HTTP 404/);
  const r2 = await ladeSchema(async () => { throw new Error('offline'); });
  assert.match(r2.fehler[0], /offline/);
});

test('ladeSchema: gültige Datei', async () => {
  const r = await ladeSchema(async () => ({ ok: true, status: 200, text: async () => ORIGINAL_TEXT }));
  assert.deepEqual(r.fehler, []);
  assert.equal(r.schema.schemaVersion, '0.3');
});

test('Test-Code und beendenGrund werden geprüft', () => {
  const mit = (aendern) => { const s = original(); aendern(s); return validiereSchema(s); };
  assert.deepEqual(mit(() => {}), []);
  assert.match(mit((s) => { s.pseudonym.testCode = 'TEST'; }).join(' '), /Test-Code „TEST“ passt nicht/);
  assert.match(mit((s) => { s.pseudonym.testCode = 'P017'; }).join(' '), /testCode/);
  assert.match(mit((s) => { s.pflichtangaben.beendenGrund = 'ja'; }).join(' '), /beendenGrund/);
  assert.equal(istTestPseudonym(original(), ' p000 '), true);
  assert.equal(istTestPseudonym(original(), 'P017'), false);
  assert.equal(pflichtangaben({ ...original(), pflichtangaben: undefined }).beendenGrund, true);
});

test('Gleichzeitige Tätigkeiten und Unterwegs werden geprüft (ENTSCHEIDUNGEN Nr. 19, 20)', () => {
  const mit = (aendern) => { const s = original(); aendern(s); return validiereSchema(s).join(' '); };
  const t = (s, code) => s.taetigkeiten.find((x) => x.code === code);
  assert.deepEqual(nebentaetigkeiten(original()), ['T3', 'T4', 'T5', 'T6', 'T7']);
  assert.equal(ntCode('T3'), 'NT3');
  assert.match(mit((s) => { s.haltung = s.haltung.filter((h) => h.code !== 'H9'); }), /H9/);
  assert.deepEqual(nebentaetigkeiten({ ...original(), nebentaetigkeiten: undefined }), []);
  assert.equal(mit((s) => { delete s.nebentaetigkeiten; }), '');
  assert.match(mit((s) => { s.nebentaetigkeiten = 'T5'; }), /nebentaetigkeiten/);
  assert.match(mit((s) => { s.nebentaetigkeiten.push('T99'); }), /unbekannte Tätigkeit „T99“/);
  assert.match(mit((s) => { s.nebentaetigkeiten.push('T1'); }), /T1 kann nicht gleichzeitig/);
  assert.match(mit((s) => { s.nebentaetigkeiten.push('T9'); }), /T9 kann nicht gleichzeitig/);
  assert.match(mit((s) => { s.nebentaetigkeiten.push('T5'); }), /T5 kommt mehrfach vor/);
  assert.match(mit((s) => { s.orte.find((o) => o.unterwegs).haltung = 'H7'; }), /unbekannte Haltung „H7“/);
  assert.match(mit((s) => { s.orte[1].unterwegs = true; }), /Nur ein Ort/);
  assert.match(mit((s) => { delete t(s, 'T9').nurGehen; }), /genau eine Tätigkeit mit „nurGehen“/);
  assert.match(mit((s) => { t(s, 'T1').ortsfest = 'ja'; }), /„ortsfest“ muss true oder false/);
  assert.match(mit((s) => { t(s, 'T9').geraet = true; }), /nurGehen/);
});
