// Logbuch-Datei, CRC32, CSV-Lesen, Änderungen (wirksamer Stand) und Studienübersicht (PLAN_Logbuch_Datensicherheit 5, 6, 9).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { crc32 } from '../../js/crc32.js';
import { leseCsv } from '../../js/csvlesen.js';
import { logbuchDatei, leseLogbuchDatei, dateinameLogbuch, standText } from '../../js/logbuchdatei.js';
import { ART, neueAenderung, wirksamerStand } from '../../js/aenderungen.js';
import { phasendaten, phaseAm, probandenUebersicht, faelligListe, verteilung, bereichsStand } from '../../js/studienstand.js';

const T = (s) => Date.parse(s);
const kopf = { geraeteId: 'abcdef12-3456', appVersion: '0.9.0', dbVersion: 3, definitionVersion: '0.1.0', schemaVersion: '2.0.0', now: T('2026-12-03T10:00:00.456+01:00'), test: false };
const block = (id, p, phase, start, extra = {}) => ({
  eintragId: id, art: 'BLOCK', pseudonym: p, phase, bereich: 'NEPH', dienst: 'FRUEH', arbeitskontext: 'STATION', startTs: T(start), endTs: T(start) + 3_600_000,
  beobachtetSek: 3600, pausenAnzahl: 1, pausenSek: 120, status: 'beendet', endeArt: 'regulaer', abbruchCode: null, erhebungsmodus: '',
  exportStatus: 'exportiert', geraeteId: 'abcdef12-3456', testmodus: false, ...extra,
});
const daten = () => ({
  teilnehmende: [
    { pseudonym: 'P001', bereich: 'NEPH', status: 'aktiv', statusTs: T('2026-11-01T08:00:00+01:00'), registriertTs: T('2026-11-01T08:00:00+01:00'), notiz: 'Teilzeit; "Mo/Di"\nsonst frei', phasenAbweichung: null },
    { pseudonym: 'P002', bereich: 'NEPH', status: 'aktiv', statusTs: T('2026-11-01T08:00:00+01:00'), registriertTs: T('2026-11-01T08:00:00+01:00'), notiz: '', phasenAbweichung: { baselineStart: null, einfuehrungStart: '2026-12-10', regelbetriebStart: null, abschlussStart: null, ende: null } },
  ],
  phasenplan: [{ bereich: 'NEPH', baselineStart: '2026-11-23', einfuehrungStart: '2026-12-07', regelbetriebStart: '2026-12-21', abschlussStart: '2027-01-25', ende: '2027-01-31' }],
  logbuch: [
    block('b1', 'P001', 'PRE', '2026-11-24T08:00:00+01:00'),
    block('b2', 'P001', 'PRE', '2026-11-25T15:00:00+01:00', { dienst: 'SPAET' }),
    block('b3', 'P002', 'PRE', '2026-11-26T09:00:00+01:00', { status: 'abgebrochen', abbruchCode: 'A2' }),
    block('t1', 'P000', 'PRE', '2026-11-26T09:00:00+01:00', { testmodus: true }),
    { ...block('f1', 'P001', 'PRE', '2026-11-27T09:00:00+01:00'), art: 'FB1', status: 'abgeschlossen', erhebungsmodus: 'APP', beantwortet: 80, ausgelassen: 6 },
  ],
  aenderungen: [
    { aenderungId: 'a1', ts: T('2026-11-28T10:00:00.123+01:00'), geraeteId: 'abcdef12-3456', appVersion: '0.9.0', art: 'KOMMENTAR', zielTyp: 'eintrag', zielId: 'b1', feld: null, alt: null, neu: null, grund: null, text: 'Visite verlängert' },
  ],
});

describe('CRC32 und CSV', () => {
  test('bekannte Prüfwerte', () => {
    assert.equal(crc32('123456789'), 'cbf43926');
    assert.equal(crc32(''), '00000000');
    assert.equal(crc32('Ärztin'), crc32('Ärztin'));
    assert.notEqual(crc32('Ärztin'), crc32('Arztin'));
  });
  test('Anführungszeichen, Semikolon und Zeilenumbruch im Feld, BOM', () => {
    const r = leseCsv('﻿a;b\r\n"x;y";"z ""1""\r\nneu"\r\n;\r\n');
    assert.deepEqual(r.kopf, ['a', 'b']);
    assert.deepEqual(r.zeilen, [{ a: 'x;y', b: 'z "1"\r\nneu' }, { a: '', b: '' }]);
  });
});

