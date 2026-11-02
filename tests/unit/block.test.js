import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../../js/block.js';
import { SCHEMA, START, testKontext, ANGABEN_POST, ANGABEN_PRE } from './hilfen.js';

// Block anlegen, optional erste Episode (T, O) setzen
function neuerBlock(ctx, angaben = ANGABEN_POST, erste = ['T1', 'O1']) {
  const r = B.erzeugeBlock(angaben, ctx);
  assert.ok(r.ok, r.fehler);
  let z = r.zustand;
  if (erste) {
    z = ok(B.tippeOrt(z, erste[1], ctx)).zustand;
    z = ok(B.tippeTaetigkeit(z, erste[0], ctx)).zustand;
  }
  return z;
}

function ok(r) {
  assert.ok(r.ok, `Aktion abgelehnt: ${r.code} – ${r.fehler}`);
  return r;
}

function abgelehnt(r, code) {
  assert.equal(r.ok, false, 'Aktion hätte abgelehnt werden müssen');
  assert.equal(r.code, code, r.fehler);
  return r;
}

const aktuell = (z) => B.aktuelleEpisode(z);
const aktive = (z) => B.aktiveEpisoden(z);
const ohneN = { ...SCHEMA, nutzungsartBeiT1T2: false };

/** Pausieren und mit Grund/T/O fortsetzen. */
function pause(z, ctx, vonSek, bisSek, fort = { grund: 'P3' }) {
  ctx.bei(vonSek);
  z = ok(B.pausiere(z, ctx)).zustand;
  ctx.bei(bisSek);
  const vorher = aktuell(z);
  return ok(B.setzeFort(z, { taetigkeit: vorher.taetigkeit, ort: vorher.ort, ...fort }, ctx)).zustand;
}

describe('Block anlegen', () => {
  test('gültige Angaben → laufender Block, Start = jetzt, Kontext und Gerät-Felder', () => {
    const ctx = testKontext().bei(0);
    const r = ok(B.erzeugeBlock(ANGABEN_POST, ctx));
    const b = r.zustand.block;
    assert.deepEqual(
      [b.status, b.startTs, b.endTs, b.schemaVersion, b.arbeitskontext, b.blockDauerSek, b.hxGeraetMarkiertTs, b.hxGeraetAutomatisch, b.hxGeraetDabei],
      ['laufend', START, null, '0.2', 'K1', 900, null, false, null],
    );
    assert.deepEqual(r.schreiben.block, b);
    assert.deepEqual(r.zustand.pausen, []);
  });

  test('ungültige Angaben werden je Feld gemeldet; leere optionale Felder nicht', () => {
    const r = B.erzeugeBlock({ pseudonym: 'Müller', beobachter: 'B9', bereich: 'X', dienst: '', phase: 'MITTE', arbeitskontext: 'K9' }, testKontext());
    abgelehnt(r, 'ANGABEN_UNGUELTIG');
    assert.deepEqual(Object.keys(r.felder).sort(), ['arbeitskontext', 'beobachter', 'bereich', 'phase', 'pseudonym']);
  });

  test('Standard-Pflicht: Studien-Code, Phase, Bereich, Beobachter; Dienst und Kontext optional (null)', () => {
    const nurPflicht = { pseudonym: 'P017', phase: 'POST', bereich: 'ZNA', beobachter: 'B1' };
    const b = ok(B.erzeugeBlock(nurPflicht, testKontext())).zustand.block;
    assert.deepEqual([b.dienst, b.arbeitskontext], [null, null]);
    const f = B.pruefeBlockAngaben(SCHEMA, { pseudonym: 'P017' });
    assert.deepEqual(Object.keys(f).sort(), ['beobachter', 'bereich', 'phase']);
  });

  test('Pflichtangaben sind im Kodierschema einstellbar; Studien-Code und Phase immer Pflicht', () => {
    const streng = { ...SCHEMA, pflichtangaben: { ...SCHEMA.pflichtangaben, block: ['arbeitskontext', 'dienst'] } };
    const f = B.pruefeBlockAngaben(streng, {});
    assert.deepEqual(Object.keys(f).sort(), ['arbeitskontext', 'dienst', 'phase', 'pseudonym']);
    const locker = { ...SCHEMA, pflichtangaben: { block: [] } };
    assert.deepEqual(Object.keys(B.pruefeBlockAngaben(locker, {})).sort(), ['phase', 'pseudonym']);
    assert.equal(B.istPflicht(SCHEMA, 'block', 'dienst'), false);
    assert.equal(B.istPflicht(SCHEMA, 'versuch', 'phase'), true);
  });

  test('fehlende optionale Angaben nachtragen, gesetzte nicht überschreiben', () => {
    const ctx = testKontext();
    let z = ok(B.erzeugeBlock({ pseudonym: 'P017', phase: 'PRE', bereich: 'NEPH', beobachter: 'B1' }, ctx)).zustand;
    z = ok(B.ergaenzeBlockAngabe(z, 'arbeitskontext', 'K4', ctx)).zustand;
    assert.equal(z.block.arbeitskontext, 'K4');
    abgelehnt(B.ergaenzeBlockAngabe(z, 'arbeitskontext', 'K5', ctx), 'BEREITS_GESETZT');
    abgelehnt(B.ergaenzeBlockAngabe(z, 'dienst', 'X', ctx), 'CODE_UNBEKANNT');
    abgelehnt(B.ergaenzeBlockAngabe(z, 'phase', 'POST', ctx), 'NICHT_ERGAENZBAR');
    assert.equal(ok(B.ergaenzeBlockAngabe(z, 'dienst', 'S', ctx)).schreiben.block.dienst, 'S');
  });

  test('Studien-Code wird gegen das Muster geprüft', () => {
    const f = (p) => B.pruefeBlockAngaben(SCHEMA, { ...ANGABEN_POST, pseudonym: p }).pseudonym;
    assert.equal(f('P017'), undefined);
    assert.equal(f(' P017 '), undefined);
    assert.ok(f('P17'));
    assert.ok(f('p017'));
  });
});

