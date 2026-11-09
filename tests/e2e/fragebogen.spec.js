// Fragebogen-Modus (Fragebogenplan F1–F4): Vorbereitung, Übergabe, Ausfüllen mit Filtern, Unterbrechung,
// Papier-Nacherfassung, Rückkehr per langem Druck, Statusansicht ohne Antworten, Export im Long-Format.
import { test, expect } from '@playwright/test';
import { oeffne, waehleCode, leseDb, mockeTeilen, geteilt } from './hilfen.js';
import { FRAGEBOGEN_DEFINITION } from '../../js/frageboegen.js';

async function vorbereiten(page, { bogen = 'FB1', code = 'P050', modus = 'APP', datum = null } = {}) {
  await page.click('[data-test=neuer-fragebogen]');
  await page.click(`[data-test=fb-bogen-${bogen}]`);
  await waehleCode(page, code);
  await page.click('[data-test=fb-bereich-NEPH]');
  if (modus === 'PAPIER') { await page.click('[data-test=fb-modus-PAPIER]'); await page.fill('[data-test=fb-papier-datum]', datum); }
  await page.click('[data-test=fb-vorbereitung-weiter]');
}

/** Weiter; offene Fragen mit „Trotzdem weiter“ bestätigen. */
async function weiter(page) {
  const knopf = page.locator('[data-test=fb-weiter], [data-test=fb-abschliessen]');
  await knopf.click();
  const ja = page.locator('[data-test=bestaetigen-ja]');
  if (await ja.count()) await ja.click();
}

