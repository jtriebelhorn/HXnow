import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../../js/block.js';
import { erzeugeSitzung } from '../../js/sitzung.js';
import { SCHEMA, START, testKontext, ANGABEN_POST } from './hilfen.js';

// Korrekturfenster aus: Hier geht es um die Reihenfolge schneller Tipps, nicht um Korrekturen.
const OHNE_KORREKTUR = { ...SCHEMA, korrekturfensterSek: 0 };

function aufbau({ schreibe } = {}) {
  const geschrieben = [];
  let uhrMs = START;
  const ctx = testKontext().bei(0);
  const s = erzeugeSitzung({
    schema: OHNE_KORREKTUR,
    uuid: ctx.uuid,
    uhr: () => uhrMs,
    schreibe: schreibe ?? (async (w) => { await new Promise((r) => setTimeout(r, 5)); geschrieben.push(structuredClone(w)); }),
  });
  s.laden(B.erzeugeBlock(ANGABEN_POST, { ...ctx, now: () => START }).zustand);
  return { s, geschrieben, setzeUhr: (sek) => { uhrMs = START + sek * 1000; } };
}

test('Zustand wird erst nach dem Speichern übernommen', async () => {
  let freigeben;
  const { s } = aufbau({ schreibe: () => new Promise((r) => { freigeben = r; }) });
  await s.aktion((z, c) => B.tippeOrt(z, 'O1', c)); // nur Auswahl, nichts zu schreiben
  const p = s.aktion((z, c) => B.tippeTaetigkeit(z, 'T1', c));
  await new Promise((r) => setTimeout(r, 1));
  assert.equal(B.aktiveEpisoden(s.zustand).length, 0, 'noch nicht gespeichert → noch nicht übernommen');
  freigeben();
  await p;
  assert.equal(B.aktiveEpisoden(s.zustand).length, 1);
});

test('Speicherfehler: Zustand bleibt unverändert, Fehler wird weitergegeben, Folgeaktionen laufen', async () => {
  let fehlschlagen = true;
  const { s } = aufbau({ schreibe: async () => { if (fehlschlagen) throw new Error('Speicher voll'); } });
  await s.aktion((z, c) => B.tippeOrt(z, 'O1', c));
  await assert.rejects(s.aktion((z, c) => B.tippeTaetigkeit(z, 'T1', c)), /Speicher voll/);
  assert.equal(B.aktiveEpisoden(s.zustand).length, 0);
  fehlschlagen = false;
  await s.aktion((z, c) => B.tippeTaetigkeit(z, 'T1', c));
  assert.equal(B.aktiveEpisoden(s.zustand).length, 1);
});

test('schnelle Tipps werden nacheinander verarbeitet, Zeitstempel = Zeitpunkt des Tipps', async () => {
  const { s, geschrieben, setzeUhr } = aufbau();
  await s.aktion((z, c) => B.tippeOrt(z, 'O1', c));
  await s.aktion((z, c) => B.tippeTaetigkeit(z, 'T1', c));
  setzeUhr(10); const a = s.aktion((z, c) => B.tippeTaetigkeit(z, 'T2', c));
  setzeUhr(11); const b = s.aktion((z, c) => B.tippeTaetigkeit(z, 'T5', c));
  setzeUhr(12); const c2 = s.aktion((z, c) => B.tippeOrt(z, 'O3', c));
  setzeUhr(99);
  await Promise.all([a, b, c2]);
  const eps = B.aktiveEpisoden(s.zustand);
  assert.deepEqual(eps.map((e) => [e.nr, e.taetigkeit, e.ort, (e.startTs - START) / 1000]),
    [[1, 'T1', 'O1', 0], [2, 'T2', 'O1', 10], [3, 'T5', 'O1', 11], [4, 'T5', 'O3', 12]]);
  assert.equal(geschrieben.length, 4);
});
