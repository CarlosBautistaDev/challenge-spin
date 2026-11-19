import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: process.env.E2E_DEMO_DISABLED === 'true' ? './tests/smoke' : './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    timezoneId: 'America/Mexico_City',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command:
      process.env.E2E_PRODUCTION === 'true'
        ? 'npm run start -- --hostname 127.0.0.1 --port 3100'
        : 'NEXT_PUBLIC_DEMO_CONTROLS=true npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI && process.env.E2E_PRODUCTION !== 'true',
    timeout: 120000,
  },
});
