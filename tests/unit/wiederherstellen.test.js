// Wiederherstellen aus mehreren Dateien (PLAN_Logbuch_Datensicherheit 4.5, 4.6; Verifikation L2: ohne Logbuch-Datei,
// zwei Logbuch-Dateien, falsche Prüfsumme, widerrufener Code).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { erkenneDatei, planeWiederherstellung } from '../../js/wiederherstellen.js';
import { logbuchDatei } from '../../js/logbuchdatei.js';
import { erstelleSicherung, sicherungsDatei } from '../../js/sicherung.js';
import { versuchDatei, tagDatei } from '../../js/export.js';
import { fbDatei } from '../../js/fb/export.js';
import { bogen } from '../../js/fb/definition.js';
import { FRAGEBOGEN_DEFINITION as DEF } from '../../js/frageboegen.js';
import { SCHEMA, START } from './hilfen.js';

process.env.TZ = 'Europe/Berlin';

const BLOCK = readFileSync(new URL('./referenz/HXNOW_BEOB_P017_20261203_0915_id-0001.csv', import.meta.url), 'utf8');
const versuch = versuchDatei({ versuchId: 'v-0001', geraeteId: 'g1', pseudonym: 'P020', beobachter: 'B1', bereich: 'NEPH', dienst: 'F', phase: 'PRE', ts: START }, SCHEMA);
const fb = fbDatei(bogen(DEF, 'FB1'), {
  sitzungId: 's-0001', geraeteId: 'g1', appVersion: '0.9.0', bogen: 'FB1', pseudonym: 'P021', bereich: 'NEPH', erhebungsmodus: 'APP', startTs: START, endTs: START + 600_000,
}, { A1: { wert: 2 } }, { definitionVersion: '0.1.0' });
const kopf = (now, geraeteId = 'g1aaaaaa') => ({ geraeteId, appVersion: '0.9.0', dbVersion: 3, definitionVersion: '0.1.0', schemaVersion: '2', now, test: false });
const t = (p, status = 'aktiv') => ({ pseudonym: p, bereich: 'NEPH', status, statusTs: START, registriertTs: START, notiz: '', phasenAbweichung: null });
const e = (id, p, extra = {}) => ({ eintragId: id, art: 'BLOCK', pseudonym: p, phase: 'PRE', bereich: 'NEPH', dienst: 'F', arbeitskontext: 'K1', startTs: START, endTs: START + 1, beobachtetSek: 900, pausenAnzahl: 0, pausenSek: 0, status: 'beendet', endeArt: 'regulaer', abbruchCode: null, erhebungsmodus: '', exportStatus: 'offen', geraeteId: 'g1', testmodus: false, ...extra });

describe('Datei am Inhalt erkennen', () => {
  test('Block, Versuch, Fragebogen, Tageskennzahlen, Logbuch, Komplettsicherung, Fremdes', () => {
    const b = erkenneDatei('egal.csv', BLOCK);
    assert.equal(b.typ, 'block');
    assert.deepEqual([b.eintrag.eintragId, b.eintrag.pseudonym, b.eintrag.phase, b.eintrag.beobachtetSek, b.eintrag.status], ['id-0001', 'P017', 'POST', 900, 'beendet']);
    assert.equal(erkenneDatei(versuch.dateiname, versuch.inhalt).eintrag.status, 'nicht_angetroffen');
    const f = erkenneDatei(fb.dateiname, fb.inhalt);
    assert.deepEqual([f.typ, f.eintrag.art, f.eintrag.phase, f.eintrag.beantwortet, f.eintrag.beobachtetSek], ['fb', 'FB1', 'PRE', 1, 600]);
    const tag = tagDatei({ datum: '2026-12-03', bereich: 'NEPH', auslastung: 3, aerzteAnwesend: 4, beobachter: 'B1', ts: START });
    assert.equal(erkenneDatei(tag.dateiname, tag.inhalt).satz.aerzteAnwesend, 4);
    const lb = logbuchDatei({ teilnehmende: [t('P017')], phasenplan: [], logbuch: [], aenderungen: [] }, kopf(START));
    assert.equal(erkenneDatei('x.csv', lb.inhalt).typ, 'logbuch');
    const k = sicherungsDatei(erstelleSicherung({ daten: {}, geraeteId: 'g1', appVersion: '1', schemaVersion: '2', now: START }));
    assert.equal(erkenneDatei(k.dateiname, k.inhalt).typ, 'komplett');
    assert.equal(erkenneDatei('a.txt', 'hallo;welt\r\n1;2').typ, 'unbekannt');
    assert.match(erkenneDatei('b.csv', BLOCK.split('\r\n').slice(0, 3).join('\r\n')).fehler[0], /unvollständig/);
  });
});

