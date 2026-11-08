import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erstelleSicherung, sicherungsDatei, pruefeSicherung } from '../../js/sicherung.js';
import { START } from './hilfen.js';

process.env.TZ = 'Europe/Berlin';

const daten = {
  bloecke: [{ blockId: 'b1', status: 'beendet' }],
  episoden: [{ episodeId: 'e1', blockId: 'b1' }],
  pausen: [{ pauseId: 'p1', blockId: 'b1' }],
  versuche: [],
  tageskennzahlen: [{ datum: '2026-12-03', bereich: 'ZNA' }],
};

test('Sicherung erstellen und wieder einlesen', () => {
  const s = erstelleSicherung({ daten, geraeteId: 'g', appVersion: '1', schemaVersion: '0.1', now: START });
  const d = sicherungsDatei(s);
  assert.equal(d.dateiname, 'HXNOW_Komplettsicherung_g_20261203_0915.json');
  const r = pruefeSicherung(d.inhalt);
  assert.deepEqual(r.fehler, []);
  const leer = { fb_sitzungen: [], fb_antworten: [], teilnehmende: [], logbuch: [], aenderungen: [], phasenplan: [] };
  assert.deepEqual(r.sicherung.stores, { ...daten, ...leer });
  assert.equal(r.sicherung.formatVersion, 2);
  assert.equal(r.sicherung.erstellt, '2026-12-03T09:15:02+01:00');
});

test('ältere Sicherung ohne Pausen wird angenommen', () => {
  const s = erstelleSicherung({ daten, geraeteId: 'g', appVersion: '1', schemaVersion: '0.1', now: START });
  delete s.stores.pausen;
  const r = pruefeSicherung(JSON.stringify(s));
  assert.deepEqual(r.fehler, []);
  assert.deepEqual(r.sicherung.stores.pausen, []);
});

test('fremde oder kaputte Dateien werden abgelehnt', () => {
  assert.match(pruefeSicherung('{').fehler[0], /kein gültiges JSON/);
  assert.match(pruefeSicherung('{"a":1}').fehler[0], /keine Datensicherung/);
  const s = erstelleSicherung({ daten, geraeteId: 'g', appVersion: '1', schemaVersion: '0.1', now: START });
  s.stores.episoden.push({ blockId: 'b1' });
  delete s.stores.versuche;
  const f = pruefeSicherung(JSON.stringify(s)).fehler;
  assert.ok(f.some((x) => x.includes('„versuche“ fehlt')));
  assert.ok(f.some((x) => x.includes('„episoden“, Eintrag 2')));
});

test('Sicherung von vor 0.7.0 (Format 1, ohne neue Stores) bleibt ladbar', () => {
  const alt = { format: 'hxnow-beobachtung-sicherung', formatVersion: 1, stores: { bloecke: [{ blockId: 'b1' }], episoden: [], pausen: [], versuche: [], tageskennzahlen: [] } };
  const r = pruefeSicherung(JSON.stringify(alt));
  assert.deepEqual(r.fehler, []);
  assert.deepEqual(r.sicherung.stores.logbuch, []);
});
