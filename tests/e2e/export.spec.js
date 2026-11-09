// Phase 4: Export, Statusverwaltung, Datensicherung.
import { test, expect } from '@playwright/test';
import { oeffne, starteBlock, tippe, leseDb, mockeTeilen, geteilt, kurzerBlock , waehleCode } from './hilfen.js';

test('Teilen aus der Abschlussseite: direkt aus der Geste, Status offen → exportiert → bestätigt', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await kurzerBlock(page);
  await expect(page.locator('[data-test=abschluss-export]')).toHaveText('nicht exportiert');
  await expect(page.locator('[data-test=bestaetigen]')).toBeDisabled();

  await page.click('[data-test=exportieren]');
  await expect(page.locator('[data-test=abschluss-export]')).toHaveText('exportiert – Eingang noch nicht bestätigt');

  const [g] = await geteilt(page);
  expect(g.name).toMatch(/^HXNOW_BEOB_P017_20261203_0915_[0-9a-f]{8}\.csv$/);
  expect(g.titel).toBe(g.name);
  // Teilen wurde innerhalb der Nutzergeste aufgerufen (kein await davor)
  if (g.aktiv !== null) expect(g.aktiv).toBe(true);
  expect(g.text.startsWith('﻿datensatz;format_version;block_id;')).toBe(true);
  const zeilen = g.text.split('\r\n').filter(Boolean);
  expect(zeilen).toHaveLength(3);
  // …;nr;start;ende;dauer_sek;taetigkeit;ort;nutzungsart;haltung;nebentaetigkeiten;NT3;NT4;NT5;NT6;NT7;NT3_nutzung;NT3_haltung;unvollstaendig;pause_grund;pause_freitext;kommentar;n_zeilen_block
  expect(zeilen[1]).toContain(';K1;2026-12-03;2026-12-03T09:15:00+01:00;2026-12-03T09:30:00+01:00;900;900;0;0;beendet;regulaer;;;;N;0;;');
  expect(zeilen[1]).toContain(';1;2026-12-03T09:15:00+01:00;2026-12-03T09:17:00+01:00;120;T1;O1;;;;0;0;0;0;0;0;;;;0;;;;2'); // NT1 = 0, NT1_nutzung leer (Format 1.1)
  expect(zeilen[2]).toContain(';2;2026-12-03T09:17:00+01:00;2026-12-03T09:30:00+01:00;780;T5;O1;;;;0;0;0;0;0;0;;;;0;;;;2');

  let db = await leseDb(page);
  expect(db.bloecke[0].exportStatus).toBe('exportiert');
  expect(db.bloecke[0].exportiertTs).not.toBeNull();

  await page.click('[data-test=bestaetigen]');
  await page.click('[data-test=bestaetigen-ja]');
  await expect(page.locator('[data-test=abschluss-export]')).toHaveText('Eingang bestätigt');
  await expect(page.locator('[data-test=block-kommentar-speichern]')).toBeDisabled();
  db = await leseDb(page);
  expect(db.bloecke[0].exportStatus).toBe('bestaetigt');

  await page.click('[data-test=zur-startseite]');
  await expect(page.locator('[data-test=keine-offenen]')).toBeVisible();
});

test('Teilen abgebrochen → Status bleibt offen', async ({ page }) => {
  await mockeTeilen(page, 'abbruch');
  await oeffne(page);
  await kurzerBlock(page);
  await page.click('[data-test=exportieren]');
  await expect(page.locator('#meldung')).toContainText('Teilen abgebrochen');
  expect((await leseDb(page)).bloecke[0].exportStatus).toBe('offen');
  await expect(page.locator('[data-test=abschluss-export]')).toHaveText('nicht exportiert');
});