describe('Wiederherstellung planen', () => {
  test('ohne Logbuch-Datei: Einträge und Teilnehmende aus den Sitzungsdateien, Eingang bestätigt', () => {
    const { stores, bericht } = planeWiederherstellung([erkenneDatei('b', BLOCK), erkenneDatei('v', versuch.inhalt), erkenneDatei('f', fb.inhalt)]);
    assert.equal(stores.logbuch.length, 3);
    assert.ok(stores.logbuch.every((l) => l.exportStatus === 'bestaetigt' && l.wiederhergestellt));
    assert.deepEqual(stores.teilnehmende.map((x) => x.pseudonym).sort(), ['P017', 'P020', 'P021']);
    assert.equal(bericht.ohneLogbuch, true);
    assert.equal(bericht.aufgebaut, 3);
    assert.equal(stores.bloecke.length, 0, 'Rohdaten nur aus Komplettsicherungen');
  });

  test('zwei Logbuch-Dateien: die jüngere gewinnt bei gleicher ID, Einträge beider Geräte bleiben', () => {
    const alt = logbuchDatei({ teilnehmende: [t('P017')], phasenplan: [{ bereich: 'NEPH', baselineStart: '2026-11-23' }], logbuch: [e('id-0001', 'P017'), e('x', 'P017')], aenderungen: [] }, kopf(START));
    const neu = logbuchDatei({ teilnehmende: [{ ...t('P017'), notiz: 'neu' }], phasenplan: [], logbuch: [e('id-0001', 'P017', { exportStatus: 'exportiert' })], aenderungen: [] }, kopf(START + 1000, 'g2bbbbbb'));
    const { stores, bericht } = planeWiederherstellung([erkenneDatei('neu', neu.inhalt), erkenneDatei('alt', alt.inhalt)]);
    assert.equal(stores.teilnehmende[0].notiz, 'neu');
    assert.equal(stores.logbuch.find((l) => l.eintragId === 'id-0001').exportStatus, 'exportiert');
    assert.equal(stores.logbuch.length, 2);
    assert.equal(stores.phasenplan.length, 1);
    assert.equal(bericht.neuestesLogbuch.name, 'neu');
    assert.deepEqual(bericht.geraete.sort(), ['g1aaaaaa', 'g2bbbbbb']);
    assert.equal(bericht.offeneSitzungen, 2);
    // Sitzungsdatei dazu: Eintrag gilt als bestätigt, wird nicht neu aufgebaut
    const mit = planeWiederherstellung([erkenneDatei('neu', neu.inhalt), erkenneDatei('b', BLOCK)]);
    assert.equal(mit.stores.logbuch[0].exportStatus, 'bestaetigt');
    assert.equal(mit.bericht.aufgebaut, 0);
  });

  test('falsche Prüfsumme: Datei abgelehnt mit Grund', () => {
    const lb = logbuchDatei({ teilnehmende: [t('P017')], phasenplan: [], logbuch: [], aenderungen: [] }, kopf(START));
    const k = sicherungsDatei(erstelleSicherung({ daten: { bloecke: [{ blockId: 'b1', pseudonym: 'P017' }] }, geraeteId: 'g1', appVersion: '1', schemaVersion: '2', now: START }));
    const { bericht, stores } = planeWiederherstellung([erkenneDatei('l.csv', lb.inhalt.replace('NEPH', 'ZNA')), erkenneDatei('k.json', k.inhalt.replace('"b1"', '"b2"'))]);
    assert.equal(bericht.abgelehnt.length, 2);
    assert.match(bericht.abgelehnt[0].grund, /Prüfsumme/);
    assert.match(bericht.abgelehnt[1].grund, /Prüfsumme/);
    assert.equal(stores.teilnehmende.length, 0);
  });

  test('widerrufener Code: alle Daten abgewiesen, Zeile der Teilnehmerliste bleibt', () => {
    const daten = {
      bloecke: [{ blockId: 'b1', pseudonym: 'P017' }, { blockId: 'b2', pseudonym: 'P018' }],
      episoden: [{ episodeId: 'e1', blockId: 'b1' }, { episodeId: 'e2', blockId: 'b2' }],
      fb_sitzungen: [{ sitzungId: 's1', pseudonym: 'P017' }], fb_antworten: [{ sitzungId: 's1', itemId: 'A1' }],
      teilnehmende: [t('P017'), t('P018')], logbuch: [e('b1', 'P017'), e('b2', 'P018')],
    };
    const k = sicherungsDatei(erstelleSicherung({ daten, geraeteId: 'g1', appVersion: '1', schemaVersion: '2', now: START }));
    const { stores, bericht } = planeWiederherstellung([erkenneDatei('k', k.inhalt), erkenneDatei('b', BLOCK)], { vorhandeneTeilnehmende: [t('P017', 'widerrufen')] });
    assert.deepEqual(stores.bloecke.map((b) => b.blockId), ['b2']);
    assert.deepEqual(stores.episoden.map((x) => x.episodeId), ['e2']);
    assert.equal(stores.fb_sitzungen.length + stores.fb_antworten.length, 0);
    assert.deepEqual(stores.logbuch.map((l) => l.eintragId), ['b2']);
    assert.deepEqual(bericht.widerrufen.codes, ['P017']);
    assert.ok(stores.teilnehmende.some((x) => x.pseudonym === 'P017'));
  });
});
