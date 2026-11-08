// Nicht abgeschlossene Exporte löschen: × oben rechts, Rückfrage „Wirklich löschen?“. Studiensitzung: Daten weg,
// Logbuch-Vermerk GELOESCHT bleibt; Probelauf und Tageskennzahlen: ganz weg.
import { test, expect } from '@playwright/test';
import { oeffne, kurzerBlock, leseDb, mockeTeilen, geteilt } from './hilfen.js';
import { leseLogbuchDatei } from '../../js/logbuchdatei.js';

test('× löscht nach Rückfrage; Studienblock bleibt als Vermerk im Logbuch, Probelauf und Tageskennzahlen ganz weg', async ({ page }, info) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await kurzerBlock(page, { phase: 'PRE' });
  await page.goto('./');
  await kurzerBlock(page, { phase: 'PRE', pseudonym: 'P000' });
  await page.goto('./');
  await page.click('[data-test=tageskennzahlen]');
  await page.click('[data-test=tag-bereich-NEPH]');
  await page.click('[data-test=tag-teilbereich-DIALYSE]');
  await page.click('[data-test=tag-speichern]');
  await expect(page.locator('[data-test=offene-liste] > li')).toHaveCount(3);
  await expect(page.locator('[data-test=banner-nicht-gesichert]')).toBeVisible();
  if (process.env.BILDER_DIR && info.project.name === 'iphone-webkit') await page.screenshot({ path: `${process.env.BILDER_DIR}/loeschen.png` });

  // Abbrechen: bleibt
  const block = page.locator('[data-test=eintrag-block]').filter({ hasText: 'P017' });
  await block.locator('[data-test=loeschen]').click();
  await expect(page.locator('[data-test=bestaetigung]')).toContainText('Wirklich löschen?');
  await page.click('[data-test=bestaetigen-nein]');
  await expect(page.locator('[data-test=offene-liste] > li')).toHaveCount(3);

  // Studienblock löschen
  const blockId = (await leseDb(page)).bloecke.find((b) => b.pseudonym === 'P017').blockId;
  await block.locator('[data-test=loeschen]').click();
  await page.click('[data-test=bestaetigen-ja]');
  await expect(page.locator('#meldung')).toHaveText('Gelöscht.');
  await expect(page.locator('[data-test=offene-liste] > li')).toHaveCount(2);
  await expect(page.locator('[data-test=banner-nicht-gesichert]')).toHaveCount(0);
  let db = await leseDb(page);
  expect(db.bloecke.map((b) => b.pseudonym)).toEqual(['P000']);
  expect(db.episoden.filter((e) => e.blockId === blockId)).toEqual([]);
  expect(db.logbuch.find((l) => l.eintragId === blockId)).toBeTruthy();
  expect(db.aenderungen.filter((a) => a.zielId === blockId).map((a) => a.art)).toEqual(['GELOESCHT']);

  // Probelauf und Tageskennzahlen löschen
  await page.locator('[data-test=eintrag-block] [data-test=loeschen]').click();
  await page.click('[data-test=bestaetigen-ja]');
  await page.locator('[data-test=eintrag-tag] [data-test=loeschen]').click();
  await page.click('[data-test=bestaetigen-ja]');
  await expect(page.locator('[data-test=keine-offenen]')).toBeVisible();
  db = await leseDb(page);
  expect(db.bloecke).toEqual([]);
  expect(db.tageskennzahlen).toEqual([]);
  expect(db.logbuch.map((l) => l.pseudonym)).toEqual(['P017']); // nur der Vermerk der Studiensitzung

  // Studie und Logbuch-Datei: gelöscht, zählt nicht
  await page.click('[data-test=menue-studie]');
  await expect(page.locator('[data-test=proband-P017]')).toContainText('0/5');
  await page.click('[data-test=proband-P017]');
  await expect(page.locator('[data-test=proband-eintraege]')).toContainText('gelöscht');
  await page.click('[data-test=zurueck]');
  await page.click('[data-test=logbuch-sichern]');
  const lb = leseLogbuchDatei((await geteilt(page)).at(-1).text);
  expect(lb.aenderungen.map((a) => a.art)).toEqual(['GELOESCHT']);
});
