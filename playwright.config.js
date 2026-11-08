import { defineConfig, devices } from '@playwright/test';

const PORT = 8123;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    // Wie die App vom Home-Bildschirm (sonst greift im iPhone-Profil die Safari-Tab-Sperre, tests/server.js)
    storageState: { cookies: [{ name: 'hx-installiert', value: '1', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' }], origins: [] },
    // Service Worker nur in tests/e2e/offline.spec.js aktiv, damit page.route() sonst alle Anfragen sieht
    serviceWorkers: 'block',
  },
  webServer: {
    command: `node tests/server.js ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    // iPhone-Profil mit WebKit (entspricht Safari) und zusätzlich mit Chromium
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'iphone-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
});
