import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'

const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env }
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Configure Supabase before running hosted browser checks.')
}
const basePath = env.VITE_BASE_PATH || '/40k-campaign-command/'
const baseURL = `http://localhost:5177${basePath}`

export default defineConfig({
  testDir: './tests/hosted',
  fullyParallel: true,
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.platform === 'win32' ? 'msedge' : undefined } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium', channel: process.platform === 'win32' ? 'msedge' : undefined } },
  ],
  webServer: {
    command: 'npm run dev -- --host localhost --port 5177 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  },
})
