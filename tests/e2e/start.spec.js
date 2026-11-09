import { test, expect } from '@playwright/test';
const SCHEMA_VERSION = JSON.parse(readFileSync(new URL('../../kodierschema.json', import.meta.url), 'utf8')).schemaVersion;
import { readFileSync } from 'node:fs';

const SCHEMA = JSON.parse(readFileSync(new URL('../../kodierschema.json', import.meta.url), 'utf8'));

// Service Worker blockieren, damit page.route() alle Anfragen sieht.
test.use({ serviceWorkers: 'block' });

test('App lädt, Schema ist gültig, Startseite erscheint', async ({ page }) => {
  const fremde = [];
  const konsolenFehler = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:8123/')) fremde.push(r.url()); });
  page.on('console', (m) => { if (m.type() === 'error') konsolenFehler.push(m.text()); });

  await page.goto('./');
  await expect(page.locator('[data-test=neuer-block]')).toBeEnabled();
  await expect(page.locator('[data-test=info]')).toContainText(`Schema-Version ${SCHEMA_VERSION}`);
  await expect(page.locator('[data-test=schema-fehler]')).toHaveCount(0);

  expect(fremde).toEqual([]);
  expect(konsolenFehler).toEqual([]);
});

test('CSP ist im Kopf gesetzt', async ({ page }) => {
  await page.goto('./');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("script-src 'self'");
});

test('fehlerhaftes Schema → verständliche Fehlermeldung, kein Blockstart', async ({ page }) => {
  const kaputt = structuredClone(SCHEMA);
  kaputt.taetigkeiten.find((t) => t.code === 'T3').nurPhase = 'NACH';
  kaputt.orte.push({ code: 'O1', label: 'Doppelt' });
  await page.route('**/kodierschema.json', (route) => route.fulfill({ json: kaputt }));

  await page.goto('./');
  const meldung = page.locator('[data-test=schema-fehler]');
  await expect(meldung).toBeVisible();
  await expect(meldung).toContainText('es kann kein Block gestartet werden');
  await expect(meldung).toContainText('unbekannte Phase „NACH“');
  await expect(meldung).toContainText('Code „O1“ kommt mehrfach vor');
  await expect(page.locator('[data-test=neuer-block]')).toBeDisabled();
});

test('kein gültiges JSON → Fehlermeldung', async ({ page }) => {
  await page.route('**/kodierschema.json', (route) => route.fulfill({ body: '{ kaputt', contentType: 'application/json' }));
  await page.goto('./');
  await expect(page.locator('[data-test=schema-fehler]')).toContainText('kein gültiges JSON');
});

test('Datei fehlt → Fehlermeldung', async ({ page }) => {
  await page.route('**/kodierschema.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('./');
  await expect(page.locator('[data-test=schema-fehler]')).toContainText('HTTP 404');
});