describe('Erste Episode', () => {
  test('entsteht erst, wenn T und O gewählt sind; Start = Blockstart', () => {
    const ctx = testKontext().bei(0);
    let z = ok(B.erzeugeBlock(ANGABEN_POST, ctx)).zustand;
    ctx.bei(4);
    let r = ok(B.tippeOrt(z, 'O3', ctx));
    assert.equal(r.neueEpisode, false);
    z = r.zustand;
    ctx.bei(9);
    r = ok(B.tippeTaetigkeit(z, 'T5', ctx));
    const e = aktuell(r.zustand);
    assert.deepEqual([e.nr, e.startTs, e.taetigkeit, e.ort], [1, START, 'T5', 'O3']);
  });
});

describe('Episodenwechsel', () => {
  test('neue T → neue Episode, Ort übernommen; neuer O → Tätigkeit übernommen', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx, ANGABEN_POST, ['T5', 'O3']);
    ctx.bei(30); z = ok(B.tippeTaetigkeit(z, 'T6', ctx)).zustand;
    ctx.bei(45); z = ok(B.tippeOrt(z, 'O2', ctx)).zustand;
    assert.deepEqual(aktive(z).map((e) => [e.nr, e.taetigkeit, e.ort, e.startTs - START]),
      [[1, 'T5', 'O3', 0], [2, 'T6', 'O3', 30_000], [3, 'T6', 'O2', 45_000]]);
  });

  test('Tipp auf bereits aktive Taste bewirkt nichts', () => {
    const ctx = testKontext();
    const z = neuerBlock(ctx);
    for (const r of [B.tippeTaetigkeit(z, 'T1', ctx.bei(10)), B.tippeOrt(z, 'O1', ctx)]) {
      assert.equal(ok(r).unveraendert, true);
      assert.equal(r.zustand, z);
    }
  });

  test('frühere Codes T11 und O9 gibt es nicht mehr', () => {
    const ctx = testKontext();
    const z = neuerBlock(ctx);
    abgelehnt(B.tippeTaetigkeit(z, 'T11', ctx), 'CODE_UNBEKANNT');
    abgelehnt(B.tippeOrt(z, 'O9', ctx), 'CODE_UNBEKANNT');
  });

  test('Zustand wird nicht verändert (reine Funktionen)', () => {
    const ctx = testKontext();
    const z = neuerBlock(ctx);
    const kopie = structuredClone(z);
    ctx.bei(5);
    B.tippeTaetigkeit(z, 'T2', ctx);
    B.pausiere(z, ctx);
    B.brecheAb(z, 'A1', '', ctx);
    assert.deepEqual(z, kopie);
  });

  test('Uhr läuft rückwärts → keine Überlappung', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    ctx.bei(100); z = ok(B.tippeTaetigkeit(z, 'T2', ctx)).zustand;
    ctx.bei(40); z = ok(B.tippeTaetigkeit(z, 'T5', ctx)).zustand;
    assert.equal(aktuell(z).startTs, START + 100_000);
  });
});

describe('T3 (HX Now) nur in der Post-Phase', () => {
  test('in Prä abgelehnt, in Post erlaubt', () => {
    const ctx = testKontext();
    const pre = neuerBlock(ctx, ANGABEN_PRE);
    abgelehnt(B.tippeTaetigkeit(pre, 'T3', ctx.bei(10)), 'NUR_PHASE');
    assert.equal(B.taetigkeitErlaubt(pre, SCHEMA, 'T3'), false);
    ok(B.tippeTaetigkeit(neuerBlock(ctx), 'T3', ctx));
  });
});

