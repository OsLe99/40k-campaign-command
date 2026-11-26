import { expect, test, type Page } from '@playwright/test'

const base = 'http://127.0.0.1:5176/40k-campaign-command/'
const owner = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const campaignId = '20000000-0000-0000-0000-000000000001'
const date = '2026-11-26T00:00:00Z'
const zero = { played: 0, wins: 0, draws: 0, opponents: 0, best_campaign: 0, completed_campaigns: 0 }
async function fixtures(page: Page, signedIn = false, fail = false) {
  const profiles = [
    { id: owner, username: 'commander', display_name: 'Commander Vale', avatar_url: null, theme: 'imperium', created_at: date },
    { id: other, username: 'opponent', display_name: 'Commander Ash', avatar_url: null, theme: 'imperium', created_at: date },
  ]
  if (signedIn) {
    const expires = Math.floor(Date.now() / 1000) + 3600
    const user = { id: owner, email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
    const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: expires })).toString('base64url')}.fixture-signature`
    await page.addInitScript(({ token, expires, user }) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture-refresh', expires_at: expires, expires_in: 3600, token_type: 'bearer', user }))
    }, { token, expires, user })
  }
  let corrected = false
  const requests: { target_player: string; target_campaign?: string }[] = []
  await page.route('http://127.0.0.1:54321/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: { id: owner, email: 'fixture@example.invalid', user_metadata: {}, app_metadata: {} } })
    const table = url.pathname.split('/').pop()
    if (table === 'achievement_summary') {
      const args = route.request().postDataJSON()
      requests.push(args)
      if (fail) return route.fulfill({ status: 503, json: { code: 'TEST', message: 'Achievement service unavailable' } })
      const metrics = corrected || args.target_player === other ? zero : args.target_campaign
        ? { ...zero, played: 3, wins: 1, opponents: 1, best_campaign: 3 }
        : { ...zero, played: 5, wins: 2, draws: 1, opponents: 3, best_campaign: 5 }
      return route.fulfill({ json: [metrics] })
    }
    let rows: object[] = []
    if (table === 'profiles') {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      rows = id ? profiles.filter(profile => profile.id === id) : profiles
    }
    if (table === 'campaigns') rows = [{ id: campaignId, name: 'Milestone campaign', description: '', lore: '', status: 'Active', is_published: true, created_by: owner, created_at: date, updated_at: date, start_date: null, end_date: null }]
    if (table === 'campaign_members') rows = [
      { id: 'other-member', campaign_id: campaignId, player_id: other, role: 'Member', is_active: false, joined_at: date },
      { id: 'owner-member', campaign_id: campaignId, player_id: owner, role: 'CampaignAdmin', is_active: true, joined_at: date },
    ]
    return route.fulfill({ json: route.request().headers().accept?.includes('vnd.pgrst.object') ? rows[0] : rows })
  })
  return { requests, correct: () => { corrected = true } }
}
test('profile achievements show earned and locked progress and recalculate on fresh history', async ({ page }) => {
  const data = await fixtures(page)
  await page.goto(`${base}#/players/${owner}`)
  const panel = page.getByRole('region', { name: 'Automatic achievements' })
  await expect(panel.getByText('4 / 7 milestones earned · 5 confirmed battles visible')).toBeVisible()
  await expect(panel.getByRole('progressbar', { name: 'Campaign Regular progress' })).toHaveAttribute('value', '5')
  await expect(panel.getByRole('progressbar', { name: 'Veteran Commander progress' })).toHaveAttribute('value', '5')
  expect(data.requests[0]).toEqual({ target_player: owner })
  data.correct()
  await page.reload()
  await expect(panel.getByText('0 / 7 milestones earned · 0 confirmed battles visible')).toBeVisible()
  await expect(panel.getByText('Earned', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('campaign selector defaults to the signed-in member and isolates each commander', async ({ page }) => {
  const data = await fixtures(page, true)
  await page.goto(`${base}#/campaigns/${campaignId}`)
  await page.getByRole('button', { name: 'achievements', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Campaign achievements' })
  await expect(page.getByLabel('Achievement commander')).toHaveValue(owner)
  await expect(panel.getByText('2 / 6 milestones earned · 3 confirmed battles visible')).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Veteran Commander' })).toHaveCount(0)
  expect(data.requests[0]).toEqual({ target_player: owner, target_campaign: campaignId })
  await page.getByLabel('Achievement commander').selectOption(other)
  await expect(panel.getByText('0 / 6 milestones earned · 0 confirmed battles visible')).toBeVisible()
  expect(data.requests.at(-1)).toEqual({ target_player: other, target_campaign: campaignId })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('signed-in command desk includes overall milestones', async ({ page }) => {
  await fixtures(page, true)
  await page.goto(`${base}#/account`)
  await expect(page.getByRole('heading', { name: 'Your command desk' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Automatic achievements' }).getByText('4 / 7 milestones earned · 5 confirmed battles visible')).toBeVisible()
})
test('unavailable achievements show an error rather than invented locked progress', async ({ page }) => {
  await fixtures(page, false, true)
  await page.goto(`${base}#/players/${owner}`)
  const panel = page.getByRole('region', { name: 'Automatic achievements' })
  await expect(panel.getByRole('alert')).toContainText('Achievement service unavailable')
  await expect(panel.getByRole('progressbar')).toHaveCount(0)
})
