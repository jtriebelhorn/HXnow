// Konfiguration für den Prüf-Workflow (npm run pruefen): realitätsnahe Simulation im iPhone-Profil.
import { defineConfig, devices } from '@playwright/test';

const PORT = 8123;

export default defineConfig({
  testDir: 'tests/workflow',
  reporter: [['list']],
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}/`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    serviceWorkers: 'block',
    // Jede Bedienaktion muss zügig möglich sein; sonst sofort mit Fehlerstelle abbrechen
    actionTimeout: 10_000,
  },
  expect: { timeout: 10_000 },
  webServer: {
    command: `node tests/server.js ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    // Standard: Safari-Engine wie auf dem Dienst-iPhone (Touch-Bedienung)
    { name: 'iphone-safari', use: { ...devices['iPhone 13'] } },
    { name: 'iphone-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
});