describe('Nutzungsart und Haltung', () => {
  function mitT3(ctx) {
    const z = neuerBlock(ctx, ANGABEN_POST, ['T5', 'O2']);
    return ok(B.tippeTaetigkeit(z, 'T3', ctx.bei(20))).zustand;
  }

  test('T3: N und H Pflicht – startet unvollständig mit N9 / null', () => {
    const e = aktuell(mitT3(testKontext()));
    assert.deepEqual([e.nutzungsart, e.haltung, e.unvollstaendig, e.offeneZusaetze], ['N9', null, true, ['nutzungsart', 'haltung']]);
  });

  test('erstes Setzen ergänzt die Episode, späterer Wechsel erzeugt neue Episode', () => {
    const ctx = testKontext();
    let z = mitT3(ctx);
    const id = aktuell(z).episodeId;
    let r = ok(B.tippeNutzungsart(z, 'N2', ctx.bei(22)));
    assert.equal(r.neueEpisode, false);
    r = ok(B.tippeHaltung(r.zustand, 'H1', ctx.bei(23)));
    assert.equal(r.neueEpisode, false);
    assert.deepEqual([aktuell(r.zustand).episodeId, aktuell(r.zustand).unvollstaendig], [id, false]);
    r = ok(B.tippeNutzungsart(r.zustand, 'N3', ctx.bei(40)));
    assert.equal(r.neueEpisode, true);
    assert.deepEqual([aktuell(r.zustand).nutzungsart, aktuell(r.zustand).haltung], ['N3', 'H1']);
    r = ok(B.tippeHaltung(r.zustand, 'H4', ctx.bei(50)));
    assert.equal(r.neueEpisode, true);
    assert.equal(ok(B.tippeHaltung(r.zustand, 'H4', ctx.bei(51))).unveraendert, true);
  });

  test('N4 (Foto/Scan) nur bei T3 – Filter nach giltFuer', () => {
    const ctx = testKontext();
    const z = neuerBlock(ctx, ANGABEN_POST, ['T1', 'O1']);
    abgelehnt(B.tippeNutzungsart(z, 'N4', ctx), 'NICHT_ZULAESSIG');
    assert.deepEqual(B.nutzungsartenFuer(SCHEMA, 'T1').map((n) => n.code), ['N1', 'N2', 'N3', 'N9']);
    assert.deepEqual(B.nutzungsartenFuer(SCHEMA, 'T3').map((n) => n.code), ['N1', 'N2', 'N3', 'N4', 'N9']);
    ok(B.tippeNutzungsart(mitT3(ctx), 'N4', ctx));
  });

  test('T1/T2 mit nutzungsartBeiT1T2 = true: N wählbar, aber optional (nicht unvollständig)', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx, ANGABEN_POST, ['T1', 'O1']);
    let e = aktuell(z);
    assert.deepEqual([e.nutzungsart, e.haltung, e.unvollstaendig, e.offeneZusaetze], [null, null, false, ['nutzungsart']]);
    z = ok(B.tippeNutzungsart(z, 'N2', ctx.bei(5))).zustand;
    assert.equal(aktive(z).length, 1, 'erstes Setzen ohne neue Episode');
    z = ok(B.tippeNutzungsart(z, 'N1', ctx.bei(10))).zustand;
    assert.equal(aktive(z).length, 2, 'Wechsel → neue Episode');
    abgelehnt(B.tippeHaltung(z, 'H1', ctx), 'ZUSATZ_UNZULAESSIG');
  });

  test('T1/T2 mit nutzungsartBeiT1T2 = false: keine Nutzungsart', () => {
    const ctx = { ...testKontext(), schema: ohneN };
    ctx.bei = (s) => { ctx.zeitMs = s * 1000; return ctx; };
    const z = neuerBlock(ctx, ANGABEN_POST, ['T2', 'O3']);
    assert.deepEqual(aktuell(z).offeneZusaetze, []);
    abgelehnt(B.tippeNutzungsart(z, 'N1', ctx), 'ZUSATZ_UNZULAESSIG');
    assert.deepEqual(B.zusatzFelder(ohneN, 'T3'), ['nutzungsart', 'haltung'], 'T3 bleibt Pflicht');
  });

  test('Wechsel zwischen Geräten setzt die Nutzungsart zurück; Ortswechsel übernimmt sie', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx, ANGABEN_POST, ['T1', 'O1']);
    z = ok(B.tippeNutzungsart(z, 'N2', ctx)).zustand;
    z = ok(B.tippeOrt(z, 'O3', ctx.bei(10))).zustand;
    assert.equal(aktuell(z).nutzungsart, 'N2');
    z = ok(B.tippeTaetigkeit(z, 'T2', ctx.bei(20))).zustand;
    assert.deepEqual([aktuell(z).nutzungsart, aktuell(z).offeneZusaetze], [null, ['nutzungsart']]);
    z = ok(B.tippeTaetigkeit(z, 'T5', ctx.bei(30))).zustand;
    assert.deepEqual([aktuell(z).nutzungsart, aktuell(z).offeneZusaetze], [null, []]);
  });

  test('Ortswechsel während T3 übernimmt N und H (auch offene)', () => {
    const ctx = testKontext();
    let z = mitT3(ctx);
    z = ok(B.tippeNutzungsart(z, 'N4', ctx)).zustand;
    const e = aktuell(ok(B.tippeOrt(z, 'O3', ctx.bei(35))).zustand);
    assert.deepEqual([e.taetigkeit, e.ort, e.nutzungsart, e.haltung, e.unvollstaendig, e.offeneZusaetze], ['T3', 'O3', 'N4', null, true, ['haltung']]);
  });

  test('Haltung ohne T3 und Nutzungsart bei T4–T10 abgelehnt', () => {
    const ctx = testKontext();
    const z = neuerBlock(ctx, ANGABEN_POST, ['T5', 'O1']);
    abgelehnt(B.tippeNutzungsart(z, 'N1', ctx), 'ZUSATZ_UNZULAESSIG');
    abgelehnt(B.tippeHaltung(z, 'H1', ctx), 'ZUSATZ_UNZULAESSIG');
  });
});

