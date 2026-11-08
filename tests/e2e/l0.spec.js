// Phase L0: Update-Suche, Sperre bei offenem Fragebogen, Datenbank-Migration, Safari-Tab-Sperre, Testversion.
import { test, expect } from '@playwright/test';
import { oeffne, starteBlock, tippe, leseDb } from './hilfen.js';

test.describe('mit Service Worker', () => {
  test.use({ serviceWorkers: 'allow' });

  async function bereit(page) {
    await oeffne(page);
    await page.clock.resume(); // Warten auf die Installation braucht laufende Zeit
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 10_000 }).toBe(true);
  }

  test('Nach Updates suchen: aktuell, neue Version (mit Hinweis), keine Verbindung', async ({ page, context }) => {
    await bereit(page);
    await page.click('[data-test=update-suchen-start]');
    await expect(page.locator('[data-test=update-aktuell]')).toHaveText('Die App ist aktuell (0.7.0).');

    await context.addCookies([{ name: 'sw-test-version', value: '9.9.9-test', url: page.url() }]);
    await page.click('[data-test=menue-info]');
    await page.click('[data-test=update-suchen]');
    await expect(page.locator('[data-test=update-neu]')).toHaveText('Neue Version 9.9.9-test verfügbar (installiert: 0.7.0).', { timeout: 20_000 });
    await expect(page.locator('[data-test=update-jetzt]')).toBeVisible();

    await context.setOffline(true);
    await page.click('[data-test=update-suchen]');
    await expect(page.locator('[data-test=update-ergebnis]')).toContainText(/Keine Verbindung|Neue Version/);
  });

  test('Aktivieren gesperrt, solange ein Fragebogen offen ist', async ({ page, context }) => {
    await bereit(page);
    await page.evaluate(() => new Promise((ok) => {
      const r = indexedDB.open('hxnow-beobachtung');
      r.onsuccess = () => {
        const tx = r.result.transaction('fb_sitzungen', 'readwrite');
        tx.objectStore('fb_sitzungen').put({ sitzungId: 's1', status: 'laufend', pseudonym: 'P017', exportStatus: 'offen' });
        tx.oncomplete = () => { r.result.close(); ok(); };
      };
    }));
    await context.addCookies([{ name: 'sw-test-version', value: '9.9.9-test', url: page.url() }]);
    await page.click('[data-test=update-suchen-start]');
    await page.click('[data-test=update-jetzt]', { timeout: 20_000 });
    await expect(page.locator('#meldung')).toContainText('Bitte zuerst den laufenden Block bzw. Fragebogen abschließen.');
    await expect(page.locator('[data-test=dialog-update]')).toHaveCount(0);
  });
});

