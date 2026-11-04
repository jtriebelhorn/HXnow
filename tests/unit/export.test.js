import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as B from '../../js/block.js';
import * as X from '../../js/export.js';
import { SCHEMA, START, testKontext, ANGABEN_POST, ANGABEN_PRE } from './hilfen.js';

process.env.TZ = 'Europe/Berlin';

const ok = (r) => { assert.ok(r.ok, `${r.code}: ${r.fehler}`); return r.zustand; };

/** Referenzblock v2 (von Hand nachgerechnet, siehe Referenzdatei). */
function referenzBlock() {
  const ctx = testKontext().bei(0);
  let z = ok(B.erzeugeBlock(ANGABEN_POST, ctx));
  z = ok(B.tippeOrt(z, 'O1', ctx));
  z = ok(B.tippeTaetigkeit(z, 'T1', ctx));
  z = ok(B.tippeNutzungsart(z, 'N2', ctx)); // bei T1 optional
  z = ok(B.setzeEpisodenKommentar(z, 'Visite; "kurz"', ctx));
  ctx.bei(47.4); z = ok(B.wechsle(z, { taetigkeit: 'T3', ort: 'O4' }, ctx)); // setzt „Gerät dabei“ automatisch
  z = ok(B.tippeNutzungsart(z, 'N1', ctx));
  z = ok(B.tippeHaltung(z, 'H1', ctx));
  ctx.bei(60.6); z = ok(B.wechsle(z, { taetigkeit: 'T5', ort: 'O2' }, ctx));
  ctx.bei(70); z = ok(B.tippeTaetigkeit(z, 'T6', ctx));
  z = ok(B.rueckgaengig(z, ctx)); // gelöscht → nicht im Export
  ctx.bei(120.5); z = ok(B.pausiere(z, ctx));
  ctx.bei(194); z = ok(B.setzeFort(z, { grund: 'P5', freitext: 'Alarm; Flur', taetigkeit: 'T5', ort: 'O2' }, ctx));
  ctx.bei(250.2); z = ok(B.tippeTaetigkeit(z, 'T3', ctx));
  z = ok(B.tippeNutzungsart(z, 'N2', ctx)); // Haltung bleibt offen → unvollständig
  ctx.bei(262.8); z = ok(B.tippeNeben(z, 'T5', ctx)); // Patient/in gleichzeitig → neue Zeile, neben_T5 = 1
  z = ok(B.setzeBlockKommentar(z, 'Station voll\nviel los'));
  z = B.pruefeAblauf(z, ctx.bei(2000)).zustand; // Ende bei 900 s beobachteter Zeit = 973,5 s Wandzeit
  return ok(B.beantworteGeraetDabei(z, 'J', ctx));
}

test('Block-CSV entspricht exakt der Referenzdatei (BOM, Semikolon, CRLF, Quoting, Pausen, Rundung)', () => {
  const datei = X.blockDatei(referenzBlock(), SCHEMA);
  const referenz = readFileSync(new URL('./referenz/HXNOW_BEOB_P017_20261203_0915_id-0001.csv', import.meta.url), 'utf8');
  assert.equal(datei.dateiname, 'HXNOW_BEOB_P017_20261203_0915_id-0001.csv');
  assert.equal(datei.inhalt, referenz);
  assert.equal(datei.typ, 'text/csv');
});

test('Dateiname: Pseudonym, lokales Datum/Uhrzeit, erste 8 Zeichen der Block-ID', () => {
  const name = X.dateinameBlock({ pseudonym: 'P017', startTs: Date.UTC(2026, 11, 3, 8, 15, 2), blockId: '3f2a9c1e-1111-4222-8333-444455556666' });
  assert.equal(name, 'HXNOW_BEOB_P017_20261203_0915_3f2a9c1e.csv');
});

test('Probelauf mit Test-Code (P000): Dateinamen beginnen mit HXNOW_TEST_', () => {
  const blockId = '3f2a9c1e-1111-4222-8333-444455556666';
  const startTs = Date.UTC(2026, 11, 3, 8, 15, 2);
  assert.equal(X.dateinameBlock({ pseudonym: 'P000', startTs, blockId }, SCHEMA), 'HXNOW_TEST_BEOB_P000_20261203_0915_3f2a9c1e.csv');
  assert.equal(X.dateinameBlock({ pseudonym: 'P017', startTs, blockId }, SCHEMA), 'HXNOW_BEOB_P017_20261203_0915_3f2a9c1e.csv');
  const v = { versuchId: blockId, geraeteId: 'g', pseudonym: 'P000', beobachter: 'B1', bereich: 'NEPH', dienst: 'F', phase: 'PRE', ts: startTs };
  assert.match(X.versuchDatei(v, SCHEMA).dateiname, /^HXNOW_TEST_VERSUCH_P000_/);
});