describe('Logbuch-Datei', () => {
  test('Dateiname fest je Gerät, Probelauf mit TEST_', () => {
    assert.equal(dateinameLogbuch('abcdef12-3456'), 'HXNOW_Logbuch_abcdef12.csv');
    assert.equal(dateinameLogbuch('abcdef12-3456', true), 'HXNOW_TEST_Logbuch_abcdef12.csv');
  });
  test('Stand in Klartext ohne Probeläufe', () => {
    assert.match(standText(daten()), /^2 Probanden, 3 Blöcke, 1 Fragebögen, letzte Sitzung 27\.11\.2026/);
  });
  test('Hin und zurück: alle Datensätze gleich, Prüfsumme und Zeilenzahl stimmen', () => {
    const d = daten();
    const datei = logbuchDatei(d, kopf);
    assert.equal(datei.dateiname, 'HXNOW_Logbuch_abcdef12.csv');
    assert.ok(datei.inhalt.startsWith('﻿datensatz;export_ts;'));
    const r = leseLogbuchDatei(datei.inhalt);
    assert.deepEqual(r.fehler, []);
    assert.equal(r.ok, true);
    assert.equal(r.meta.geraeteId, kopf.geraeteId);
    assert.equal(r.meta.exportTs, kopf.now);
    assert.deepEqual(r.teilnehmende, d.teilnehmende);
    assert.deepEqual(r.phasenplan, d.phasenplan);
    assert.deepEqual(r.aenderungen, d.aenderungen);
    for (const [i, l] of d.logbuch.entries()) {
      const zurueck = r.logbuch[i];
      for (const [k, v] of Object.entries(l)) assert.deepEqual(zurueck[k] ?? null, v ?? null, `${l.eintragId}.${k}`);
    }
  });
  test('Veränderte Datei: Prüfsumme schlägt an; fehlende Zeile: Zeilenzahl', () => {
    const { inhalt } = logbuchDatei(daten(), kopf);
    assert.match(leseLogbuchDatei(inhalt.replace('Visite verlängert', 'Visite verkürzt')).fehler.join(), /Prüfsumme/);
    const zeilen = inhalt.split('\r\n');
    const ohne = zeilen.filter((z) => !z.startsWith('aenderung;')).join('\r\n');
    const r = leseLogbuchDatei(ohne);
    assert.equal(r.ok, false);
    assert.match(r.fehler.join(), /Zeilenzahl/);
    assert.equal(leseLogbuchDatei('a;b\r\n1;2').ok, false);
  });
});

describe('Änderungen: wirksamer Stand', () => {
  const ctx = { uuid: (() => { let n = 0; return () => `x${++n}`; })(), now: (() => { let t = 1000; return () => (t += 1000); })(), geraeteId: 'g1', appVersion: '0.9.0' };
  const e = block('b1', 'P001', 'PRE', '2026-11-24T08:00:00+01:00');
  test('ungültig, aufgehoben, Zuordnung, Phase, Kommentar zurückgezogen', () => {
    const a = [
      neueAenderung({ art: ART.UNGUELTIG, zielTyp: 'eintrag', zielId: 'b1', grund: 'U3', text: '' }, ctx),
      neueAenderung({ art: ART.ZUORDNUNG, zielTyp: 'eintrag', zielId: 'b1', feld: 'pseudonym', alt: 'P001', neu: 'P007' }, ctx),
      neueAenderung({ art: ART.KOMMENTAR, zielTyp: 'eintrag', zielId: 'b1', text: 'falsch zugeordnet' }, ctx),
    ];
    let s = wirksamerStand(e, a);
    assert.equal(s.gueltig, false);
    assert.equal(s.ungueltigGrund, 'U3');
    assert.equal(s.pseudonym, 'P007');
    assert.equal(s.pseudonymOriginal, 'P001');
    assert.equal(s.kommentare.length, 1);
    assert.equal(s.verlauf.length, 3);
    assert.equal(e.pseudonym, 'P001', 'Rohdaten unverändert');
    a.push(neueAenderung({ art: ART.UNGUELTIG_AUFGEHOBEN, zielTyp: 'eintrag', zielId: 'b1' }, ctx));
    a.push(neueAenderung({ art: ART.KOMMENTAR_ZURUECK, zielTyp: 'aenderung', zielId: a[2].aenderungId }, ctx));
    a.push(neueAenderung({ art: ART.PHASE, zielTyp: 'eintrag', zielId: 'b1', feld: 'phase', alt: 'PRE', neu: 'POST' }, ctx));
    a.push(neueAenderung({ art: ART.ZUORDNUNG, zielTyp: 'eintrag', zielId: 'b1', feld: 'pseudonym', alt: 'P007', neu: 'P001' }, ctx));
    s = wirksamerStand(e, a);
    assert.equal(s.gueltig, true);
    assert.equal(s.pseudonym, 'P001');
    assert.equal(s.pseudonymOriginal, null);
    assert.equal(s.phase, 'POST');
    assert.equal(s.phaseOriginal, 'PRE');
    assert.equal(s.kommentare[0].zurueckgezogen, true);
    assert.equal(s.konflikt, false);
  });
  test('Änderungen zweier Geräte: die spätere gilt, Konflikt markiert', () => {
    const a = [
      { aenderungId: 'z', ts: 2000, geraeteId: 'g2', art: ART.UNGUELTIG_AUFGEHOBEN, zielId: 'b1' },
      { aenderungId: 'y', ts: 1000, geraeteId: 'g1', art: ART.UNGUELTIG, zielId: 'b1', grund: 'U1' },
    ];
    const s = wirksamerStand(e, a);
    assert.equal(s.gueltig, true);
    assert.equal(s.konflikt, true);
  });
});

