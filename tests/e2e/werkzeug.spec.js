// Zusammenführungstool im Browser: Dateien wählen → Prüfbericht und ZIP (F5/L6).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('Zusammenführen: Referenzblock + fremde Datei → Bericht und ZIP zum Herunterladen', async ({ page }) => {
  await page.goto('./werkzeuge/zusammenfuehren.html');
  const block = readFileSync(new URL('../unit/referenz/HXNOW_BEOB_P017_20261203_0915_id-0001.csv', import.meta.url));
  await page.setInputFiles('[data-test=dateien]', [
    { name: 'HXNOW_BEOB_P017_20261203_0915_id-0001.csv', mimeType: 'text/csv', buffer: block },
    { name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('a;b\r\n1;2\r\n') },
  ]);
  await expect(page.locator('[data-test=pruefbericht]')).toContainText('Blöcke: 1');
  await expect(page.locator('[data-test=pruefbericht]')).toContainText('Keine gültige Logbuch-Datei');
  await expect(page.locator('[data-test=pruefbericht]')).toContainText('Nicht erkannt, übersprungen: x.csv');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-test=zip-laden]')]);
  expect(download.suggestedFilename()).toMatch(/^HXNOW_Auswertung_\d{8}_\d{4}\.zip$/);
  const zip = readFileSync(await download.path());
  expect(zip.subarray(0, 4).toString('hex')).toBe('504b0304');
});
