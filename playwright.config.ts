import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'es-AR',
    // Skip onboarding by default; onboarding.spec.ts starts from a clean state.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:4173',
          localStorage: [{ name: 'vuelto-onboarded', value: '1' }],
        },
      ],
    },
  },
  projects: [
    {
      name: 'iphone-15',
      use: { ...devices['iPhone 15'] },
      // Playwright's WebKit build for Windows intermittently crashes the tab during view
      // transitions that involve Inicio (never seen in Chromium). Retries keep the suite usable;
      // crashes still show up as "flaky" in the report. Pending check on a real iPhone.
      retries: 2,
    },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    {
      // Small low-end Android.
      name: 'android-360',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