describe('Pause', () => {
  test('Pause beendet die Episode und stoppt die beobachtete Zeit', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    ctx.bei(100);
    const r = ok(B.pausiere(z, ctx));
    z = r.zustand;
    assert.equal(z.block.status, 'pausiert');
    assert.equal(r.schreiben.pausen[0].startTs, START + 100_000);
    assert.equal(B.beobachtetMs(z, START + 100_000), 100_000);
    assert.equal(B.beobachtetMs(z, START + 400_000), 100_000, 'steht während der Pause still');
    assert.equal(B.restzeitMs(z, SCHEMA, START + 400_000), 800_000);
    assert.equal(B.regulaeresEnde(z, SCHEMA), null);
    const eps = B.berechneEpisoden(z, START + 400_000);
    assert.deepEqual([eps[0].endeTs, eps[0].laufend], [START + 100_000, false]);
  });

  test('während einer Pause keine Kodiereingaben; Pause vor der ersten Episode nicht möglich', () => {
    const ctx = testKontext();
    let z = ok(B.pausiere(neuerBlock(ctx), ctx.bei(10))).zustand;
    abgelehnt(B.tippeTaetigkeit(z, 'T2', ctx), 'PAUSIERT');
    abgelehnt(B.tippeOrt(z, 'O2', ctx), 'PAUSIERT');
    abgelehnt(B.rueckgaengig(z, ctx), 'PAUSIERT');
    abgelehnt(B.pausiere(z, ctx), 'PAUSIERT');
    const leer = ok(B.erzeugeBlock(ANGABEN_POST, ctx)).zustand;
    abgelehnt(B.pausiere(leer, ctx), 'KEINE_EPISODE');
  });

  test('Fortsetzen mit einem Tipp: gleiche Tätigkeit, Ort, N und H wie vor der Pause; Grund optional', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx, ANGABEN_POST, ['T5', 'O2']);
    ctx.bei(20); z = ok(B.tippeTaetigkeit(z, 'T3', ctx)).zustand;
    z = ok(B.tippeNutzungsart(z, 'N2', ctx)).zustand;
    z = ok(B.pausiere(z, ctx.bei(40))).zustand;
    const r = ok(B.setzeFort(z, {}, ctx.bei(70)));
    const e = aktuell(r.zustand);
    assert.deepEqual([e.nr, e.taetigkeit, e.ort, e.nutzungsart, e.haltung, e.offeneZusaetze, e.startTs - START],
      [3, 'T3', 'O2', 'N2', null, ['haltung'], 70_000]);
    assert.deepEqual([r.schreiben.pausen[0].grund, r.schreiben.pausen[0].freitext], [null, '']);
    abgelehnt(B.setzeFort(neuerBlock(ctx), {}, ctx), 'NICHT_PAUSIERT');
  });

  test('Pausengrund und Notiz während der Pause setzen (optional), beim Fortsetzen übernommen', () => {
    const ctx = testKontext();
    let z = ok(B.pausiere(neuerBlock(ctx), ctx.bei(10))).zustand;
    abgelehnt(B.setzePauseAngaben(z, { grund: 'P9' }, ctx), 'CODE_UNBEKANNT');
    z = ok(B.setzePauseAngaben(z, { grund: 'P5' }, ctx)).zustand;
    z = ok(B.setzePauseAngaben(z, { freitext: ' Feueralarm ' }, ctx)).zustand;
    assert.deepEqual([B.laufendePause(z).grund, B.laufendePause(z).freitext], ['P5', 'Feueralarm']);
    const p = ok(B.setzeFort(z, {}, ctx.bei(30))).schreiben.pausen[0];
    assert.deepEqual([p.grund, p.freitext, p.endTs - START], ['P5', 'Feueralarm', 30_000]);
    abgelehnt(B.setzePauseAngaben(neuerBlock(ctx), { grund: 'P1' }, ctx), 'NICHT_PAUSIERT');
  });

  test('Pausengrund Pflicht, wenn im Kodierschema eingestellt; Freitext-Pflicht je Grund', () => {
    const streng = {
      ...SCHEMA,
      pflichtangaben: { ...SCHEMA.pflichtangaben, pauseGrund: true },
      pausengruende: SCHEMA.pausengruende.map((p) => (p.code === 'P5' ? { ...p, freitextPflicht: true } : p)),
    };
    const ctx = { ...testKontext(), schema: streng };
    ctx.bei = (sek) => { ctx.zeitMs = sek * 1000; return ctx; };
    const z = ok(B.pausiere(neuerBlock(ctx), ctx.bei(10))).zustand;
    abgelehnt(B.setzeFort(z, {}, ctx), 'GRUND_FEHLT');
    abgelehnt(B.setzeFort(z, { grund: 'P5' }, ctx), 'FREITEXT_PFLICHT');
    ok(B.setzeFort(z, { grund: 'P5', freitext: 'Alarm' }, ctx));
    ok(B.setzeFort(z, { grund: 'P2' }, ctx));
  });

  test('Fortsetzen mit abweichender Tätigkeit/Ort möglich; ungültige Codes abgelehnt', () => {
    const ctx = testKontext();
    const z = ok(B.pausiere(neuerBlock(ctx), ctx.bei(10))).zustand;
    abgelehnt(B.setzeFort(z, { grund: 'P9' }, ctx), 'CODE_UNBEKANNT');
    abgelehnt(B.setzeFort(z, { ort: 'O9' }, ctx), 'CODE_UNBEKANNT');
    const e = aktuell(ok(B.setzeFort(z, { taetigkeit: 'T6', ort: 'O3' }, ctx)).zustand);
    assert.deepEqual([e.taetigkeit, e.ort], ['T6', 'O3']);
  });

  test('Fortsetzen: Pause mit Grund geschlossen, neue Episode mit T/O; N/H übernommen bei gleicher Tätigkeit', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx, ANGABEN_POST, ['T5', 'O2']);
    ctx.bei(20); z = ok(B.tippeTaetigkeit(z, 'T3', ctx)).zustand;
    z = ok(B.tippeNutzungsart(z, 'N1', ctx)).zustand;
    z = ok(B.tippeHaltung(z, 'H2', ctx)).zustand;
    ctx.bei(60); z = ok(B.pausiere(z, ctx)).zustand;
    ctx.bei(134);
    const r = ok(B.setzeFort(z, { grund: 'P1', taetigkeit: 'T3', ort: 'O3' }, ctx));
    assert.deepEqual(r.schreiben.pausen[0], { ...r.schreiben.pausen[0], endTs: START + 134_000, grund: 'P1', freitext: '' });
    const e = aktuell(r.zustand);
    assert.deepEqual([e.nr, e.startTs - START, e.taetigkeit, e.ort, e.nutzungsart, e.haltung, e.unvollstaendig], [3, 134_000, 'T3', 'O3', 'N1', 'H2', false]);
    assert.equal(r.zustand.block.status, 'laufend');
    // andere Tätigkeit nach der Pause → Zusatz neu
    let z2 = ok(B.pausiere(r.zustand, ctx.bei(150))).zustand;
    z2 = ok(B.setzeFort(z2, { grund: 'P2', taetigkeit: 'T1', ort: 'O1' }, ctx.bei(160))).zustand;
    assert.deepEqual([aktuell(z2).nutzungsart, aktuell(z2).offeneZusaetze], [null, ['nutzungsart']]);
  });

  test('T3 nach der Pause in Prä abgelehnt', () => {
    const ctx = testKontext();
    const z = ok(B.pausiere(neuerBlock(ctx, ANGABEN_PRE), ctx.bei(10))).zustand;
    abgelehnt(B.setzeFort(z, { grund: 'P1', taetigkeit: 'T3', ort: 'O1' }, ctx), 'NUR_PHASE');
  });

  test('Pause länger als pauseMaxSek → Hinweis, aber kein automatischer Abbruch', () => {
    const ctx = testKontext();
    const z = ok(B.pausiere(neuerBlock(ctx), ctx.bei(10))).zustand;
    assert.equal(B.pauseZuLang(z, SCHEMA, START + 310_000), false);
    assert.equal(B.pauseZuLang(z, SCHEMA, START + 310_001), true);
    assert.equal(ok(B.pruefeAblauf(z, ctx.bei(5000))).beendet, false);
    assert.equal(z.block.status, 'pausiert');
  });

  test('Rückgängig nicht über eine Pause hinweg', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    ctx.bei(10); z = ok(B.tippeTaetigkeit(z, 'T2', ctx)).zustand;
    z = pause(z, ctx, 20, 50);
    abgelehnt(B.rueckgaengig(z, ctx), 'UEBER_PAUSE');
    ctx.bei(60); z = ok(B.tippeTaetigkeit(z, 'T5', ctx)).zustand;
    z = ok(B.rueckgaengig(z, ctx)).zustand;
    assert.equal(aktuell(z).taetigkeit, 'T2');
    abgelehnt(B.rueckgaengig(z, ctx), 'UEBER_PAUSE');
  });

  test('Abbruch während der Pause beendet die Pause mit (Grund leer)', () => {
    const ctx = testKontext();
    const z = ok(B.pausiere(neuerBlock(ctx), ctx.bei(100))).zustand;
    const r = ok(B.brecheAb(z, 'A3', '', ctx.bei(450)));
    assert.deepEqual([r.zustand.block.status, r.zustand.block.endTs - START], ['abgebrochen', 450_000]);
    assert.deepEqual([r.schreiben.pausen[0].endTs - START, r.schreiben.pausen[0].grund], [450_000, null]);
    assert.equal(B.beobachtetMs(r.zustand), 100_000);
  });

  test('Beenden während der Pause schließt die Pause ebenfalls', () => {
    const ctx = testKontext();
    const z = ok(B.pausiere(neuerBlock(ctx), ctx.bei(100))).zustand;
    const r = ok(B.beendeManuell(z, { behalten: true }, ctx.bei(130)));
    assert.equal(r.schreiben.pausen[0].endTs, START + 130_000);
  });
});