test('FB1 komplett: Filterpfade A8b = nein und W1b = 0 (mit Rückfrage), Abschluss, langer Druck, Statusansicht, Export', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await vorbereiten(page);
  await expect(page.locator('[data-test=fb-uebergabe]')).toContainText('Bitte reichen Sie das Gerät');
  await page.click('[data-test=fb-start]');

  await expect(page.locator('[data-test=fb-einleitung]')).toContainText('Bearbeitungszeit ca. 14 Minuten.');
  await expect(page.locator('[data-test=fb-fortschritt]')).toHaveText('Abschnitt 1 von 7');
  await page.click('[data-test=fb-A1-2]');
  await expect(page.locator('[data-test=fb-A1-2]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-test=fb-A3-9]');
  await page.fill('[data-test=fb-A3_TXT]', 'Weiterbildung');
  await page.locator('[data-test=fb-A3_TXT]').blur();
  await page.click('[data-test=fb-A6_ZNA_BEH]');
  await expect(page.locator('[data-test=fb-summe-A6]')).toHaveText('Summe: 100 %');
  await page.click('[data-test=fb-A8b-2]');
  await page.click('[data-test=fb-weiter]');
  await expect(page.locator('[data-test=dialog-bestaetigen], .dialog').first()).toContainText('noch offen');
  await page.click('[data-test=bestaetigen-ja]');

  await expect(page.locator('[data-test=fb-abschnitt]')).toContainText('B');
  await weiter(page);
  await expect(page.locator('[data-test=fb-abschnitt]')).toContainText('W');
  await expect(page.locator('[data-test=fb-hinweis-W1b]')).toContainText('Urlaub, freie Tage und Krankheit zählen nicht.');
  await page.fill('[data-test=fb-W1b]', '3');
  await page.locator('[data-test=fb-W1b]').blur();
  await expect(page.locator('[data-test=fb-hinweis-W3]')).toContainText('auch „0“');
  await expect(page.locator('[data-test=fb-W2b]')).toHaveCount(0); // A8b = nein → keine Dienste (automatisch 0)
  // 0 Arbeitstage: erst Rückfrage; „Korrigieren“ behält den alten Wert, „Ja, weiter“ blendet den Abschnitt aus
  await page.fill('[data-test=fb-W1b]', '0');
  await page.locator('[data-test=fb-W1b]').blur();
  await expect(page.locator('[data-test=bestaetigung]')).toContainText('Sie haben 0 Arbeitstage angegeben.');
  await page.click('[data-test=bestaetigen-nein]');
  await expect(page.locator('[data-test=fb-W1b]')).toHaveValue('3');
  await expect(page.locator('[data-test=fb-W3_01_A-0]')).toHaveCount(1);
  await page.fill('[data-test=fb-W1b]', '0');
  await page.locator('[data-test=fb-W1b]').blur();
  await page.click('[data-test=bestaetigen-ja]');
  await expect(page.locator('[data-test=fb-W3_01_A-0]')).toHaveCount(0); // W1b = 0: Rest von W ausgeblendet
  await weiter(page);
  await expect(page.locator('[data-test=fb-abschnitt]')).toContainText('C');
  await page.click('[data-test=fb-C1-4]');
  for (let i = 0; i < 3; i++) await weiter(page); // C, D, E
  await expect(page.locator('[data-test=fb-abschliessen]')).toBeVisible();
  await weiter(page);

  await expect(page.locator('[data-test=fb-danke]')).toContainText('Vielen Dank für Ihre Teilnahme!');
  await page.locator('[data-test=fb-zurueck-halten]').dispatchEvent('pointerdown');
  await page.clock.fastForward(1000);
  await page.locator('[data-test=fb-zurueck-halten]').dispatchEvent('pointerup'); // zu kurz
  await page.clock.fastForward(2000);
  await expect(page.locator('[data-test=fb-danke]')).toBeVisible();
  await page.locator('[data-test=fb-zurueck-halten]').dispatchEvent('pointerdown');
  await page.clock.fastForward(2100);

  await expect(page.locator('[data-test=fb-status]')).toHaveText('abgeschlossen');
  await expect(page.locator('[data-test=fb-eckdaten]')).not.toContainText('Weiterbildung'); // keine Antworten sichtbar
  await page.click('[data-test=exportieren]');
  await expect(page.locator('[data-test=fb-export-status]')).toContainText('exportiert');
  const [datei] = await geteilt(page);
  expect(datei.name).toMatch(/^HXNOW_FB_FB1_P050_20261203_\d{4}_[0-9a-f]{8}\.csv$/);
  const zeilen = datei.text.replace(/^﻿/, '').split('\r\n').filter(Boolean).map((z) => z.split(';'));
  const kopf = zeilen.shift();
  const zeile = (id) => Object.fromEntries(kopf.map((k, i) => [k, zeilen.find((z) => z[kopf.indexOf('item_id')] === id)[i]]));
  expect(zeilen).toHaveLength(91);
  expect(zeilen.every((z) => z[kopf.indexOf('n_zeilen')] === '91')).toBe(true);
  expect(zeile('A1')).toMatchObject({ wert: '2', status: 'beantwortet', paar: '' });
  expect(zeile('A3_TXT')).toMatchObject({ wert_text: 'Weiterbildung', status: 'beantwortet' });
  expect(zeile('A6_ZNA_BEH_PCT')).toMatchObject({ wert: '100', status: 'automatisch' });
  expect(zeile('A6_STAT')).toMatchObject({ wert: '0', status: 'beantwortet' });
  expect(zeile('W2b')).toMatchObject({ wert: '0', status: 'automatisch' }); // A8b = nein
  expect(zeile('W1b')).toMatchObject({ wert: '0', status: 'beantwortet', paar: 'ARBEITSTAGE_14' });
  expect(zeile('W3_01_A')).toMatchObject({ wert: '-88', status: 'gefiltert', paar: 'W3_01_A' });
  expect(zeile('A2')).toMatchObject({ wert: '', status: 'ausgelassen' });
  expect(zeile('C1')).toMatchObject({ wert: '4', erhebungsmodus: 'APP', definition_version: FRAGEBOGEN_DEFINITION.definitionVersion, bogen: 'FB1', testmodus: '0' });
  expect(zeile('A6_SONST_TXT')).toMatchObject({ wert: '-88', wert_text: '', status: 'gefiltert' }); // ausgeblendetes Freitextfeld
  const ausgelassen = zeilen.filter((z) => z[kopf.indexOf('status')] === 'ausgelassen').length;

  const db = await leseDb(page);
  expect(db.logbuch.find((l) => l.art === 'FB1')).toMatchObject({ pseudonym: 'P050', status: 'abgeschlossen', phase: 'PRE', exportStatus: 'exportiert', ausgelassen }); // gleiche Zählung wie in der Datei
});

