// Logbuch-Datei und Sicherung (PLAN_Logbuch_Datensicherheit L1): Sitzungsexport teilt Sitzungsdatei und Logbuch in
// einem Vorgang aus der Nutzergeste; „Letzte Sicherung“, Banner für nicht gesicherte Sitzungen, „Logbuch sichern“.
import { test, expect } from '@playwright/test';
import { oeffne, kurzerBlock, mockeTeilen, geteilt, leseDb } from './hilfen.js';
import { leseLogbuchDatei } from '../../js/logbuchdatei.js';

test('Block exportieren: zwei Dateien in einem Teilen-Aufruf, Logbuch mit gültiger Prüfsumme, Letzte Sicherung', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await expect(page.locator('[data-test=letzte-sicherung]')).toHaveText('Noch keine Sicherung');
  await kurzerBlock(page);
  await page.click('[data-test=exportieren]');
  await expect(page.locator('[data-test=abschluss-export]')).toHaveText('exportiert – Eingang noch nicht bestätigt');
  const [aufruf] = await geteilt(page);
  expect(aufruf.aktiv).not.toBe(false); // noch in der Nutzergeste
  expect(aufruf.weitere).toHaveLength(1);
  expect(aufruf.weitere[0].name).toMatch(/^HXNOW_Logbuch_[0-9a-f]{8}\.csv$/);
  const lb = leseLogbuchDatei(aufruf.weitere[0].text);
  expect(lb.fehler).toEqual([]);
  expect(lb.teilnehmende.map((t) => t.pseudonym)).toEqual(['P017']);
  expect(lb.logbuch).toHaveLength(1);
  expect(lb.logbuch[0]).toMatchObject({ art: 'BLOCK', pseudonym: 'P017', phase: 'POST', status: 'beendet', exportStatus: 'exportiert', beobachtetSek: 900 });
  expect(aufruf.weitere[0].text).not.toContain('T5'); // keine Beobachtungsinhalte
  await page.click('[data-test=zur-startseite]');
  await expect(page.locator('[data-test=letzte-sicherung]')).toHaveText(/^Letzte Sicherung: 03\.12\.2026 \d\d:\d\d$/);
  await expect(page.locator('[data-test=banner-nicht-gesichert]')).toHaveCount(0);
});

test('Nicht exportierte Sitzung: gelbes Banner, nach 24 h rot; „Logbuch sichern“ teilt nur das Logbuch', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await kurzerBlock(page);
  await page.click('[data-test=zur-startseite]');
  await expect(page.locator('[data-test=banner-nicht-gesichert]')).toHaveText('1 Sitzung ist nicht gesichert. Bitte exportieren.');
  await expect(page.locator('[data-test=banner-nicht-gesichert]')).toHaveClass('banner-gelb');
  await page.clock.fastForward('25:00:00');
  await page.reload();
  await expect(page.locator('[data-test=banner-nicht-gesichert]')).toHaveClass('banner-rot');
  await expect(page.locator('[data-test=banner-nicht-gesichert]')).toContainText('seit über 24 Stunden');
  await page.click('[data-test=logbuch-sichern]');
  await expect(page.locator('[data-test=letzte-sicherung]')).toHaveText(/^Letzte Sicherung: 04\.12\.2026/);
  const [aufruf] = await geteilt(page);
  expect(aufruf.name).toMatch(/^HXNOW_Logbuch_/);
  expect(aufruf.weitere).toHaveLength(0);
  expect(leseLogbuchDatei(aufruf.text).logbuch[0].exportStatus).toBe('offen');
  const meta = await page.evaluate(() => new Promise((r) => { const o = indexedDB.open('hxnow-beobachtung'); o.onsuccess = () => { const g = o.result.transaction('meta').objectStore('meta').get('letzteSicherungTs'); g.onsuccess = () => r(g.result?.wert); }; }));
  expect(meta).toBeGreaterThan(0);
  expect((await leseDb(page)).bloecke[0].exportStatus).toBe('offen'); // Block bleibt nicht exportiert
});
