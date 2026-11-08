// Phase L0: Umgebung (Tab-Sperre) und Bewertung der Update-Suche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { umgebung, ermittleUmgebung } from '../../js/umgebung.js';
import { bewerteUpdate, updateText } from '../../js/updatepruefung.js';

test('Umgebung: Home-Bildschirm, Safari-Tab auf iPhone/iPad, Desktop-Browser', () => {
  assert.equal(umgebung({ standalone: true, displayStandalone: false }), 'installiert');
  assert.equal(umgebung({ standalone: undefined, displayStandalone: true }), 'installiert');
  assert.equal(umgebung({ standalone: false, displayStandalone: false }), 'ios-tab');
  assert.equal(umgebung({ standalone: undefined, displayStandalone: false }), 'browser-tab');
  assert.equal(ermittleUmgebung({ navigator: { standalone: false }, matchMedia: () => ({ matches: false }) }), 'ios-tab');
  assert.equal(ermittleUmgebung({ navigator: {} }), 'browser-tab');
});

test('Update-Suche: neue Version, aktuell, keine Verbindung', () => {
  const a = '0.7.0';
  assert.deepEqual(bewerteUpdate({ erreichbar: true, neuerWorker: false, serverVersion: '0.8.0', appVersion: a }), { art: 'neu', version: '0.8.0' });
  assert.deepEqual(bewerteUpdate({ erreichbar: false, neuerWorker: true, serverVersion: undefined, appVersion: a }), { art: 'neu', version: null });
  assert.deepEqual(bewerteUpdate({ erreichbar: true, neuerWorker: false, serverVersion: a, appVersion: a }), { art: 'aktuell', version: a });
  assert.deepEqual(bewerteUpdate({ erreichbar: false, neuerWorker: false, serverVersion: undefined, appVersion: a }), { art: 'offline', version: null });
  assert.equal(updateText({ art: 'neu', version: '0.8.0' }, a), 'Neue Version 0.8.0 verfügbar (installiert: 0.7.0).');
  assert.equal(updateText({ art: 'aktuell' }, a), 'Die App ist aktuell (0.7.0).');
  assert.equal(updateText({ art: 'offline' }, a), 'Keine Verbindung. Bitte später erneut versuchen.');
});