test('Zeitstempel konsistent: ende − start = dauer_sek in jeder Zeile, auch bei Millisekunden-Tipps', () => {
  const ctx = testKontext().bei(0.7);
  let z = ok(B.erzeugeBlock(ANGABEN_PRE, ctx)); // Start mit 700 ms Anteil
  z = ok(B.tippeOrt(z, 'O1', ctx));
  z = ok(B.tippeTaetigkeit(z, 'T5', ctx));
  for (const [sek, t] of [[24.9, 'T4'], [29.2, 'T9'], [49.4, 'T1'], [50.6, 'T7'], [57.1, 'T1']]) {
    z = ok(B.tippeTaetigkeit(z, t, ctx.bei(sek)));
  }
  z = ok(B.pausiere(z, ctx.bei(80.5)));
  z = ok(B.setzeFort(z, {}, ctx.bei(95.2)));
  z = ok(B.beendeManuell(z, { grund: 'Test' }, ctx.bei(120.4)));
  const zeilen = X.blockDatei(z, SCHEMA).inhalt.slice(1).split('\r\n').filter(Boolean).map((l) => l.split(';'));
  const k = zeilen.shift();
  const sp = (n) => k.indexOf(n);
  const ms = (iso) => Date.parse(iso);
  zeilen.forEach((w, i) => {
    assert.equal((ms(w[sp('ende')]) - ms(w[sp('start')])) / 1000, Number(w[sp('dauer_sek')]), `Zeile ${i + 1}`);
    if (i > 0) assert.equal(w[sp('start')], zeilen[i - 1][sp('ende')]);
  });
  assert.equal(zeilen[0][sp('start')], zeilen[0][sp('block_start')]);
  assert.equal(zeilen.at(-1)[sp('ende')], zeilen[0][sp('block_ende')]);
  assert.equal(zeilen[0][sp('block_ende_grund')], 'Test');
});

test('CSV-Felder nach RFC 4180', () => {
  assert.equal(X.csvFeld('einfach'), 'einfach');
  assert.equal(X.csvFeld('a;b'), '"a;b"');
  assert.equal(X.csvFeld('sagt "hallo"'), '"sagt ""hallo"""');
  assert.equal(X.csvFeld('zwei\r\nZeilen'), '"zwei\r\nZeilen"');
  assert.equal(X.csvFeld(null), '');
  assert.equal(X.csvFeld(0), '0');
});

test('Zeilenzahl = n_zeilen_block; Episoden = beobachtete Zeit, Pausen = Pausenzeit', () => {
  const zeilen = X.blockDatei(referenzBlock(), SCHEMA).inhalt.slice(1).split('\r\n').filter(Boolean);
  const kopf = zeilen[0].split(';');
  const werte = zeilen.slice(1).map((z) => z.replace(/"(?:[^"]|"")*"/g, 'X').split(';'));
  const sp = (n) => kopf.indexOf(n);
  assert.equal(werte.length, 7);
  assert.ok(werte.every((w) => w[sp('n_zeilen_block')] === '7' && w.length === kopf.length));
  const summe = (art) => werte.filter((w) => w[0] === art).reduce((s, w) => s + Number(w[sp('dauer_sek')]), 0);
  assert.equal(summe('episode'), Number(werte[0][sp('block_beobachtet_sek')]));
  assert.equal(summe('pause'), Number(werte[0][sp('block_pausen_sek')]));
  assert.deepEqual(werte.map((w) => w[sp('nr')]), ['1', '2', '3', '4', '5', '6', '7']);
});

