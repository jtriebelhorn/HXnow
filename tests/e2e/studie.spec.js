// Logbuch-Ansichten (PLAN_Logbuch_Datensicherheit L3): Phasenplan, Phasenvorschlag beim Blockstart, Studienübersicht
// mit Fällig-Liste, Probandentabelle und Verteilung, Detailansicht Proband, Eintragsansicht, Teilnehmerliste.
import { test, expect } from '@playwright/test';
import { oeffne, kurzerBlock, mockeTeilen, geteilt, waehleCode } from './hilfen.js';

async function phasenplan(page) {
  await page.click('[data-test=menue-studie]');
  await expect(page.locator('[data-test=kein-phasenplan]')).toBeVisible();
  await page.click('[data-test=zu-studienplan]');
  const setze = async (f, wert) => page.fill(`[data-test=plan-NEPH-${f}]`, wert);
  await setze('baselineStart', '2026-11-30');
  await setze('einfuehrungStart', '2026-11-29');
  await page.click('[data-test=plan-NEPH-speichern]');
  await expect(page.locator('[data-test=phasenplan-fehler]')).toHaveText('Beginn Einführung muss nach „Beginn Baseline“ liegen.');
  await setze('einfuehrungStart', '2026-12-14');
  await setze('regelbetriebStart', '2026-12-28');
  await setze('abschlussStart', '2027-02-01');
  await setze('ende', '2027-02-07');
  await page.click('[data-test=plan-NEPH-speichern]');
  // Phasenplan ist geschützt (L4): beim ersten Mal PIN festlegen
  await page.fill('[data-test=pin-neu]', '2468');
  await page.fill('[data-test=pin-wiederholen]', '2468');
  await page.click('[data-test=pin-speichern]');
  await expect(page.locator('#meldung')).toHaveText('Phasenplan gespeichert.');
  await page.click('[data-test=zurueck]');
  await expect(page.locator('[data-test=bereichsstand]')).toHaveText('Nephrologie: Baseline, Tag 4 von 14');
  await page.click('[data-test=zurueck]');
}

test('Phasenplan → Phasenvorschlag beim Blockstart → Übersicht, Proband, Eintrag; keine Inhalte je Person', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await phasenplan(page);

  // Phasenvorschlag: Code mit Bereich → Baseline = Prä vorausgewählt
  await page.click('[data-test=neuer-block]');
  await waehleCode(page, 'P017');
  await page.click('[data-test=bereich-NEPH]');
  await expect(page.locator('[data-test=phase-vorschlag]')).toHaveText('Vorschlag laut Phasenplan: Prä (Baseline). Bitte prüfen.');
  await expect(page.locator('[data-test=phase-PRE]')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('./');

  await kurzerBlock(page, { phase: 'PRE' });
  await page.click('[data-test=exportieren]');
  await page.click('[data-test=zur-startseite]');
  await page.click('[data-test=menue-studie]');
  await expect(page.locator('[data-test=faellig]')).toContainText('FB1 von P017 offen – Baseline endet in 11 Tagen');
  await expect(page.locator('[data-test=faellig]')).toContainText('P017: 1 von 5 Blöcken (Baseline), noch 11 Tage');
  const zeile = page.locator('[data-test=proband-P017]');
  await expect(zeile).toContainText('1/5');
  await expect(zeile).toContainText('FB1 –');
  await expect(page.locator('[data-test=verteilung-PRE]')).toContainText('Visite');
  await expect(page.locator('[data-test=verteilung-PRE] .balken-zahl').first()).toHaveText('1');
  const text = await page.locator('#app').innerText();
  expect(text).not.toMatch(/T5|Dokumentation|%/); // keine Tätigkeiten oder Anteile

  await zeile.click();
  await expect(page.locator('[data-test=proband-code]')).toHaveText('P017');
  await expect(page.locator('[data-test=bloecke-baseline]')).toHaveText('1 von 5');
  await expect(page.locator('[data-test=bogen-baseline]')).toHaveText('offen');
  await expect(page.locator('[data-test=phase-baseline]')).toContainText('30.11.2026 – 14.12.2026');
  await page.locator('[data-test=proband-eintraege] li').first().click();
  await expect(page.locator('[data-test=eintrag-pseudonym]')).toHaveText('P017');
  await expect(page.locator('[data-test=eintrag-eckdaten]')).toContainText('15 min, 0 Pausen');
  await expect(page.locator('[data-test=eintrag-eckdaten]')).toContainText('exportiert');
});

test('Teilnehmerliste: laden ergänzt fehlende Codes, Export als CSV, ungültige Zeilen werden abgewiesen', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await page.click('[data-test=menue-studie]');
  await page.click('[data-test=zu-teilnehmenden]');
  await page.setInputFiles('[data-test=teilnehmende-datei]', { name: 't.csv', mimeType: 'text/csv', buffer: Buffer.from('pseudonym;bereich;status\r\nP001;NEPH;aktiv\r\nX9;NEPH;aktiv\r\n') });
  await expect(page.locator('#meldung')).toContainText('Zeile 3: X9 ist kein gültiger Studien-Code');
  await page.setInputFiles('[data-test=teilnehmende-datei]', { name: 't.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿pseudonym;bereich;status\r\nP001;NEPH;aktiv\r\nP002;ZNA;pausiert\r\n') });
  await expect(page.locator('#meldung')).toHaveText('Teilnehmerliste: 2 neu, 0 bereits vorhanden.');
  await expect(page.locator('[data-test=tn-P002]')).toContainText('pausiert');
  await page.click('[data-test=teilnehmende-export]');
  const [d] = await geteilt(page);
  expect(d.name).toMatch(/^HXNOW_Teilnehmende_[0-9a-f]{8}_20261203_\d{4}\.csv$/);
  expect(d.text).toContain('P002;ZNA;pausiert;2026-12-03;');
  expect(d.weitere).toHaveLength(0);
  // pausierte Codes sind bei der Erfassung gesperrt
  await page.goto('./');
  await page.click('[data-test=neuer-block]');
  await page.fill('[data-test=pseudonym]', 'P002');
  await expect(page.locator('[data-test=pseudonym-fehler]')).toContainText('pausiert');
});
