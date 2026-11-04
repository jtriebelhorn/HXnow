// Phase 5: Offline-Betrieb und Update-Ablauf mit echtem Service Worker
// (ersetzt die Lighthouse-PWA-Prüfung, ENTSCHEIDUNGEN Nr. 5).
import { test, expect } from '@playwright/test';
import { oeffne, starteBlock, tippe, leseDb } from './hilfen.js';

test.use({ serviceWorkers: 'allow' });

const NEUE_VERSION = '9.9.9-test';

/** Wartet, bis der Service Worker die Seite steuert und alle Dateien im Cache liegen. */
async function warteAufOfflineBereit(page) {
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 10_000 }).toBe(true);
}

/** Lässt den Testserver eine geänderte sw.js ausliefern (Cookie) und wartet, bis die neue Version installiert ist. */
async function stelleNeueVersionBereit(page) {
  await page.context().addCookies([{ name: 'sw-test-version', value: NEUE_VERSION, url: page.url() }]);
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting)),
    { timeout: 10_000 }).toBe(true);
}

const cacheNamen = (page) => page.evaluate(() => caches.keys());

test('Manifest, Icons und iOS-Tags werden ausgeliefert', async ({ page, request }) => {
  await page.goto('./');
  const manifest = await (await request.get('manifest.webmanifest')).json();
  for (const icon of manifest.icons) {
    const r = await request.get(icon.src);
    expect(r.ok(), icon.src).toBe(true);
    expect(r.headers()['content-type']).toBe('image/png');
  }
  expect(await page.locator('link[rel=apple-touch-icon]').getAttribute('href')).toBe('icons/icon-180.png');
  expect((await request.get('icons/icon-180.png')).ok()).toBe(true);
});

test('Start im Flugmodus: App lädt aus dem Cache, Block lässt sich kodieren', async ({ page, context }) => {
  await oeffne(page);
  await warteAufOfflineBereit(page);
  await page.click('[data-test=menue-info]');
  await expect(page.locator('[data-test=info-offline]')).toHaveText('ja');

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-test=neuer-block]')).toBeVisible();
  await expect(page.locator('[data-test=schema-fehler]')).toHaveCount(0);

  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.clock.fastForward('00:30');
  await tippe(page, 't-T5');
  const daten = await leseDb(page);
  expect(daten.episoden.filter((e) => !e.geloescht)).toHaveLength(2);
});

test('Neue Version während eines laufenden Blocks: kein Neuladen, kein Hinweis, Block läuft weiter', async ({ page }) => {
  await oeffne(page);
  await warteAufOfflineBereit(page);
  await starteBlock(page);
  await tippe(page, 'o-O1');
  await tippe(page, 't-T1');
  await page.evaluate(() => { window.__nichtNeuGeladen = true; });

  await stelleNeueVersionBereit(page);

  // Die neue Version wartet; die laufende Seite bleibt unangetastet.
  await page.clock.fastForward('00:20');
  await tippe(page, 't-T5');
  expect(await page.evaluate(() => window.__nichtNeuGeladen)).toBe(true);
  await expect(page.locator('[data-test=countdown]')).toBeVisible();
  await expect(page.locator('[data-test=update-hinweis]')).toHaveCount(0);
  expect(await page.evaluate(() => navigator.serviceWorker.controller.state)).toBe('activated');
  expect(await cacheNamen(page)).toContain('hxnow-beobachtung-0.5.4');
  expect((await leseDb(page)).episoden.filter((e) => !e.geloescht)).toHaveLength(2);
});

test('Neue Version auf der Startseite: Hinweis, „Jetzt aktualisieren“ lädt neu, Daten bleiben', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('[data-test=neuer-block]')).toBeVisible();
  await warteAufOfflineBereit(page);
  await page.click('[data-test=nicht-angetroffen]');
  await page.fill('[data-test=pseudonym]', 'P017');
  await page.click('[data-test=phase-PRE]');
  await page.click('[data-test=versuch-speichern]');
  await expect(page.locator('[data-test=eintrag-versuch]')).toHaveCount(1);
  const vorher = await leseDb(page);

  await stelleNeueVersionBereit(page);
  await expect(page.locator('[data-test=update-hinweis]')).toBeVisible();

  await Promise.all([page.waitForEvent('load'), page.click('[data-test=update-jetzt]')]);
  await expect.poll(() => cacheNamen(page), { timeout: 10_000 }).toEqual([`hxnow-beobachtung-${NEUE_VERSION}`]);
  await expect(page.locator('[data-test=neuer-block]')).toBeVisible();
  await expect(page.locator('[data-test=update-hinweis]')).toHaveCount(0);
  expect(await leseDb(page)).toEqual(vorher);
});