describe('Reguläres Blockende nach beobachteter Zeit', () => {
  test('ohne Pause nach 900 s, endTs = Start + 900 s', () => {
    const ctx = testKontext();
    const z = neuerBlock(ctx);
    assert.equal(ok(B.pruefeAblauf(z, ctx.bei(899.999))).beendet, false);
    const r = ok(B.pruefeAblauf(z, ctx.bei(900)));
    assert.deepEqual([r.schreiben.block.status, r.schreiben.block.endeArt, r.schreiben.block.endTs], ['beendet', 'regulaer', START + 900_000]);
  });

  test('mit mehreren Pausen: Ende bei 900 s beobachteter Zeit, auch bei verspätetem Aufruf', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    z = pause(z, ctx, 100, 174);   // 74 s
    z = pause(z, ctx, 400, 520);   // 120 s
    z = pause(z, ctx, 700, 706.5); // 6,5 s
    assert.equal(B.regulaeresEnde(z, SCHEMA), START + 900_000 + 200_500);
    assert.equal(ok(B.pruefeAblauf(z, ctx.bei(1100))).beendet, false);
    const r = ok(B.pruefeAblauf(z, ctx.bei(3 * 3600)));
    assert.equal(r.schreiben.block.endTs, START + 1_100_500);
    assert.equal(B.beobachtetMs(r.zustand), 900_000);
    assert.equal(B.pausenMs(r.zustand), 200_500);
  });

  test('Eingabe nach Ablauf wird nicht übernommen; alle Eingaben gesperrt', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    ctx.bei(500); z = ok(B.tippeTaetigkeit(z, 'T2', ctx)).zustand;
    ctx.bei(901);
    const r = abgelehnt(B.tippeTaetigkeit(z, 'T5', ctx), 'ABGELAUFEN');
    assert.equal(r.schreiben.block.endTs, START + 900_000);
    for (const x of [B.tippeOrt(z, 'O2', ctx), B.pausiere(z, ctx), B.rueckgaengig(z, ctx), B.brecheAb(z, 'A1', '', ctx), B.setzeEpisodenKommentar(z, 'x', ctx)]) {
      abgelehnt(x, 'ABGELAUFEN');
    }
    abgelehnt(B.tippeTaetigkeit(r.zustand, 'T5', ctx), 'NICHT_LAUFEND');
  });

  test('Restzeit und Warnphase (nicht während einer Pause)', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    assert.equal(B.restzeitMs(z, SCHEMA, START), 900_000);
    assert.equal(B.istWarnphase(z, SCHEMA, START + 840_000), true);
    z = ok(B.pausiere(z, ctx.bei(850))).zustand;
    assert.equal(B.restzeitMs(z, SCHEMA, START + 2_000_000), 50_000);
    assert.equal(B.istWarnphase(z, SCHEMA, START + 2_000_000), false);
  });

  test('wählbare Dauer 10 min (600 s) inkl. Pause', () => {
    const ctx = testKontext().bei(0);
    let z = neuerBlock(ctx, { ...ANGABEN_POST, blockDauerSek: 600 });
    z = pause(z, ctx, 100, 160);
    const r = ok(B.pruefeAblauf(z, ctx.bei(4000)));
    assert.equal(r.schreiben.block.endTs, START + 660_000);
    abgelehnt(B.erzeugeBlock({ ...ANGABEN_POST, blockDauerSek: 700 }, testKontext()), 'ANGABEN_UNGUELTIG');
  });

  test('ältere Blöcke ohne gespeicherte Dauer nutzen die Standarddauer', () => {
    const ctx = testKontext();
    const z = neuerBlock(ctx);
    const alt = B.stelleWiederHer({ ...z.block, blockDauerSek: undefined }, z.episoden, []);
    assert.equal(B.regulaeresEnde(alt, SCHEMA), START + 900_000);
  });
});