test('Prä-Block: Gerät-Spalten leer bzw. 0', () => {
  const ctx = testKontext().bei(0);
  let z = ok(B.erzeugeBlock({ ...ANGABEN_POST, phase: 'PRE' }, ctx));
  z = ok(B.tippeOrt(z, 'O1', ctx));
  z = ok(B.tippeTaetigkeit(z, 'T5', ctx));
  z = B.pruefeAblauf(z, ctx.bei(900)).zustand;
  const [kopf, zeile] = X.blockDatei(z, SCHEMA).inhalt.slice(1).split('\r\n');
  const w = zeile.split(';');
  const k = kopf.split(';');
  assert.deepEqual(['hx_geraet_dabei', 'hx_geraet_automatisch', 'hx_geraet_markiert'].map((n) => w[k.indexOf(n)]), ['', '0', '']);
});

test('abgebrochener Block ohne Episoden → eine Zeile „block“ mit n_zeilen_block = 0', () => {
  const ctx = testKontext().bei(0);
  let z = ok(B.erzeugeBlock(ANGABEN_POST, ctx));
  z = ok(B.brecheAb(z, 'A1', '', ctx.bei(12)));
  const zeilen = X.blockDatei(z, SCHEMA).inhalt.slice(1).split('\r\n').filter(Boolean);
  assert.equal(zeilen.length, 2);
  const w = zeilen[1].split(';');
  assert.equal(w[0], 'block');
  assert.equal(w.length, X.spaltenBeobachtung(SCHEMA).length);
  assert.equal(w.at(-1), '0');
  assert.equal(w[X.spaltenBeobachtung(SCHEMA).indexOf('abbruch_code')], 'A1');
});

test('Abbruch während einer Pause: Pause ohne Grund im Export', () => {
  const ctx = testKontext().bei(0);
  let z = ok(B.erzeugeBlock(ANGABEN_POST, ctx));
  z = ok(B.tippeOrt(z, 'O1', ctx));
  z = ok(B.tippeTaetigkeit(z, 'T1', ctx));
  z = ok(B.pausiere(z, ctx.bei(30)));
  z = ok(B.brecheAb(z, 'A3', '', ctx.bei(400)));
  const zeilen = X.blockDatei(z, SCHEMA).inhalt.slice(1).split('\r\n').filter(Boolean);
  const k = zeilen[0].split(';');
  const p = zeilen[2].split(';');
  assert.deepEqual([p[0], p[k.indexOf('dauer_sek')], p[k.indexOf('pause_grund')]], ['pause', '370', '']);
});

test('laufende und verworfene Blöcke werden nicht exportiert', () => {
  const ctx = testKontext().bei(0);
  let z = ok(B.erzeugeBlock(ANGABEN_POST, ctx));
  assert.throws(() => X.blockDatei(z, SCHEMA), /läuft noch/);
  z = ok(B.tippeOrt(z, 'O1', ctx));
  z = ok(B.tippeTaetigkeit(z, 'T1', ctx));
  assert.throws(() => X.blockDatei(ok(B.pausiere(z, ctx.bei(2))), SCHEMA), /läuft noch/);
  z = ok(B.beendeManuell(z, { behalten: false }, ctx.bei(5)));
  assert.throws(() => X.blockDatei(z, SCHEMA), /Verworfene/);
});

test('Versuch-CSV', () => {
  const d = X.versuchDatei({
    versuchId: 'abcdef12-0000-4000-8000-000000000000', geraeteId: 'g', schemaVersion: '0.1', appVersion: '1.0.0',
    pseudonym: 'P099', beobachter: 'B1', bereich: 'ZNA', dienst: 'N', phase: 'PRE', ts: START, kommentar: 'OP',
  });
  assert.equal(d.dateiname, 'HXNOW_VERSUCH_P099_20261203_0915_abcdef12.csv');
  assert.equal(d.inhalt, '﻿' + X.SPALTEN_VERSUCH.join(';') + '\r\n'
    + 'versuch;abcdef12-0000-4000-8000-000000000000;g;0.1;1.0.0;P099;B1;ZNA;N;PRE;2026-12-03;2026-12-03T09:15:02+01:00;OP\r\n');
});

test('Tageskennzahlen-CSV', () => {
  const d = X.tagDatei({
    datum: '2026-12-03', bereich: 'ZNA', auslastung: 31, aerzteAnwesend: 4, ereignisse: 'MANV; Übung',
    beobachter: 'B1', geraeteId: 'g', schemaVersion: '0.1', appVersion: '1.0.0', ts: START,
  });
  assert.equal(d.dateiname, 'HXNOW_TAG_ZNA_20261203_0915.csv');
  assert.equal(d.inhalt, '﻿' + X.SPALTEN_TAG.join(';') + '\r\n'
    + 'tageskennzahlen;2026-12-03;ZNA;31;4;"MANV; Übung";B1;g;0.1;1.0.0;2026-12-03T09:15:02+01:00\r\n');
});

