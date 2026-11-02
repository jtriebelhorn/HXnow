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
