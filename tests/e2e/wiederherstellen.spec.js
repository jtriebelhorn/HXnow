// Wiederherstellen (PLAN_Logbuch_Datensicherheit L2): leere Datenbank → Sicherung laden mit Mehrfachauswahl
// (Sitzungsdatei + Logbuch), Bericht; „Neu beginnen“ mit doppelter Rückfrage; Gerät stilllegen.
import { test, expect } from '@playwright/test';
import { oeffne, kurzerBlock, mockeTeilen, geteilt, leseDb } from './hilfen.js';

test('Symbol gelöscht: Sitzungsdatei und Logbuch aus dem Exportordner laden → Logbuch und Teilnehmerliste wieder da', async ({ page, browser }, testInfo) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await kurzerBlock(page);
  await page.click('[data-test=exportieren]');
  await expect(page.locator('[data-test=abschluss-export]')).toHaveText('exportiert – Eingang noch nicht bestätigt');
  const [aufruf] = await geteilt(page);
  const dateien = [{ name: aufruf.name, text: aufruf.text }, ...aufruf.weitere];
  const vorher = await leseDb(page);

  const ctx2 = await browser.newContext({ ...testInfo.project.use, serviceWorkers: 'block' });
  const neu = await ctx2.newPage();
  await neu.goto('./');
  await neu.click('[data-test=leer-laden]');
  await neu.setInputFiles('[data-test=import-datei]', [
    ...dateien.map((d) => ({ name: d.name, mimeType: 'text/csv', buffer: Buffer.from(d.text) })),
    { name: 'fremd.csv', mimeType: 'text/csv', buffer: Buffer.from('a;b\r\n1;2\r\n') },
  ]);
  const vorschau = neu.locator('[data-test=wiederherstellen-vorschau]');
  await expect(vorschau).toContainText('3 Dateien gelesen: 0 Komplettsicherungen, 1 Logbuch-Datei, 1 Sitzungsdatei.');
  await expect(vorschau).toContainText('Neueste Logbuch-Datei: HXNOW_Logbuch_');
  await expect(vorschau).toContainText('1 Probanden, 1 Blöcke');
  await expect(vorschau).toContainText('Abgelehnt: fremd.csv');
  await neu.click('[data-test=wiederherstellen-ja]');
  await expect(neu.locator('[data-test=wiederherstellen-bericht]')).toContainText('Übernommen: 2 neu');
  const db = await leseDb(neu);
  expect(db.teilnehmende).toEqual(vorher.teilnehmende);
  expect(db.logbuch).toHaveLength(1);
  expect(db.logbuch[0]).toMatchObject({ eintragId: vorher.bloecke[0].blockId, pseudonym: 'P017', exportStatus: 'bestaetigt', beobachtetSek: 900 });
  await neu.click('[data-test=zurueck]');
  await expect(neu.locator('[data-test=banner-leer]')).toHaveCount(0);
  await neu.click('[data-test=neuer-block]');
  await neu.fill('[data-test=pseudonym]', 'P01');
  await expect(neu.locator('[data-test=code-treffer]').first()).toContainText('P017');
  await ctx2.close();
});

test('Neu beginnen: zwei Rückfragen, danach kein Hinweis mehr', async ({ page }) => {
  await oeffne(page);
  await expect(page.locator('[data-test=banner-leer]')).toBeVisible();
  await page.click('[data-test=leer-neu]');
  await page.click('[data-test=bestaetigen-ja]');
  await expect(page.locator('[data-test=bestaetigung]')).toContainText('Wirklich neu beginnen?');
  await page.click('[data-test=bestaetigen-ja]');
  await expect(page.locator('[data-test=banner-leer]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-test=neuer-block]')).toBeVisible();
  await expect(page.locator('[data-test=banner-leer]')).toHaveCount(0);
});

test('Gerät stilllegen: keine neuen Erhebungen, Aufheben möglich', async ({ page }) => {
  await oeffne(page);
  await page.click('[data-test=menue-sicherung]');
  await page.click('[data-test=geraet-stilllegen]');
  await page.click('[data-test=bestaetigen-ja]');
  await page.click('[data-test=zurueck]');
  await expect(page.locator('[data-test=banner-stillgelegt]')).toBeVisible();
  await expect(page.locator('[data-test=neuer-block]')).toBeDisabled();
  await expect(page.locator('[data-test=neuer-fragebogen]')).toBeDisabled();
  await page.click('[data-test=menue-sicherung]');
  await page.click('[data-test=geraet-reaktivieren]');
  await page.click('[data-test=bestaetigen-ja]');
  await page.click('[data-test=zurueck]');
  await expect(page.locator('[data-test=neuer-block]')).toBeEnabled();
});
