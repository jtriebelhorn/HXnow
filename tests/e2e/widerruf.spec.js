// Widerruf (PLAN_Logbuch_Datensicherheit L5): alle Daten des Codes gelöscht, keine Resttreffer in den Stores, Protokoll
// mit Dateiliste, Logbuch-Sicherung erzwungen (Banner), alte Dateien werden beim Laden abgewiesen.
import { test, expect } from '@playwright/test';
import { oeffne, kurzerBlock, mockeTeilen, geteilt, leseDb, waehleCode } from './hilfen.js';
import { leseLogbuchDatei } from '../../js/logbuchdatei.js';

test('Widerruf P017: Daten gelöscht, P018 unberührt, Protokoll und Logbuch, Abweisung beim Laden', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await kurzerBlock(page, { phase: 'PRE' });
  await page.click('[data-test=exportieren]');
  await page.click('[data-test=zur-startseite]');
  const blockDatei = (await geteilt(page))[0];
  // Kurzbogen auf Papier für P017
  await page.click('[data-test=neuer-fragebogen]');
  await page.click('[data-test=fb-bogen-KB]');
  await waehleCode(page, 'P017');
  await page.click('[data-test=fb-bereich-NEPH]');
  await page.click('[data-test=fb-modus-PAPIER]');
  await page.fill('[data-test=fb-papier-datum]', '2026-12-02');
  await page.click('[data-test=fb-vorbereitung-weiter]');
  await page.click('[data-test=fb-G1-3]');
  await page.click('[data-test=fb-abschliessen]');
  if (await page.locator('[data-test=bestaetigen-ja]').count()) await page.click('[data-test=bestaetigen-ja]');
  await page.locator('[data-test=fb-zurueck-halten]').dispatchEvent('pointerdown');
  await page.clock.fastForward(2100);
  await page.goto('./');
  await kurzerBlock(page, { phase: 'PRE', pseudonym: 'P018' });
  await page.goto('./');

  await page.click('[data-test=menue-studie]');
  await page.click('[data-test=proband-P017]');
  await page.click('[data-test=widerruf]');
  await page.fill('[data-test=pin-neu]', '2468');
  await page.fill('[data-test=pin-wiederholen]', '2468');
  await page.click('[data-test=pin-speichern]');
  await expect(page.locator('[data-test=dialog-widerruf]')).toContainText('1 Blöcke, 0 Versuche, 1 Fragebögen');
  await page.fill('[data-test=widerruf-code]', 'P018');
  await page.click('[data-test=aendern-ok]');
  await expect(page.locator('[data-test=aendern-fehler]')).toHaveText('Der Code stimmt nicht.');
  await page.fill('[data-test=widerruf-code]', 'p017');
  await page.click('[data-test=aendern-ok]');
  await expect(page.locator('[data-test=widerruf-dateien] li')).toHaveCount(2);
  await expect(page.locator('[data-test=widerruf-dateien]')).toContainText(blockDatei.name);

  const db = await leseDb(page);
  const rest = Object.entries(db).filter(([n]) => !['teilnehmende', 'aenderungen'].includes(n)).flatMap(([, l]) => l).filter((x) => JSON.stringify(x).includes('P017'));
  expect(rest).toEqual([]);
  expect(db.teilnehmende.find((t) => t.pseudonym === 'P017').status).toBe('widerrufen');
  expect(db.aenderungen.filter((a) => JSON.stringify(a).includes('P017')).map((a) => a.art)).toEqual(['WIDERRUF_LOESCHUNG']);
  expect(db.bloecke.map((b) => b.pseudonym)).toEqual(['P018']);
  expect(db.fb_antworten).toHaveLength(0);

  // Später → Startseite mahnt; Teilen von Protokoll und Logbuch beendet die Mahnung
  await page.click('[data-test=zurueck]');
  await page.goto('./');
  await expect(page.locator('[data-test=banner-widerruf]')).toContainText('Widerruf P017');
  await page.click('[data-test=menue-studie]');
  await page.click('[data-test=proband-P017]');
  await expect(page.locator('[data-test=proband-widerrufen]')).toBeVisible();
  await expect(page.locator('[data-test=widerruf]')).toHaveCount(0);
  await page.click('[data-test=zurueck]');
  await page.click('[data-test=logbuch-sichern]');
  const lb = leseLogbuchDatei((await geteilt(page)).at(-1).text);
  expect(lb.logbuch.map((l) => l.pseudonym)).toEqual(['P018']);
  await page.goto('./');
  await expect(page.locator('[data-test=banner-widerruf]')).toHaveCount(0);

  // alte Sitzungsdatei wird beim Laden abgewiesen
  await page.click('[data-test=menue-sicherung]');
  await page.setInputFiles('[data-test=import-datei]', { name: blockDatei.name, mimeType: 'text/csv', buffer: Buffer.from(blockDatei.text) });
  await expect(page.locator('[data-test=wiederherstellen-vorschau]')).toContainText('Widerrufen, nicht übernommen: P017');
  await page.click('[data-test=wiederherstellen-ja]');
  expect(JSON.stringify((await leseDb(page)).logbuch)).not.toContain('P017');
  // Code nicht mehr wählbar
  await page.goto('./');
  await page.click('[data-test=neuer-block]');
  await page.fill('[data-test=pseudonym]', 'P017');
  await expect(page.locator('[data-test=pseudonym-fehler]')).toContainText('widerrufen');
});
