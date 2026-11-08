// Probandenverwaltung: frei wählbarer Code, Liste beim Antippen, „Neuen Probanden anlegen“, Vermerk im Logbuch.
import { test, expect } from '@playwright/test';
import { oeffne, leseDb, mockeTeilen, geteilt } from './hilfen.js';
import { leseLogbuchDatei } from '../../js/logbuchdatei.js';

const D = process.env.BILDER_DIR;

test('Antippen zeigt alle Probanden, Tippen filtert, unbekannter Code → „Neuen Probanden anlegen“', async ({ page }, info) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await page.click('[data-test=neuer-block]');
  await page.click('[data-test=pseudonym]');
  await expect(page.locator('[data-test=code-treffer]')).toContainText('Noch keine Probanden');
  await page.fill('[data-test=pseudonym]', 'neph a');
  await expect(page.locator('[data-test=pseudonym-fehler]')).toContainText('keine Leerzeichen');
  await expect(page.locator('[data-test=code-anlegen]')).toHaveCount(0);
  for (const code of ['neph-a', 'OA3', 'ZNA-2']) {
    await page.fill('[data-test=pseudonym]', code);
    await expect(page.locator('[data-test=code-anlegen]')).toHaveText(`Neuen Probanden anlegen: ${code.toUpperCase()}`);
    await page.click('[data-test=code-anlegen]');
    await expect(page.locator('[data-test=code-gewaehlt]')).toContainText(code.toUpperCase());
  }
  // erneut: Feld leeren und antippen → Liste aller drei, Tippen filtert, Auswahl per Tipp
  await page.fill('[data-test=pseudonym]', '');
  await page.click('[data-test=bereich-NEPH]');
  await page.click('[data-test=pseudonym]');
  await expect(page.locator('[data-test=code-liste] button')).toHaveCount(3);
  if (D && info.project.name === 'iphone-webkit') await page.screenshot({ path: `${D}/probanden_liste.png` });
  await page.fill('[data-test=pseudonym]', 'A');
  await expect(page.locator('[data-test=code-liste] button')).toHaveCount(3); // NEPH-A, OA3, ZNA-2 enthalten „A“
  await page.fill('[data-test=pseudonym]', 'NEPH');
  await expect(page.locator('[data-test=code-liste] button')).toHaveCount(1);
  await expect(page.locator('[data-test=code-anlegen]')).toHaveText('Neuen Probanden anlegen: NEPH');
  await page.click('[data-test=code-NEPH-A]');
  await expect(page.locator('[data-test=pseudonym]')).toHaveValue('NEPH-A');
  await expect(page.locator('[data-test=code-liste]')).toHaveCount(0);
  await expect(page.locator('[data-test=code-gewaehlt]')).toContainText('NEPH-A');

  // im Logbuch vermerkt: Teilnehmerliste mit Anlagedatum
  const db = await leseDb(page);
  expect(db.teilnehmende.map((t) => t.pseudonym).sort()).toEqual(['NEPH-A', 'OA3', 'ZNA-2']);
  expect(db.teilnehmende.every((t) => t.registriertTs > 0 && t.status === 'aktiv')).toBe(true);
  await page.goto('./');
  await page.click('[data-test=logbuch-sichern]');
  const lb = leseLogbuchDatei((await geteilt(page)).at(-1).text);
  expect(lb.teilnehmende.map((t) => t.pseudonym).sort()).toEqual(['NEPH-A', 'OA3', 'ZNA-2']);
  await page.click('[data-test=menue-studie]');
  await expect(page.locator('[data-test=summen]')).toContainText('3Probanden');
  if (D && info.project.name === 'iphone-webkit') await page.screenshot({ path: `${D}/studie_kurz.png`, fullPage: true });
});