test('mailto: nur mit Empfänger, ohne BOM, Längengrenze 8000', () => {
  const datei = X.blockDatei(referenzBlock(), SCHEMA);
  assert.deepEqual(X.mailtoUrl(datei, SCHEMA), { url: null, grund: 'kein-empfaenger' });
  const mitEmpfaenger = { ...SCHEMA, export: { ...SCHEMA.export, mailEmpfaenger: 'studie@example.org' } };
  const { url } = X.mailtoUrl(datei, mitEmpfaenger);
  assert.ok(url.startsWith('mailto:studie@example.org?subject=HXNow-Beobachtung%20HXNOW_BEOB_P017'));
  assert.ok(!decodeURIComponent(url).includes('﻿'));
  assert.ok(decodeURIComponent(url).includes('\r\n'));
  const lang = { ...datei, inhalt: datei.inhalt.repeat(10) };
  const r = X.mailtoUrl(lang, mitEmpfaenger);
  assert.equal(r.url, null);
  assert.equal(r.grund, 'zu-lang');
});

test('versucheTeilen: ohne canShare → null; Abbruch → „abgebrochen“; Erfolg → „geteilt“; sonst Fehler', async () => {
  const datei = { dateiname: 'a.csv', inhalt: 'x', typ: 'text/csv' };
  assert.equal(X.versucheTeilen(datei, {}), null);
  assert.equal(X.versucheTeilen(datei, { share: async () => {}, canShare: () => false }), null);
  let aufgerufen = null;
  const nav = { canShare: () => true, share: (d) => { aufgerufen = d; return Promise.resolve(); } };
  const p = X.versucheTeilen(datei, nav);
  assert.ok(aufgerufen, 'share wird synchron aufgerufen, ohne await davor');
  assert.equal(aufgerufen.files[0].name, 'a.csv');
  assert.equal(await p, 'geteilt');
  const abbruch = Object.assign(new Error('x'), { name: 'AbortError' });
  assert.equal(await X.versucheTeilen(datei, { canShare: () => true, share: () => Promise.reject(abbruch) }), 'abgebrochen');
  await assert.rejects(X.versucheTeilen(datei, { canShare: () => true, share: () => Promise.reject(new Error('NotAllowed')) }), /NotAllowed/);
});

test('Spalten: neben_<Code> je gleichzeitiger Tätigkeit direkt nach „haltung“', () => {
  const k = X.spaltenBeobachtung(SCHEMA);
  const i = k.indexOf('haltung');
  assert.deepEqual(k.slice(i + 1, i + 7), ['neben_T5', 'neben_T6', 'neben_T7', 'neben_T3', 'neben_T4', 'neben_T3_nutzung']);
  assert.equal(k[i + 7], 'unvollstaendig');
  assert.deepEqual(X.spaltenBeobachtung({ ...SCHEMA, nebentaetigkeiten: [] }), [...X.SPALTEN_BEOBACHTUNG]);
});

test('HX Now gleichzeitig: neben_T3 = 1 und Nutzungsart in neben_T3_nutzung', () => {
  const ctx = testKontext().bei(0);
  let z = ok(B.erzeugeBlock(ANGABEN_POST, ctx));
  z = ok(B.tippeOrt(z, 'O2', ctx));
  z = ok(B.tippeTaetigkeit(z, 'T5', ctx));
  z = ok(B.tippeNeben(z, 'T3', ctx.bei(30)));
  z = ok(B.tippeNebenNutzung(z, 'T3', 'N3', ctx.bei(31)));
  z = B.pruefeAblauf(z, ctx.bei(900)).zustand;
  const [kopf, ...zeilen] = X.blockDatei(z, SCHEMA).inhalt.slice(1).split('\r\n').filter(Boolean).map((l) => l.split(';'));
  const sp = (n) => kopf.indexOf(n);
  assert.deepEqual(zeilen.map((w) => [w[sp('taetigkeit')], w[sp('neben_T3')], w[sp('neben_T3_nutzung')], w[sp('dauer_sek')]]),
    [['T5', '0', '', '30'], ['T5', '1', 'N3', '870']]);
});