describe('Studienübersicht', () => {
  const d = daten();
  test('Phasendaten: Abweichung vor Bereich; Phase am Tag', () => {
    const p2 = phasendaten(d.teilnehmende[1], d.phasenplan);
    assert.equal(p2.einfuehrungStart, '2026-12-10');
    assert.equal(p2.baselineStart, '2026-11-23');
    assert.equal(phaseAm(T('2026-12-08T12:00:00'), p2).id, 'baseline');
    assert.equal(phaseAm(T('2026-12-08T12:00:00'), phasendaten(d.teilnehmende[0], d.phasenplan)).id, 'einfuehrung');
    assert.equal(phaseAm(T('2027-01-31T20:00:00'), p2).id, 'regelbetrieb');
    assert.equal(phaseAm(T('2027-02-01T08:00:00'), p2), null);
    assert.equal(phaseAm(T('2026-11-01T08:00:00'), p2), null);
    assert.equal(phaseAm(Date.now(), phasendaten({}, [])), null);
  });
  test('Zählung je Proband und Phase mit Änderungen, ohne Probelauf; Ampel und Fällig-Liste', () => {
    const aend = [...d.aenderungen, { aenderungId: 'u', ts: 5, geraeteId: 'g', art: ART.UNGUELTIG, zielId: 'b2', grund: 'U4' }];
    const u = probandenUebersicht({ ...d, aenderungen: aend }, { ziel: 5, jetzt: T('2026-12-05T12:00:00+01:00') });
    assert.deepEqual(u.map((x) => x.t.pseudonym), ['P001', 'P002']);
    const b1 = u[0].phasen.baseline;
    assert.equal(b1.bloecke, 1);
    assert.equal(b1.ungueltig, 1);
    assert.equal(b1.minuten, 60);
    assert.equal(b1.bogen.eintragId, 'f1');
    assert.equal(b1.restTage, 2);
    assert.equal(b1.ampel, 'rot'); // 4 fehlen, 2 Tage
    assert.equal(u[1].phasen.baseline.abbrueche[0], 'A2');
    assert.equal(u[1].phasen.baseline.restTage, 5);
    const f = faelligListe(u, { nichtGesichert: 2 });
    assert.equal(f[0].text, '2 Sitzungen nicht gesichert');
    assert.ok(f.some((x) => x.text === 'P001: 1 von 5 Blöcken (Baseline), noch 2 Tage'));
    assert.ok(f.some((x) => x.text.startsWith('FB1 von P002 offen')));
    assert.ok(!f.some((x) => x.text.startsWith('FB1 von P001')));
  });
  test('Verteilung nur über alle Probanden, nach Kontext, Dienst, Tageszeit', () => {
    const v = verteilung(d.logbuch, d.aenderungen);
    assert.equal(v.PRE.anzahl, 3);
    assert.deepEqual(v.PRE.dienst, { FRUEH: 2, SPAET: 1 });
    assert.deepEqual(v.PRE.tageszeit, { 'vor 10 Uhr': 2, 'nach 14 Uhr': 1 });
    assert.equal(v.POST.anzahl, 0);
    assert.equal(bereichsStand(d.phasenplan, T('2026-11-25T12:00:00+01:00'))[0].text, 'Baseline, Tag 3 von 14');
  });
});

describe('PIN', async () => {
  const { pinFormatOk, neuesSalz, pinHash, pruefePin, SPERRE_MS } = await import('../../js/pin.js');
  test('Format, Salz, Hash ohne Klartext', async () => {
    assert.equal(pinFormatOk('1234'), true);
    assert.equal(pinFormatOk('123'), false);
    assert.equal(pinFormatOk('12a4'), false);
    assert.equal(neuesSalz().length, 32);
    const h = await pinHash('1234', 'abc');
    assert.equal(h.length, 64);
    assert.notEqual(h, await pinHash('1234', 'abd'));
    assert.ok(!h.includes('1234'));
  });
  test('5 Fehlversuche → 5 Minuten gesperrt, danach wieder möglich', async () => {
    let z = { pinSalz: 's', pinHash: await pinHash('2468', 's'), fehlversuche: 0, sperreBis: null };
    for (let i = 0; i < 4; i++) { const r = await pruefePin('0000', z, 1000); assert.equal(r.gesperrt, false); assert.equal(r.rest, 4 - i); z = r.z; }
    const r5 = await pruefePin('0000', z, 1000);
    assert.equal(r5.gesperrt, true);
    assert.equal(r5.z.sperreBis, 1000 + SPERRE_MS);
    assert.equal((await pruefePin('2468', r5.z, 2000)).ok, false, 'auch richtige PIN während der Sperre abgewiesen');
    const ok = await pruefePin('2468', r5.z, 1000 + SPERRE_MS);
    assert.equal(ok.ok, true);
    assert.equal(ok.z.fehlversuche, 0);
  });
});