describe('HX-Now-Gerät dabei', () => {
  test('Schalter manuell setzen (Zeitpunkt), zurücknehmen, auch in der Pause', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    z = ok(B.setzeGeraetDabei(z, true, ctx.bei(42))).zustand;
    assert.equal(z.block.hxGeraetMarkiertTs, START + 42_000);
    assert.equal(ok(B.setzeGeraetDabei(z, true, ctx.bei(50))).unveraendert, true);
    z = ok(B.pausiere(z, ctx.bei(60))).zustand;
    z = ok(B.setzeGeraetDabei(z, false, ctx.bei(61))).zustand;
    assert.equal(z.block.hxGeraetMarkiertTs, null);
  });

  test('nur Post-Phase', () => {
    const ctx = testKontext();
    abgelehnt(B.setzeGeraetDabei(neuerBlock(ctx, ANGABEN_PRE), true, ctx), 'NUR_POST');
  });

  test('erste T3-Episode setzt den Schalter automatisch; dann nicht zurücknehmbar', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    const r = ok(B.tippeTaetigkeit(z, 'T3', ctx.bei(30)));
    assert.deepEqual([r.schreiben.block.hxGeraetAutomatisch, r.schreiben.block.hxGeraetMarkiertTs], [true, START + 30_000]);
    z = r.zustand;
    abgelehnt(B.setzeGeraetDabei(z, false, ctx), 'AUTOMATISCH');
    // zweite T3-Episode ändert nichts mehr am Block
    z = ok(B.tippeTaetigkeit(z, 'T1', ctx.bei(40))).zustand;
    assert.equal(ok(B.tippeTaetigkeit(z, 'T3', ctx.bei(50))).schreiben.block, null);
  });

  test('T3 als erste Episode setzt den Schalter ebenfalls', () => {
    const ctx = testKontext();
    const z = neuerBlock(ctx, ANGABEN_POST, ['T3', 'O1']);
    assert.equal(z.block.hxGeraetAutomatisch, true);
  });

  test('Rückgängig der einzigen T3-Episode nimmt „automatisch“ zurück, Markierung bleibt', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    z = ok(B.tippeTaetigkeit(z, 'T3', ctx.bei(30))).zustand;
    const r = ok(B.rueckgaengig(z, ctx.bei(31)));
    assert.deepEqual([r.schreiben.block.hxGeraetAutomatisch, r.schreiben.block.hxGeraetMarkiertTs], [false, START + 30_000]);
  });

  test('Abschlussfrage: Vorbelegung, „nein“ gesperrt bei automatisch, nur nach Blockende', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    assert.equal(B.geraetDabeiVorbelegung(z), null);
    abgelehnt(B.beantworteGeraetDabei(z, 'J', ctx), 'NOCH_OFFEN');
    z = ok(B.tippeTaetigkeit(z, 'T3', ctx.bei(30))).zustand;
    assert.equal(B.geraetDabeiVorbelegung(z), 'J');
    z = ok(B.pruefeAblauf(z, ctx.bei(900))).zustand;
    abgelehnt(B.beantworteGeraetDabei(z, 'N', ctx), 'NEIN_GESPERRT');
    abgelehnt(B.beantworteGeraetDabei(z, 'X', ctx), 'CODE_UNBEKANNT');
    assert.equal(ok(B.beantworteGeraetDabei(z, 'U', ctx)).schreiben.block.hxGeraetDabei, 'U');
    // ohne Markierung ist „nein“ möglich
    const z2 = ok(B.pruefeAblauf(neuerBlock(ctx), ctx.bei(2000))).zustand;
    assert.equal(ok(B.beantworteGeraetDabei(z2, 'N', ctx)).zustand.block.hxGeraetDabei, 'N');
    abgelehnt(B.beantworteGeraetDabei(ok(B.pruefeAblauf(neuerBlock(ctx, ANGABEN_PRE), ctx)).zustand, 'J', ctx), 'NUR_POST');
  });
});