test('ohne Teilen-Funktion: Download, Rückfrage „gespeichert?“, dann exportiert', async ({ page }) => {
  await mockeTeilen(page, 'fehlt');
  await oeffne(page);
  await kurzerBlock(page);
  await page.click('[data-test=exportieren]');
  await expect(page.locator('[data-test=dialog-exportwege]')).toBeVisible();
  await expect(page.locator('[data-test=weg-mail]')).toHaveCount(0); // kein Mail-Empfänger konfiguriert
  const downloads = [];
  page.on('download', (d) => downloads.push(d));
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-test=weg-download]')]);
  expect(download.suggestedFilename()).toMatch(/^HXNOW_BEOB_P017_.*\.csv$/);
  await expect.poll(() => downloads.length).toBe(2); // Sitzungsdatei und Logbuch
  expect(downloads[1].suggestedFilename()).toMatch(/^HXNOW_Logbuch_[0-9a-f]{8}\.csv$/);
  const pfad = await download.path();
  const { readFileSync } = await import('node:fs');
  const inhalt = readFileSync(pfad);
  expect([...inhalt.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8-BOM
  await expect(page.locator('[data-test=bestaetigung]')).toContainText('Dateien gespeichert?');
  await page.click('[data-test=bestaetigen-nein]');
  expect((await leseDb(page)).bloecke[0].exportStatus).toBe('offen');

  await page.click('[data-test=andere-wege]');
  await Promise.all([page.waitForEvent('download'), page.click('[data-test=weg-download]')]);
  await page.click('[data-test=bestaetigen-ja]');
  await expect(page.locator('[data-test=abschluss-export]')).toHaveText('exportiert – Eingang noch nicht bestätigt');
});

test('Mail-Weg mit konfiguriertem Empfänger; zu lange Daten → Hinweis auf Zwischenablage', async ({ page }) => {
  await page.route('**/kodierschema.json', async (route) => {
    const antwort = await route.fetch();
    const schema = await antwort.json();
    schema.export.mailEmpfaenger = 'studie@example.org';
    await route.fulfill({ json: schema });
  });
  await mockeTeilen(page, 'fehlt');
  await oeffne(page);
  await kurzerBlock(page);
  await page.click('[data-test=andere-wege]');
  await expect(page.locator('[data-test=weg-mail]')).toBeEnabled();
  await page.click('[data-test=weg-abbrechen]');

  // Block mit vielen Episoden → mailto-URL über 8000 Zeichen
  await page.click('[data-test=zur-startseite]');
  await starteBlock(page, { pseudonym: 'P018' });
  await tippe(page, 'o-O1');
  for (let i = 0; i < 30; i++) {
    await page.clock.fastForward('00:10');
    await tippe(page, i % 2 ? 't-T1' : 't-T2');
  }
  await page.clock.fastForward('15:00');
  await page.click('[data-test=geraet-N]');
  await page.click('[data-test=andere-wege]');
  await expect(page.locator('[data-test=weg-mail]')).toBeDisabled();
  await expect(page.locator('[data-test=mail-zu-lang]')).toBeVisible();
});

test('Startseite: Versuch exportieren und Eingang bestätigen; rotes Banner verschwindet', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await page.click('[data-test=nicht-angetroffen]');
  await waehleCode(page, 'P099');
  for (const t of ['bereich-ZNA', 'dienst-N', 'phase-PRE']) await page.click(`[data-test=${t}]`);
  await page.click('[data-test=versuch-speichern]');
  await expect(page.locator('[data-test=eintrag-versuch]')).toBeVisible();
  await page.clock.fastForward('25:00:00');
  await page.reload();
  await expect(page.locator('[data-test=banner-24h]')).toBeVisible();

  const eintrag = page.locator('[data-test=eintrag-versuch]');
  await expect(eintrag.locator('[data-test=bestaetigen]')).toBeDisabled();
  await eintrag.locator('[data-test=exportieren]').click();
  await expect(eintrag).toHaveAttribute('data-export', 'exportiert');
  const [g] = await geteilt(page);
  expect(g.name).toMatch(/^HXNOW_VERSUCH_P099_20261203_0915_[0-9a-f]{8}\.csv$/);
  if (g.aktiv !== null) expect(g.aktiv).toBe(true);

  await page.locator('[data-test=eintrag-versuch] [data-test=bestaetigen]').click();
  await page.click('[data-test=bestaetigen-ja]');
  await expect(page.locator('[data-test=keine-offenen]')).toBeVisible();
  await expect(page.locator('[data-test=banner-24h]')).toHaveCount(0);
});

test('Änderung nach dem Export setzt den Status zurück auf offen', async ({ page }) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await kurzerBlock(page);
  await page.click('[data-test=exportieren]');
  await expect(page.locator('[data-test=abschluss-export]')).toHaveText('exportiert – Eingang noch nicht bestätigt');
  await page.fill('[data-test=block-kommentar]', 'Nachtrag');
  await page.click('[data-test=block-kommentar-speichern]');
  await expect(page.locator('[data-test=abschluss-export]')).toHaveText('nicht exportiert');
  const db = await leseDb(page);
  expect(db.bloecke[0]).toMatchObject({ exportStatus: 'offen', kommentar: 'Nachtrag' });
});

