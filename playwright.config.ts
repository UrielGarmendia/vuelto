import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Five projects share the machine; software-rendered WebKit paints the relief shadows slowly.
  timeout: 60_000,
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
  // No device is primary: engines, input types and sizes are covered equally.
  projects: [
    {
      name: 'phone-webkit',
      use: { ...devices['iPhone 15'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'phone-android',
      use: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 } },
    },
    {
      name: 'phone-small',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 },
    },
    { name: 'tablet', use: { ...devices['iPad Pro 11'], viewport: { width: 820, height: 1180 } } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
