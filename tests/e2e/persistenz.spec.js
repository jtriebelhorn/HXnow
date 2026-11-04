// Phase 2: Wiederherstellung eines laufenden Blocks nach Neuladen.
import { test, expect } from '@playwright/test';
import { oeffne, starteBlock, tippe, leseDb, START } from './hilfen.js';

test('Block starten, 5 Episoden, Neuladen → identischer Zustand inkl. laufender Episode und Countdown', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');                         // Episode 1 (Start = Blockstart)
  await page.clock.fastForward('00:30'); await tippe(page, 't-T5');   // 2
  await page.clock.fastForward('00:45'); await tippe(page, 'o-O2');   // 3
  await page.clock.fastForward('01:00'); await tippe(page, 't-T3');   // 4
  await tippe(page, 'n-N2');                                          // ergänzt 4
  await page.clock.fastForward('00:20'); await tippe(page, 't-T6');   // 5
  await page.clock.fastForward('00:07');

  const vorher = await leseDb(page);
  const textVorher = await page.locator('[data-test=aktuelle-episode]').textContent();
  const countdownVorher = await page.locator('[data-test=countdown]').innerText();
  expect(vorher.episoden.filter((e) => !e.geloescht)).toHaveLength(5);
  expect(countdownVorher).toBe('12:18');

  await page.reload();

  // direkt in der Kodieransicht, ohne Umweg über die Startseite
  await expect(page.locator('[data-test=countdown]')).toHaveText('12:18');
  await expect(page.locator('[data-test=aktuelle-episode]')).toHaveText(textVorher);
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('#5');
  await expect(page.locator('[data-test=laufzeit]')).toHaveText('7 s');
  await expect(page.locator('[data-test=t-T6]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-test=o-O2]')).toHaveAttribute('aria-pressed', 'true');
  expect(await leseDb(page)).toEqual(vorher);

  // weiterkodieren nach dem Neuladen funktioniert
  await page.clock.fastForward('00:03');
  await tippe(page, 't-T7');
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('#6');
  const nachher = await leseDb(page);
  const e6 = nachher.episoden.find((e) => e.nr === 6);
  expect(e6.startTs - nachher.bloecke[0].startTs).toBe((30 + 45 + 60 + 20 + 7 + 3) * 1000);
});

test('Block läuft ab, während die App geschlossen ist → Abschlussseite beim Öffnen, Ende = Start + 15:00', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O4');
  await tippe(page, 't-T9');
  await page.goto('about:blank');
  await page.clock.fastForward('40:00');
  await page.goto('./');
  await expect(page.locator('[data-test=abschluss-status]')).toHaveText('Regulär beendet');
  await expect(page.locator('[data-test=abschluss-dauer]')).toHaveText('15:00 min');
  const db = await leseDb(page);
  expect(db.bloecke[0].endTs - db.bloecke[0].startTs).toBe(900_000);
  expect(db.bloecke[0].status).toBe('beendet');
});

test('jede Eingabe ist sofort gespeichert (vor der Anzeige)', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T2');
  // sobald die Taste aktiv angezeigt wird, steht die Episode in der Datenbank
  const db = await leseDb(page);
  expect(db.episoden).toHaveLength(1);
  expect(db.episoden[0]).toMatchObject({ nr: 1, taetigkeit: 'T2', ort: 'O1', startTs: db.bloecke[0].startTs });
  expect(db.bloecke[0].startTs).toBe(START.getTime());
});

test('pausierter Block: Neuladen → Pause läuft weiter, Countdown steht still, Fortsetzen möglich', async ({ page }) => {
  await oeffne(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.clock.fastForward('02:00');
  await tippe(page, 't-T6');
  await page.clock.fastForward('00:30');
  await page.click('[data-test=pause]');
  await expect(page.locator('[data-test=pause-status]')).toBeVisible();
  await page.clock.fastForward('01:10');
  const vorher = await leseDb(page);

  await page.reload();
  await expect(page.locator('[data-test=pause-status]')).toBeVisible();
  await expect(page.locator('[data-test=countdown]')).toHaveText('PAUSE 01:10');
  await expect(page.locator('[data-test=pause]')).toHaveText('Fortsetzen');
  expect(await leseDb(page)).toEqual(vorher);

  await page.click('[data-test=pausegrund-P3]');
  await expect(page.locator('[data-test=pausegrund-P3]')).toHaveAttribute('aria-pressed', 'true'); // erst nach dem Speichern markiert
  await page.reload();
  await expect(page.locator('[data-test=pausegrund-P3]')).toHaveAttribute('aria-pressed', 'true'); // Grund gespeichert
  await page.click('[data-test=pause]'); // Fortsetzen: ein Tipp
  await expect(page.locator('[data-test=countdown]')).toHaveText('12:30'); // 150 s beobachtet
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('#3');
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('O1 Arztzimmer · T6 Gespräch Kollegen/Pflege');
});