test('Unterbrechung: Neustart mitten im Bogen → Fortsetzen an derselben Stelle ohne Datenverlust; Block solange gesperrt', async ({ page }) => {
  await oeffne(page);
  await vorbereiten(page);
  await page.click('[data-test=fb-start]');
  await page.click('[data-test=fb-A1-3]');
  await weiter(page);
  await page.click('[data-test=fb-B1-4]');
  await expect(page.locator('[data-test=fb-B1-4]')).toHaveAttribute('aria-pressed', 'true'); // gespeichert
  await page.reload();
  await expect(page.locator('[data-test=offene-fragebogen]')).toContainText('P050');
  await page.click('[data-test=fb-fortsetzen]');
  await expect(page.locator('[data-test=fb-abschnitt]')).toContainText('B');
  await expect(page.locator('[data-test=fb-B1-4]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-test=fb-zurueck]');
  await expect(page.locator('[data-test=fb-A1-3]')).toHaveAttribute('aria-pressed', 'true');
  // Während der Fragebogen offen ist, startet kein Block
  await page.goto('./');
  await page.click('[data-test=neuer-block]');
  await waehleCode(page, 'P051');
  await page.click('[data-test=phase-PRE]');
  await page.click('[data-test=bereich-NEPH]');
  await page.click('[data-test=block-starten]');
  await expect(page.locator('#meldung')).toContainText('Ein Fragebogen ist noch offen');
});

test('Papier-Nacherfassung: ohne Übergabe, Modus und Datum im Export', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await vorbereiten(page, { bogen: 'KB', code: 'P052', modus: 'PAPIER', datum: '2026-11-30' });
  await expect(page.locator('[data-test=fb-fortschritt]')).toHaveText('Abschnitt 1 von 1');
  await page.click('[data-test=fb-G1-3]');
  await page.click('[data-test=fb-G2_1-2]');
  await weiter(page);
  await expect(page.locator('[data-test=fb-danke]')).toContainText('Vielen Dank!');
  await page.locator('[data-test=fb-zurueck-halten]').dispatchEvent('pointerdown');
  await page.clock.fastForward(2100);
  await page.click('[data-test=exportieren]');
  const [datei] = await geteilt(page);
  expect(datei.name).toMatch(/^HXNOW_FB_KB_P052_/);
  expect(datei.text).toContain(';KB;P052;NEPH;PAPIER;2026-11-30;');
  expect(datei.text.split('\r\n').filter(Boolean)).toHaveLength(11);
});

test('FB2 freigegeben (Definition 1.1.0): echter Code möglich; weiche Sprungregel bei Nichtnutzung', async ({ page }) => {
  await oeffne(page);
  await page.click('[data-test=neuer-fragebogen]');
  await expect(page.locator('[data-test=fb-bogen-FB2]')).not.toContainText('Entwurf');
  await page.click('[data-test=fb-bogen-FB2]');
  await waehleCode(page, 'P053');
  await page.click('[data-test=fb-bereich-NEPH]');
  await expect(page.locator('[data-test=fb-hinweis]')).toHaveText('');
  await page.click('[data-test=fb-vorbereitung-weiter]');
  await page.click('[data-test=fb-start]');
  await expect(page.locator('[data-test=probelauf]')).toHaveCount(0);
  // Nichtnutzung → weiche Sprungregel
  await page.fill('[data-test=fb-W1b]', '5'); await page.locator('[data-test=fb-W1b]').blur();
  await page.click('[data-test=fb-W4-1]'); // Gerät nie dabei → W5 automatisch 0
  await expect(page.locator('[data-test=fb-sprung]')).toBeVisible();
  await page.click('[data-test=fb-SKIP_HX-1]');
  await weiter(page);
  await expect(page.locator('[data-test=fb-abschnitt]')).toContainText('C'); // A, B, E, T übersprungen
});