describe('Rückgängig', () => {
  test('löscht die letzte Episode, die vorherige läuft weiter; nicht über die erste hinaus', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    ctx.bei(10); z = ok(B.tippeTaetigkeit(z, 'T2', ctx)).zustand;
    ctx.bei(20); z = ok(B.tippeOrt(z, 'O2', ctx)).zustand;
    const r = ok(B.rueckgaengig(z, ctx));
    assert.equal(r.schreiben.episoden[0].geloescht, true);
    assert.equal(r.zustand.episoden.length, 3, 'gelöschte Episode bleibt gespeichert');
    z = ok(B.rueckgaengig(r.zustand, ctx)).zustand;
    abgelehnt(B.rueckgaengig(z, ctx), 'ERSTE_EPISODE');
    ctx.bei(30); z = ok(B.tippeTaetigkeit(z, 'T4', ctx)).zustand;
    assert.deepEqual(aktive(z).map((e) => e.nr), [1, 2], 'Nummern lückenlos');
  });
});

describe('Abbruch und Beenden', () => {
  test('Abbruch: Grund Pflicht (Standard), Kommentar optional, endTs = jetzt', () => {
    const ctx = testKontext();
    const z = neuerBlock(ctx);
    ctx.bei(321.4);
    abgelehnt(B.brecheAb(z, null, '', ctx), 'GRUND_FEHLT');
    abgelehnt(B.brecheAb(z, 'A9', '', ctx), 'GRUND_FEHLT');
    assert.equal(ok(B.brecheAb(z, 'A4', '  ', ctx)).schreiben.block.kommentar, '');
    const b = ok(B.brecheAb(z, 'A4', 'Reanimation', ctx)).schreiben.block;
    assert.deepEqual([b.status, b.endeArt, b.abbruchCode, b.endTs, b.kommentar], ['abgebrochen', 'abbruch', 'A4', START + 321_400, 'Reanimation']);
  });

  test('Abbruch ohne Grund, wenn im Kodierschema abgeschaltet; Kommentar-Pflicht je Grund einstellbar', () => {
    const locker = {
      ...SCHEMA,
      pflichtangaben: { ...SCHEMA.pflichtangaben, abbruchGrund: false },
      abbruchgruende: SCHEMA.abbruchgruende.map((a) => (a.code === 'A4' ? { ...a, kommentarPflicht: true } : a)),
    };
    const ctx = { ...testKontext(), schema: locker };
    ctx.bei = (sek) => { ctx.zeitMs = sek * 1000; return ctx; };
    const z = neuerBlock(ctx);
    assert.equal(ok(B.brecheAb(z, null, '', ctx.bei(5))).schreiben.block.abbruchCode, null);
    abgelehnt(B.brecheAb(z, 'A4', '', ctx), 'KOMMENTAR_PFLICHT');
  });

  test('Block beenden: behalten → beendet, sonst verworfen', () => {
    const ctx = testKontext();
    assert.equal(ok(B.beendeManuell(neuerBlock(ctx), { behalten: true }, ctx.bei(60))).schreiben.block.status, 'beendet');
    assert.equal(ok(B.beendeManuell(neuerBlock(ctx), { behalten: false }, ctx.bei(60))).schreiben.block.status, 'verworfen');
  });
});

