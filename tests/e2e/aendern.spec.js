// Änderungen und PIN (PLAN_Logbuch_Datensicherheit L4): PIN beim ersten Mal festlegen, 10 min gültig, Sperre nach
// 5 Fehlversuchen; ungültig/aufheben, Zuordnung, Phase, Kommentar, Status, eigene Phasendaten; Rohdaten unverändert;
// Logbuch sichern nach der Änderung; Änderungen stehen in der Logbuch-Datei.
import { test, expect } from '@playwright/test';
import { oeffne, kurzerBlock, mockeTeilen, geteilt, leseDb, waehleCode } from './hilfen.js';
import { leseLogbuchDatei } from '../../js/logbuchdatei.js';

async function zumEintrag(page) {
  await page.goto('./');
  await page.click('[data-test=menue-studie]');
  await page.click('[data-test=proband-P017]');
  await page.locator('[data-test=proband-eintraege] li').first().click();
}

test('Korrekturen an einem Block mit PIN; Rohdaten unverändert; Logbuch-Datei enthält die Änderungen', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await kurzerBlock(page, { phase: 'PRE' });
  await page.goto('./');
  // zweiter Code für die Zuordnung
  await page.click('[data-test=nicht-angetroffen]');
  await waehleCode(page, 'P018');
  await page.goto('./');
  const vorher = (await leseDb(page)).bloecke;
  await zumEintrag(page);

  // Kommentar ohne PIN
  await page.click('[data-test=kommentar-neu]');
  await page.fill('[data-test=kommentar-text]', 'Visite verlängert');
  await page.click('[data-test=aendern-ok]');
  await page.click('[data-test=spaeter-sichern]');
  await expect(page.locator('[data-test=kommentare]')).toContainText('Visite verlängert');

  // ungültig → PIN festlegen
  await page.click('[data-test=ungueltig]');
  await page.fill('[data-test=pin-neu]', '2468');
  await page.fill('[data-test=pin-wiederholen]', '2467');
  await page.click('[data-test=pin-speichern]');
  await expect(page.locator('[data-test=pin-fehler]')).toHaveText('Die beiden Eingaben stimmen nicht überein.');
  await page.fill('[data-test=pin-wiederholen]', '2468');
  await page.click('[data-test=pin-speichern]');
  await page.selectOption('[data-test=ungueltig-grund]', 'U9');
  await page.click('[data-test=aendern-ok]');
  await expect(page.locator('[data-test=aendern-fehler]')).toHaveText('Bei „Sonstiges“ bitte erläutern.');
  await page.fill('[data-test=ungueltig-text]', 'Gerät gewechselt');
  await page.click('[data-test=aendern-ok]');
  await page.click('[data-test=spaeter-sichern]');
  await expect(page.locator('[data-test=eintrag-ungueltig]')).toContainText('Sonstiges');

  // innerhalb von 10 min ohne PIN: aufheben, anderer Proband, Phase
  await page.click('[data-test=ungueltig-aufheben]');
  await page.click('[data-test=aendern-ok]');
  await page.click('[data-test=spaeter-sichern]');
  await expect(page.locator('[data-test=eintrag-ungueltig]')).toHaveCount(0);
  await page.click('[data-test=zuordnung]');
  await page.selectOption('[data-test=zuordnung-code]', 'P018');
  await page.fill('[data-test=zuordnung-text]', 'Code verwechselt');
  await page.click('[data-test=aendern-ok]');
  await page.click('[data-test=spaeter-sichern]');
  await expect(page.locator('[data-test=eintrag-pseudonym]')).toHaveText('P018 (ursprünglich P017)');
  await page.click('[data-test=phase-aendern]');
  await page.selectOption('[data-test=phase-neu]', 'POST');
  await page.fill('[data-test=phase-text]', 'falsch gewählt');
  await page.click('[data-test=aendern-ok]');
  await page.click('[data-test=jetzt-sichern]');
  await expect(page.locator('[data-test=eintrag-phase]')).toHaveText('POST (ursprünglich PRE)');
  await expect(page.locator('[data-test=verlauf] li')).toHaveCount(5);

  // Logbuch-Datei: Eintrag unverändert, Änderungen angehängt
  const [d] = await geteilt(page);
  const lb = leseLogbuchDatei(d.text);
  expect(lb.ok).toBe(true);
  expect(lb.logbuch.find((l) => l.art === 'BLOCK')).toMatchObject({ pseudonym: 'P017', phase: 'PRE' });
  expect(lb.aenderungen.sort((a, b) => a.ts - b.ts).map((a) => a.art)).toEqual(['KOMMENTAR', 'UNGUELTIG', 'UNGUELTIG_AUFGEHOBEN', 'ZUORDNUNG', 'PHASE']);
  expect((await leseDb(page)).bloecke).toEqual(vorher);
  // in der Übersicht zählt der Block jetzt bei P018 (Regelbetrieb)
  await page.goto('./');
  await page.click('[data-test=menue-studie]');
  await expect(page.locator('[data-test=proband-P017]')).not.toContainText('1/5');
});

