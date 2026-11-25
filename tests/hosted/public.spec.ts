import { expect, test } from '@playwright/test'

test('real Supabase public browsing and anonymous route protection', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const campaignResponse = page.waitForResponse(response => response.url().includes('/rest/v1/campaigns?'))
  await page.goto('./')
  expect((await campaignResponse).ok()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Campaign archives' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)

  const armiesResponse = page.waitForResponse(response => response.url().includes('/rest/v1/armies?'))
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Armies' }).click()
  expect((await armiesResponse).ok()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Armies of the galaxy' })).toBeVisible()

  const playersResponse = page.waitForResponse(response => response.url().includes('/rest/v1/profiles?'))
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Players' }).click()
  expect((await playersResponse).ok()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Players', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Players', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByRole('alert')).toHaveCount(0)

  await page.goto('./#/account')
  await expect(page.getByRole('heading', { name: 'Authentication required' })).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Return to command' })).toBeVisible()
  expect(errors).toEqual([])
})
