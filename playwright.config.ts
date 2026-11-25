import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.platform === 'win32' ? 'msedge' : undefined } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium', channel: process.platform === 'win32' ? 'msedge' : undefined } },
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
      url: 'http://127.0.0.1:5175/40k-campaign-command/',
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
      reuseExistingServer: false,
    },
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5176 --strictPort',
      url: 'http://127.0.0.1:5176/40k-campaign-command/',
      env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_browser_test_fixture' },
      reuseExistingServer: false,
    },
  ],
})
