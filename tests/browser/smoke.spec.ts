import { test, expect } from '@playwright/test'

const path = '/40k-campaign-command/'
const campaignId = '20000000-0000-0000-0000-000000000001'
const playerId = '00000000-0000-0000-0000-000000000001'
const campaign = {
  id: campaignId, name: 'The Ashen Reach', description: 'A narrative war across the forgotten frontier.',
  lore: 'The beacon has fallen silent.', status: 'Active', is_published: true,
  created_by: playerId, start_date: '2026-11-25', end_date: null, created_at: '2026-11-25T00:00:00Z', updated_at: '2026-11-25T00:00:00Z',
}
test('Discord sign-in starts a PKCE flow with the application base redirect', async ({ page }) => {
  await page.route('http://127.0.0.1:54321/auth/v1/authorize**', route => route.fulfill({
    status: 200, contentType: 'text/html', body: '<h1>Discord authorization fixture</h1>',
  }))
  await page.goto(`http://127.0.0.1:5176${path}#/auth`)
  await expect(page.getByRole('button', { name: 'Continue with Discord' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await page.getByRole('button', { name: 'Continue with Discord' }).click()
  await expect(page.getByRole('heading', { name: 'Discord authorization fixture' })).toBeVisible()
  const authorization = new URL(page.url())
  expect(authorization.searchParams.get('provider')).toBe('discord')
  expect(authorization.searchParams.get('redirect_to')).toBe(`http://127.0.0.1:5176${path}`)
  expect(authorization.searchParams.get('code_challenge')).toBeTruthy()
  expect(authorization.searchParams.get('code_challenge_method')).toBe('s256')
})
test('cancelled OAuth callbacks display errors without breaking auth routing', async ({ page }) => {
  for (const callback of ['?error=access_denied&error_description=Discord+authorization+cancelled#/auth', '#error=access_denied&error_description=Discord+authorization+cancelled']) {
    await page.goto(`http://127.0.0.1:5176${path}${callback}`)
    await expect(page.getByText('Discord authorization cancelled', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Return to command' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Discord' })).toBeEnabled()
  }
})
test('missing configuration gives clear setup instructions', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(`http://127.0.0.1:5175${path}`)
  await expect(page.getByRole('heading', { name: 'Establish your command link' })).toBeVisible()
  await expect(page.getByText('VITE_SUPABASE_PUBLISHABLE_KEY', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
test('public campaign browsing, standings, refresh, and route protection', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  // Fixtures exercise browser rendering/navigation only. Database security is
  // exercised independently by PostgreSQL tests, not asserted through mocks.
  await page.route('http://127.0.0.1:54321/rest/v1/**', async route => {
    const url = new URL(route.request().url())
    const table = url.pathname.split('/').pop()
    const values: Record<string, object[]> = {
      campaigns: [campaign],
      profiles: [{ id: playerId, username: 'commander', display_name: 'Commander Vale', avatar_url: null, created_at: campaign.created_at }],
      campaign_members: [{ id: 'member', campaign_id: campaignId, player_id: playerId, role: 'CampaignAdmin', is_active: true, joined_at: campaign.created_at }],
      standings: [{ campaign_id: campaignId, player_id: playerId, username: 'commander', display_name: 'Commander Vale', played: 1, wins: 1, losses: 0, draws: 0, points: 3 }],
      armies: [], campaign_armies: [], battles: [],
    }
    const rows = values[table || ''] || []
    const single = route.request().headers().accept?.includes('vnd.pgrst.object')
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(single ? rows[0] : rows) })
  })
  await page.goto(`http://127.0.0.1:5176${path}`)
  const hero = page.locator('.hero')
  await expect(hero.getByRole('heading', { name: 'Campaign command', exact: true })).toBeVisible()
  await expect(hero.getByRole('link', { name: 'Join the campaign' })).toBeVisible()
  await expect(hero.getByRole('button', { name: 'Explore the archives' })).toBeVisible()
  await expect(hero).not.toContainText(/Every battle|A lasting legacy|THE GALAXY/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByRole('heading', { name: 'Campaign archives' })).toBeVisible()
  await page.getByRole('link', { name: /The Ashen Reach/ }).click()
  await expect(page.getByRole('heading', { name: 'The Ashen Reach' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Join campaign' })).toHaveCount(0)
  await page.getByRole('button', { name: 'standings', exact: true }).click()
  await expect(page.getByRole('table')).toContainText('Commander Vale')
  await expect(page.getByRole('cell', { name: '3', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'The Ashen Reach' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.goto(`http://127.0.0.1:5176${path}#/campaigns/new`)
  await expect(page.getByRole('heading', { name: 'Authentication required' })).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Return to command' })).toBeVisible()
  expect(errors).toEqual([])
})