test('JSON-Sicherung: Export, erneuter Import ohne Dubletten, Import auf zweitem Gerät, Löschen bestätigter Einträge', async ({ page, browser }, testInfo) => {
  await mockeTeilen(page, 'erfolg');
  await oeffne(page);
  await kurzerBlock(page);
  await page.click('[data-test=exportieren]');
  await page.click('[data-test=bestaetigen]');
  await page.click('[data-test=bestaetigen-ja]');
  await page.click('[data-test=zur-startseite]');
  await page.click('[data-test=tageskennzahlen]');
  await page.click('[data-test=tag-bereich-NEPH]');
  await page.click('[data-test=tag-teilbereich-DIALYSE]');
  await page.click('[data-test=tag-aufnahmen-plus]');
  await page.click('[data-test=tag-aerzte-plus]');
  await page.click('[data-test=tag-speichern]');

  await page.click('[data-test=menue-sicherung]');
  await expect(page.locator('[data-test=anzahl-bloecke]')).toHaveText('1');
  await expect(page.locator('[data-test=anzahl-episoden]')).toHaveText('2');
  await page.click('[data-test=json-export]');
  const sicherung = (await geteilt(page)).at(-1);
  expect(sicherung.name).toMatch(/^HXNOW_Komplettsicherung_[0-9a-f]{8}_20261203_0932\.json$/);
  const vorher = await leseDb(page);

  // Erneuter Import derselben Sicherung → nichts doppelt
  await page.setInputFiles('[data-test=import-datei]', { name: sicherung.name, mimeType: 'application/json', buffer: Buffer.from(sicherung.text) });
  await expect(page.locator('[data-test=wiederherstellen-vorschau]')).toContainText('1 Datei gelesen: 1 Komplettsicherung');
  await page.click('[data-test=wiederherstellen-ja]');
  await expect(page.locator('#meldung')).toContainText('0 neu, 6 bereits vorhanden');
  expect(await leseDb(page)).toEqual(vorher);

  // Zweites Gerät (leerer Speicher)
  const ctx2 = await browser.newContext({ ...testInfo.project.use, serviceWorkers: 'block' });
  const seite2 = await ctx2.newPage();
  await seite2.goto('./');
  await expect(seite2.locator('[data-test=banner-leer]')).toContainText('Keine Studiendaten gefunden');
  await seite2.click('[data-test=leer-laden]');
  await seite2.setInputFiles('[data-test=import-datei]', { name: sicherung.name, mimeType: 'application/json', buffer: Buffer.from(sicherung.text) });
  await seite2.click('[data-test=wiederherstellen-ja]');
  await expect(seite2.locator('#meldung')).toContainText('6 neu, 0 bereits vorhanden');
  await expect(seite2.locator('[data-test=wiederherstellen-bericht]')).toContainText('Übernommen: 6 neu');
  await expect(seite2.locator('[data-test=anzahl-episoden]')).toHaveText('2');
  const db2 = await leseDb(seite2);
  expect(db2.bloecke).toEqual(vorher.bloecke);
  expect(db2.episoden.sort((a, b) => a.nr - b.nr)).toEqual(vorher.episoden.sort((a, b) => a.nr - b.nr));
  await ctx2.close();

  // Bestätigte Einträge löschen (nur der bestätigte Block, nicht die offenen Tageskennzahlen)
  await page.click('[data-test=loesche-bestaetigte]');
  await expect(page.locator('[data-test=bestaetigung]')).toContainText('1 Blöcke');
  await page.click('[data-test=bestaetigen-ja]');
  await expect(page.locator('[data-test=anzahl-bloecke]')).toHaveText('0');
  await expect(page.locator('[data-test=anzahl-episoden]')).toHaveText('0');
  await expect(page.locator('[data-test=anzahl-tageskennzahlen]')).toHaveText('1');
});

test('Import einer fremden Datei wird abgelehnt', async ({ page }) => {
  await oeffne(page);
  await page.click('[data-test=menue-sicherung]');
  await page.setInputFiles('[data-test=import-datei]', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hallo":1}') });
  await expect(page.locator('#meldung')).toContainText('keine Datensicherung');
});
