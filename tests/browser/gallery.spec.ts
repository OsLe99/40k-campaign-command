import { expect, test, type Page } from '@playwright/test'

const base = 'http://127.0.0.1:5176/40k-campaign-command/'
const armyId = '10000000-0000-0000-0000-000000000001'
const battleId = '20000000-0000-0000-0000-000000000001'
const owner = '00000000-0000-0000-0000-000000000001'
const photos = [
  { id: 'portrait', object_path: `${owner}/${armyId}/portrait.png`, caption: 'Portrait force', uploaded_by: owner, uploaded_at: '2026-11-26T00:00:00Z' },
  { id: 'wide', object_path: `${owner}/${armyId}/wide.png`, caption: 'Wide battlefield', uploaded_by: owner, uploaded_at: '2026-11-26T00:00:00Z' },
]
async function fixtures(page: Page, count = 2) {
  await page.route('http://127.0.0.1:54321/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/storage/v1/object/sign/')) {
      const path = url.pathname.replace('/storage/v1/object/sign/', '')
      if (route.request().method() === 'POST') return route.fulfill({ json: { signedURL: `/object/sign/${path}?token=fixture` } })
      const portrait = path.includes('portrait')
      // Intrinsic-size image fixtures test layout only. Production uploads
      // still accept JPEG/PNG/WebP, never SVG.
      return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${portrait ? 200 : 1200}" height="${portrait ? 600 : 200}"><rect width="100%" height="100%" fill="#647857"/></svg>` })
    }
    const table = url.pathname.split('/').pop()
    let rows: object[] = []
    if (table === 'armies') rows = [{ id: armyId, owner_id: owner, name: 'Photo legion', faction: 'Imperium', subfaction: '', description: '', main_image_path: photos[0].object_path, created_at: photos[0].uploaded_at }]
    if (table === 'battles') rows = [{ id: battleId, campaign_id: 'campaign', mission: 'Photo battle', status: 'Confirmed', revision: 1, battle_date: '2026-11-26', description: '', points_limit: 2000, submitted_by: owner }]
    if (table === 'army_images' || table === 'battle_images') rows = photos.slice(0, count)
    const single = route.request().headers().accept?.includes('vnd.pgrst.object')
    return route.fulfill({ json: single ? rows[0] : rows })
  })
}
for (const kind of ['army', 'battle'] as const) {
  test(`${kind} gallery preserves portrait/wide images and supports modal keyboard and touch controls`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await fixtures(page)
    await page.goto(`${base}#/${kind === 'army' ? 'armies' : 'battles'}/${kind === 'army' ? armyId : battleId}`)
    const thumbnail = page.getByRole('button', { name: 'View photograph 1: Portrait force' })
    const preview = thumbnail.getByRole('img')
    await expect(preview).toHaveJSProperty('naturalWidth', 200)
    await expect(preview).toHaveCSS('object-fit', 'contain')
    expect(await preview.evaluate(image => image.getBoundingClientRect().height <= image.parentElement!.getBoundingClientRect().height)).toBe(true)
    await thumbnail.click()
    const viewer = page.getByRole('dialog', { name: kind === 'army' ? 'Army photographs' : 'Battle photographs' })
    await expect(viewer).toBeVisible()
    await expect(viewer.getByRole('img')).toHaveJSProperty('naturalHeight', 600)
    await expect(viewer.getByRole('img')).toHaveCSS('object-fit', 'contain')
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
    await expect(viewer.getByRole('status')).toHaveText('1 / 2')
    await viewer.getByRole('button', { name: 'Next photograph' }).click()
    await expect(viewer.getByRole('img', { name: 'Wide battlefield' })).toHaveJSProperty('naturalWidth', 1200)
    await expect(viewer.getByRole('status')).toHaveText('2 / 2')
    await page.keyboard.press('ArrowRight')
    await expect(viewer.getByRole('status')).toHaveText('1 / 2')
    await page.keyboard.press('ArrowLeft')
    await expect(viewer.getByRole('status')).toHaveText('2 / 2')
    await viewer.getByRole('button', { name: 'Previous photograph' }).click()
    await expect(viewer.getByRole('status')).toHaveText('1 / 2')
    await viewer.getByRole('button', { name: 'Close photo viewer' }).focus()
    await page.keyboard.press('Shift+Tab')
    await expect(viewer.getByRole('button', { name: 'Next photograph' })).toBeFocused()
    expect(await viewer.evaluate(dialog => {
      const bounds = dialog.getBoundingClientRect()
      return bounds.left >= 0 && bounds.top >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight
    })).toBe(true)
    await page.keyboard.press('Escape')
    await expect(viewer).toHaveCount(0)
    await expect(thumbnail).toBeFocused()
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
    await thumbnail.click()
    await page.mouse.click(2, 2)
    await expect(viewer).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
}
test('single-image gallery disables navigation and army cards do not crop photos', async ({ page }) => {
  await fixtures(page, 1)
  await page.goto(`${base}#/armies`)
  const card = page.getByRole('link', { name: /Photo legion/ })
  await expect(card.getByRole('img')).toHaveCSS('object-fit', 'contain')
  await card.click()
  await page.getByRole('button', { name: 'View photograph 1: Portrait force' }).click()
  const viewer = page.getByRole('dialog')
  await expect(viewer.getByRole('button', { name: 'Next photograph' })).toBeDisabled()
  await expect(viewer.getByRole('button', { name: 'Previous photograph' })).toBeDisabled()
  await viewer.getByRole('button', { name: 'Close photo viewer' }).click()
  await expect(viewer).toHaveCount(0)
})
