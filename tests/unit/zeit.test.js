import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatiereCountdown, isoMitOffset, datumLokal, dateinameZeit, uhrzeit, sekundenSeit, dauerSek } from '../../js/zeit.js';

process.env.TZ = 'Europe/Berlin';

test('Countdown mm:ss, aufgerundet, nie negativ', () => {
  assert.equal(formatiereCountdown(900_000), '15:00');
  assert.equal(formatiereCountdown(899_001), '15:00');
  assert.equal(formatiereCountdown(899_000), '14:59');
  assert.equal(formatiereCountdown(60_000), '01:00');
  assert.equal(formatiereCountdown(1), '00:01');
  assert.equal(formatiereCountdown(0), '00:00');
  assert.equal(formatiereCountdown(-5000), '00:00');
});

test('ISO mit Offset – Winterzeit', () => {
  assert.equal(isoMitOffset(Date.UTC(2026, 11, 3, 8, 15, 2, 999)), '2026-12-03T09:15:02+01:00');
});

test('ISO mit Offset – Sommerzeit', () => {
  assert.equal(isoMitOffset(Date.UTC(2026, 6, 1, 22, 30, 0)), '2026-07-02T00:30:00+02:00');
});

test('ISO mit Offset – Zeitumstellung 25.10.2026', () => {
  // 00:59:59 UTC = 02:59:59 MESZ; 01:00:00 UTC = 02:00:00 MEZ
  assert.equal(isoMitOffset(Date.UTC(2026, 9, 25, 0, 59, 59)), '2026-10-25T02:59:59+02:00');
  assert.equal(isoMitOffset(Date.UTC(2026, 9, 25, 1, 0, 0)), '2026-10-25T02:00:00+01:00');
});

test('Datum, Dateiname, Uhrzeit lokal', () => {
  const ts = Date.UTC(2026, 11, 31, 23, 5, 9); // 01.01.2027 00:05:09 MEZ
  assert.equal(datumLokal(ts), '2027-01-01');
  assert.deepEqual(dateinameZeit(ts), { datum: '20270101', uhrzeit: '0005' });
  assert.equal(uhrzeit(ts), '00:05:09');
});

test('Sekunden kaufmännisch gerundet auf ms-Basis', () => {
  assert.equal(sekundenSeit(0, 499), 0);
  assert.equal(sekundenSeit(0, 500), 1);
  assert.equal(sekundenSeit(0, 47_400), 47);
});

test('dauerSek: Summe der gerundeten Dauern = gerundete Gesamtdauer', () => {
  const start = 1_000_000;
  const grenzen = [start, start + 1_499, start + 2_998, start + 4_497, start + 900_000];
  let summe = 0;
  for (let i = 0; i < grenzen.length - 1; i++) summe += dauerSek(start, grenzen[i], grenzen[i + 1]);
  assert.equal(summe, 900);
});