test('PIN: 5 Fehlversuche sperren 5 Minuten; nach 10 Minuten wird erneut gefragt', async ({ page }) => {
  await oeffne(page);
  await kurzerBlock(page, { phase: 'PRE' });
  await zumEintrag(page);
  await page.click('[data-test=ungueltig]');
  await page.fill('[data-test=pin-neu]', '1357');
  await page.fill('[data-test=pin-wiederholen]', '1357');
  await page.click('[data-test=pin-speichern]');
  await page.click('[data-test=aendern-abbrechen]');
  await page.clock.fastForward('10:01');
  await page.click('[data-test=ungueltig]');
  await expect(page.locator('[data-test=dialog-pin]')).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page.fill('[data-test=pin]', '0000');
    await page.click('[data-test=pin-ok]');
    await expect(page.locator('[data-test=pin-fehler]')).toHaveText(`PIN falsch. Noch ${4 - i} ${4 - i === 1 ? 'Versuch' : 'Versuche'}.`);
  }
  await page.fill('[data-test=pin]', '0000');
  await page.click('[data-test=pin-ok]');
  await expect(page.locator('[data-test=pin-fehler]')).toContainText('gesperrt bis');
  await page.fill('[data-test=pin]', '1357');
  await page.click('[data-test=pin-ok]');
  await expect(page.locator('[data-test=pin-fehler]')).toContainText('gesperrt bis');
  await page.clock.fastForward('05:01');
  await page.fill('[data-test=pin]', '1357');
  await page.click('[data-test=pin-ok]');
  await expect(page.locator('[data-test=dialog-ungueltig]')).toBeVisible();
  const meta = await page.evaluate(() => new Promise((r) => { const o = indexedDB.open('hxnow-beobachtung'); o.onsuccess = () => { const g = o.result.transaction('meta').objectStore('meta').getAll(); g.onsuccess = () => r(g.result); }; }));
  expect(JSON.stringify(meta)).not.toContain('1357');
});

test('Proband: Status pausiert sperrt die Erfassung; eigene Phasendaten', async ({ page }) => {
  await oeffne(page);
  await kurzerBlock(page, { phase: 'PRE' });
  await page.goto('./');
  await page.click('[data-test=menue-studie]');
  await page.click('[data-test=proband-P017]');
  await page.click('[data-test=status-aendern]');
  await page.fill('[data-test=pin-neu]', '2468');
  await page.fill('[data-test=pin-wiederholen]', '2468');
  await page.click('[data-test=pin-speichern]');
  await page.selectOption('[data-test=status-neu]', 'pausiert');
  await page.click('[data-test=aendern-ok]');
  await page.click('[data-test=spaeter-sichern]');
  await expect(page.locator('[data-test=proband-status]')).toContainText('pausiert');
  await page.click('[data-test=phasendaten]');
  await page.fill('[data-test=abweichung-baselineStart]', '2026-12-01');
  await page.fill('[data-test=abweichung-text]', 'später eingestiegen');
  await page.click('[data-test=aendern-ok]');
  await page.click('[data-test=spaeter-sichern]');
  await expect(page.locator('[data-test=verlauf]')).toContainText('baselineStart: – → 2026-12-01');
  await page.goto('./');
  await page.click('[data-test=neuer-block]');
  await page.fill('[data-test=pseudonym]', 'P017');
  await expect(page.locator('[data-test=pseudonym-fehler]')).toContainText('pausiert');
});