test('Migration Datenbank Version 2 → 3: Altdaten unverändert, neue Stores, laufender Block läuft weiter', async ({ page }) => {
  await page.goto('./icons/icon-180.png'); // gleiche Herkunft, App noch nicht geladen
  const alt = await page.evaluate(() => new Promise((ok, fehler) => {
    const r = indexedDB.open('hxnow-beobachtung', 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      const b = d.createObjectStore('bloecke', { keyPath: 'blockId' }); b.createIndex('status', 'status'); b.createIndex('exportStatus', 'exportStatus');
      d.createObjectStore('episoden', { keyPath: 'episodeId' }).createIndex('blockId', 'blockId');
      d.createObjectStore('pausen', { keyPath: 'pauseId' }).createIndex('blockId', 'blockId');
      d.createObjectStore('versuche', { keyPath: 'versuchId' }).createIndex('exportStatus', 'exportStatus');
      d.createObjectStore('tageskennzahlen', { keyPath: ['datum', 'bereich'] }).createIndex('exportStatus', 'exportStatus');
      d.createObjectStore('meta', { keyPath: 'schluessel' });
    };
    r.onsuccess = () => {
      const jetzt = Date.now();
      const daten = {
        bloecke: [{ blockId: 'b-alt', status: 'laufend', exportStatus: 'offen', pseudonym: 'P017', phase: 'PRE', bereich: 'NEPH', beobachter: 'B1', dienst: null, arbeitskontext: null, blockDauerSek: 900, startTs: jetzt - 60_000, endTs: null, endeArt: null, endeGrund: '', abbruchCode: null, kommentar: '', hxGeraetMarkiertTs: null, hxGeraetAutomatisch: false, hxGeraetDabei: null, schemaVersion: '0.3', appVersion: '0.6.0', geraeteId: 'g-alt' }],
        episoden: [{ episodeId: 'e-alt', blockId: 'b-alt', nr: 1, startTs: jetzt - 60_000, erfasstTs: jetzt - 59_000, ort: 'O1', taetigkeit: 'T1', nutzungsart: null, haltung: null, offeneZusaetze: ['nutzungsart'], neben: [], nebenNutzung: {}, nebenHaltung: {}, kommentar: '', geloescht: false, unvollstaendig: false }],
        pausen: [], versuche: [{ versuchId: 'v-alt', pseudonym: 'P018', exportStatus: 'bestaetigt' }],
        tageskennzahlen: [{ datum: '2026-11-01', bereich: 'NEPH', exportStatus: 'offen' }],
        meta: [{ schluessel: 'geraeteId', wert: 'g-alt' }, { schluessel: 'installiertTs', wert: 1 }],
      };
      const tx = r.result.transaction(Object.keys(daten), 'readwrite');
      for (const [s, liste] of Object.entries(daten)) for (const x of liste) tx.objectStore(s).put(x);
      tx.oncomplete = () => { r.result.close(); ok(daten); };
      tx.onerror = () => fehler(tx.error);
    };
  }));
  await page.goto('./');
  await expect(page.locator('[data-test=countdown]')).toBeVisible(); // laufender Block wird fortgesetzt
  await expect(page.locator('[data-test=aktuelle-episode]')).toContainText('O1 Arztzimmer');
  const neu = await page.evaluate(() => new Promise((ok) => {
    const r = indexedDB.open('hxnow-beobachtung');
    r.onsuccess = () => {
      const d = r.result;
      const tx = d.transaction([...d.objectStoreNames], 'readonly');
      const erg = { version: d.version, stores: [...d.objectStoreNames].sort() };
      for (const s of d.objectStoreNames) tx.objectStore(s).getAll().onsuccess = (e) => { erg[s] = e.target.result; };
      tx.oncomplete = () => { d.close(); ok(erg); };
    };
  }));
  expect(neu.version).toBe(3);
  expect(neu.stores).toEqual(['aenderungen', 'bloecke', 'episoden', 'fb_antworten', 'fb_sitzungen', 'logbuch', 'meta', 'pausen', 'phasenplan', 'tageskennzahlen', 'teilnehmende', 'versuche']);
  for (const s of ['episoden', 'pausen', 'versuche', 'tageskennzahlen']) expect(neu[s]).toEqual(alt[s]);
  expect(neu.bloecke[0]).toEqual(alt.bloecke[0]);
  const meta = Object.fromEntries(neu.meta.map((m) => [m.schluessel, m.wert]));
  expect(meta).toMatchObject({ geraeteId: 'g-alt', installiertTs: 1, dbVersion: 3, letzteSicherungTs: null, exportordnerText: '', stillgelegt: false });
});

test('Safari-Tab auf dem iPhone: Erfassen gesperrt, Anleitung zum Home-Bildschirm', async ({ browser }, testInfo) => {
  const ctx = await browser.newContext({ ...testInfo.project.use, storageState: undefined });
  const page = await ctx.newPage();
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => false, configurable: true }));
  await page.goto('./');
  await expect(page.locator('[data-test=tab-sperre]')).toContainText('Home-Bildschirm');
  await expect(page.locator('[data-test=neuer-block]')).toHaveCount(0);
  await ctx.close();
});

test('Desktop-Browser-Tab: erlaubt, mit Hinweisband; Testversion: eigener Datenbankname und gelbes Band', async ({ browser }, testInfo) => {
  const ctx = await browser.newContext({ ...testInfo.project.use, storageState: undefined });
  await ctx.addCookies([{ name: 'testversion', value: '1', url: testInfo.project.use.baseURL }]);
  const page = await ctx.newPage();
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => undefined, configurable: true }));
  await page.goto('./');
  await expect(page.locator('[data-test=neuer-block]')).toBeVisible();
  await expect(page.locator('[data-test=band-browser]')).toBeVisible();
  await expect(page.locator('[data-test=band-testversion]')).toHaveText('TESTVERSION – keine Studiendaten');
  const namen = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect(namen).toContain('hxnow-beobachtung-test');
  expect(namen).not.toContain('hxnow-beobachtung');
  await ctx.close();
});

test('Info zeigt Datenbank- und Definitionsversion', async ({ page }) => {
  await oeffne(page);
  await page.click('[data-test=menue-info]');
  await expect(page.locator('[data-test=info-db-version]')).toHaveText('hxnow-beobachtung, Version 3');
  await expect(page.locator('[data-test=info-definition-version]')).toHaveText('0.1.0');
});
