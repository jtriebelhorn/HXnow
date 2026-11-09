// Korrekturauftrag 09.11.2026 (Teil A): Abschnitt auf Papier nachtragen, fehlende Blockangabe nachtragen, Fragebögen in der
// Studienübersicht, Dienstarten (W2c) im Fragebogen; alles ohne PIN.
import { test, expect } from '@playwright/test';
import { oeffne, waehleCode, kurzerBlock, mockeTeilen, geteilt, leseDb } from './hilfen.js';
import { leseCsv } from '../../js/csvlesen.js';

const D = process.env.BILDER_DIR;

async function fb1Fertig(page, code, { w1b = null } = {}) {
  await page.click('[data-test=neuer-fragebogen]');
  await page.click('[data-test=fb-bogen-FB1]');
  await waehleCode(page, code);
  await page.click('[data-test=fb-bereich-NEPH]');
  await page.click('[data-test=fb-vorbereitung-weiter]');
  await page.click('[data-test=fb-start]');
  await page.click('[data-test=fb-A8b-1]');
  const danke = page.locator('[data-test=fb-danke]');
  for (let i = 0; i < 12 && !(await danke.count()); i++) {
    const vorher = await page.locator('[data-test=fb-abschnitt]').textContent();
    if (w1b !== null && (await page.locator('[data-test=fb-W1b]').count())) {
      await page.fill('[data-test=fb-W1b]', String(w1b)); await page.locator('[data-test=fb-W1b]').blur();
      if (w1b === 0) await page.click('[data-test=bestaetigen-ja]');
      w1b = null;
    }
    await page.locator('[data-test=fb-weiter], [data-test=fb-abschliessen]').click();
    // Rückfrage „noch offen“ erscheint nach dem Speichern – kurz darauf warten
    await page.locator('[data-test=bestaetigen-ja]').click({ timeout: 1500 }).catch(() => {});
    // erst weiter, wenn der nächste Abschnitt bzw. die Dankeseite steht
    await expect.poll(async () => (await danke.count()) > 0 || (await page.locator('[data-test=fb-abschnitt]').textContent().catch(() => vorher)) !== vorher).toBe(true);
  }
  await page.locator('[data-test=fb-zurueck-halten]').dispatchEvent('pointerdown');
  await page.clock.fastForward(2100);
  await expect(page.locator('[data-test=fb-status]')).toHaveText('abgeschlossen');
}

test('W1b = 0 erhoben → Abschnitt W auf Papier nachtragen: eigene Datei mit bezug_sitzung_id, kein zweiter FB1', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await fb1Fertig(page, 'N12', { w1b: 0 });
  await page.goto('./');
  await page.click('[data-test=menue-studie]');
  await expect(page.locator('[data-test=boegen-N12] .bogen-marke.erledigt')).toHaveText('FB1');
  if (D && test.info().project.name === 'iphone-webkit') await page.screenshot({ path: `${D}/studie_boegen.png` });
  await page.click('[data-test=proband-N12]');
  await page.locator('[data-test=proband-eintraege] li').first().click();
  await page.click('[data-test=abschnitt-nachtragen]');
  await page.selectOption('[data-test=nachtrag-abschnitt]', 'W');
  await page.fill('[data-test=nachtrag-datum]', '2026-12-02');
  await page.click('[data-test=aendern-ok]');
  await expect(page.locator('[data-test=fb-nachtrag]')).toContainText('Nachtrag (Papier vom 2026-12-02)');
  await expect(page.locator('[data-test=fb-fortschritt]')).toHaveText('Abschnitt 1 von 1');
  await page.fill('[data-test=fb-W1b]', '10'); await page.locator('[data-test=fb-W1b]').blur();
  await page.fill('[data-test=fb-W2b]', '3'); await page.locator('[data-test=fb-W2b]').blur();
  await page.click('[data-test=fb-W2c_2]');
  await page.click('[data-test=fb-W2c_9]');
  await page.fill('[data-test=fb-W2c_TXT]', 'Rufdienst'); await page.locator('[data-test=fb-W2c_TXT]').blur();
  await expect(page.locator('[data-test=fb-W2c_2]')).toHaveAttribute('aria-pressed', 'true');
  if (D && test.info().project.name === 'iphone-webkit') await page.screenshot({ path: `${D}/nachtrag_w.png`, fullPage: true });
  await page.click('[data-test=fb-W3_01_A-2]');
  await page.click('[data-test=fb-abschliessen]');
  if (await page.locator('[data-test=bestaetigen-ja]').count()) await page.click('[data-test=bestaetigen-ja]');
  await expect(page.locator('h1')).toHaveText('Nachtrag Abschnitt W abgeschlossen');
  await page.click('[data-test=exportieren]');
  const [d] = (await geteilt(page)).slice(-1);
  expect(d.name).toMatch(/^HXNOW_FB_FB1_NACHTRAG_N12_/);
  const z = leseCsv(d.text).zeilen;
  const fb1Id = (await leseDb(page)).fb_sitzungen.find((s) => !s.art).sitzungId;
  expect(z.every((r) => r.abschnitt === 'W' && r.bezug_sitzung_id === fb1Id)).toBe(true);
  expect(z.find((r) => r.item_id === 'W2c_9')).toMatchObject({ wert: '1' });
  expect(z.find((r) => r.item_id === 'W2c_TXT')).toMatchObject({ wert_text: 'Rufdienst' });
  const db = await leseDb(page);
  expect(db.logbuch.map((l) => l.art).sort()).toEqual(['FB1', 'FB1-NACHTRAG']);
  await page.goto('./');
  await page.click('[data-test=menue-studie]');
  await expect(page.locator('[data-test=summen]')).toContainText('1Fragebögen'); // Nachtrag zählt nicht als Bogen
});

test('Block ohne Arbeitskontext und Dienst: fehlende Angabe nachtragen (ohne PIN), Rohdaten bleiben', async ({ page }) => {
  await oeffne(page);
  await page.click('[data-test=neuer-block]');
  await waehleCode(page, 'P030');
  await page.click('[data-test=phase-PRE]');
  await page.click('[data-test=bereich-NEPH]');
  await page.click('[data-test=block-starten]'); // ohne Kontext und Dienst möglich (nicht Pflicht)
  await page.click('[data-test=o-O1]'); await page.click('[data-test=t-T1]');
  await page.clock.fastForward('16:00');
  await expect(page.locator('[data-test=abschluss-status]')).toHaveText('Regulär beendet');
  await page.goto('./');
  await page.click('[data-test=menue-studie]');
  await page.click('[data-test=proband-P030]');
  await page.locator('[data-test=proband-eintraege] li').first().click();
  await page.click('[data-test=fehlende-angabe]');
  await page.selectOption('[data-test=nachtrag-arbeitskontext]', 'K4');
  await page.selectOption('[data-test=nachtrag-dienst]', 'S');
  await page.click('[data-test=aendern-ok]');
  await page.click('[data-test=spaeter-sichern]');
  await expect(page.locator('[data-test=eintrag-eckdaten]')).toContainText('K4');
  await expect(page.locator('[data-test=verlauf]')).toContainText('Arbeitskontext nachgetragen: K4');
  await expect(page.locator('[data-test=fehlende-angabe]')).toHaveCount(0);
  const db = await leseDb(page);
  expect(db.bloecke[0]).toMatchObject({ arbeitskontext: null, dienst: null });
  expect(db.aenderungen.map((a) => [a.art, a.feld, a.neu]).sort()).toEqual([['NACHTRAG_FELD', 'arbeitskontext', 'K4'], ['NACHTRAG_FELD', 'dienst', 'S']]);
});