describe('Episodenenden, Dauern, Zeitleiste', () => {
  test('Ende = nächste Episode, Pausenbeginn oder Blockende', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    ctx.bei(10); z = ok(B.tippeTaetigkeit(z, 'T2', ctx)).zustand;
    z = pause(z, ctx, 47, 121, { grund: 'P4' });
    z = ok(B.pruefeAblauf(z, ctx.bei(2000))).zustand;
    const zl = B.zeitleiste(z);
    assert.deepEqual(zl.map((x) => [x.art, x.taetigkeit ?? x.grund, x.dauerSek]),
      [['episode', 'T1', 10], ['episode', 'T2', 37], ['pause', 'P4', 74], ['episode', 'T2', 853]]);
    assert.equal(z.block.endTs, START + 974_000);
  });

  test('Summe Episoden + Pausen = Wandzeit; Summe Episoden = beobachtete Zeit (zufällige Abläufe)', () => {
    for (let lauf = 0; lauf < 60; lauf++) {
      const ctx = testKontext();
      let z = neuerBlock(ctx);
      let t = 0;
      let zufall = lauf + 7;
      const rnd = () => ((zufall = (zufall * 16807) % 2147483647) / 2147483647);
      while (t < 1500) {
        t += 0.2 + rnd() * 40;
        ctx.zeitMs = Math.floor(t * 1000) + Math.floor(rnd() * 999);
        const w = rnd();
        let r;
        if (z.block.status === 'pausiert') r = B.setzeFort(z, { grund: 'P3', taetigkeit: `T${1 + Math.floor(rnd() * 10)}`, ort: 'O2' }, ctx);
        else if (w < 0.5) r = B.tippeTaetigkeit(z, `T${1 + Math.floor(rnd() * 10)}`, ctx);
        else if (w < 0.75) r = B.tippeOrt(z, `O${1 + Math.floor(rnd() * 8)}`, ctx);
        else if (w < 0.85) r = B.rueckgaengig(z, ctx);
        else r = B.pausiere(z, ctx);
        z = r.zustand;
        if (z.block.status === 'beendet') break;
      }
      const abbruch = lauf % 4 === 0;
      if (B.istOffen(z)) z = abbruch ? B.brecheAb(z, 'A3', '', ctx).zustand : B.beendeManuell(z, {}, ctx).zustand;
      const zl = B.zeitleiste(z);
      const wand = z.block.endTs - z.block.startTs;
      assert.equal(zl.reduce((s, x) => s + x.dauerMs, 0), wand, `Lauf ${lauf}: Wandzeit`);
      assert.ok(Math.abs(zl.reduce((s, x) => s + x.dauerSek, 0) - wand / 1000) <= 1);
      const eps = zl.filter((x) => x.art === 'episode');
      const ps = zl.filter((x) => x.art === 'pause');
      assert.equal(eps.reduce((s, e) => s + e.dauerMs, 0), B.beobachtetMs(z), `Lauf ${lauf}: beobachtet`);
      assert.equal(eps.reduce((s, e) => s + e.dauerSek, 0), Math.round(B.beobachtetMs(z) / 1000), `Lauf ${lauf}: Sekunden beobachtet`);
      assert.equal(ps.reduce((s, p) => s + p.dauerSek, 0), Math.round(B.pausenMs(z) / 1000), `Lauf ${lauf}: Sekunden Pausen`);
      zl.forEach((x, i) => { if (i > 0) assert.equal(x.startTs, zl[i - 1].endeTs, `Lauf ${lauf}: keine Lücken/Überlappungen`); });
      assert.equal(zl[0].startTs, z.block.startTs);
      if (z.block.endeArt === 'regulaer') assert.equal(B.beobachtetMs(z), 900_000);
    }
  });

  test('Zusammenfassung: Anteile auf Basis der beobachteten Zeit, Pausen gezählt', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    ctx.bei(300); z = ok(B.tippeTaetigkeit(z, 'T5', ctx)).zustand;
    z = pause(z, ctx, 450, 550, { grund: 'P1', taetigkeit: 'T5', ort: 'O1' });
    z = ok(B.pruefeAblauf(z, ctx.bei(2000))).zustand;
    const s = B.zusammenfassung(z, SCHEMA);
    assert.deepEqual([s.beobachtetMs, s.pausenAnzahl, s.pausenMs, s.anzahlEpisoden], [900_000, 1, 100_000, 3]);
    assert.deepEqual(s.anteile.map((a) => [a.code, Math.round(a.prozent * 100) / 100]), [['T1', 33.33], ['T5', 66.67]]);
  });

  test('unvollständige T3-Episode nach dem Ende ergänzen; optionale N bei T1 ebenfalls', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    ctx.bei(10); z = ok(B.tippeTaetigkeit(z, 'T3', ctx)).zustand;
    z = ok(B.tippeNutzungsart(z, 'N1', ctx)).zustand;
    z = ok(B.pruefeAblauf(z, ctx.bei(900))).zustand;
    const [e1, e2] = aktive(z);
    abgelehnt(B.ergaenzeEpisode(z, e2.episodeId, 'nutzungsart', 'N2', ctx), 'NICHT_OFFEN');
    const r = ok(B.ergaenzeEpisode(z, e2.episodeId, 'haltung', 'H2', ctx));
    assert.equal(r.schreiben.episoden[0].unvollstaendig, false);
    abgelehnt(B.ergaenzeEpisode(z, e1.episodeId, 'nutzungsart', 'N4', ctx), 'NICHT_ZULAESSIG');
    ok(B.ergaenzeEpisode(z, e1.episodeId, 'nutzungsart', 'N2', ctx));
  });
});

describe('Wiederherstellung', () => {
  test('stelleWiederHer mit laufender Pause ergibt denselben Zustand', () => {
    const ctx = testKontext();
    let z = neuerBlock(ctx);
    ctx.bei(10); z = ok(B.tippeTaetigkeit(z, 'T2', ctx)).zustand;
    z = ok(B.pausiere(z, ctx.bei(30))).zustand;
    const w = B.stelleWiederHer(structuredClone(z.block), [...z.episoden].reverse(), structuredClone(z.pausen));
    assert.deepEqual(B.zeitleiste(w, START + 90_000), B.zeitleiste(z, START + 90_000));
    assert.equal(B.restzeitMs(w, SCHEMA, START + 90_000), 870_000);
    assert.equal(B.laufendePause(w).pauseId, B.laufendePause(z).pauseId);
  });
});
