import { expect, test, type Page } from '@playwright/test'

const base = 'http://127.0.0.1:5176/40k-campaign-command/'
const owner = '00000000-0000-0000-0000-000000000001'
const armyId = '10000000-0000-0000-0000-000000000001'
const listId = '30000000-0000-0000-0000-000000000001'
const initial = {
  id: listId, army_id: armyId, uploaded_by: owner,
  object_path: `${owner}/${armyId}/${listId}.json`, label: 'Original roster',
  file_name: 'original.json', file_extension: 'json', file_size: 200, uploaded_at: '2026-11-26T00:00:00Z',
}
async function fixtures(page: Page, signedIn: boolean) {
  const expires = Math.floor(Date.now() / 1000) + 3600
  const user = { id: owner, email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
  if (signedIn) {
    const access = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: expires })).toString('base64url')}.fixture-signature`
    await page.addInitScript(({ access, expires, user }) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: access, refresh_token: 'fixture-refresh', expires_at: expires, expires_in: 3600, token_type: 'bearer', user }))
    }, { access, expires, user })
  }
  let lists = [initial]
  const uploads: string[] = []
  const uploadMimes: string[] = []
  await page.route('http://127.0.0.1:54321/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.startsWith('/storage/v1/object/sign/')) {
      if (request.method() === 'POST') return route.fulfill({ json: { signedURL: `/object/sign/army-lists/${initial.object_path}?token=fixture` } })
      return route.fulfill({ contentType: 'application/json', headers: { 'Content-Disposition': 'attachment; filename="original.json"' }, body: '{"roster":"fixture"}' })
    }
    if (url.pathname === '/storage/v1/object/army-lists' && request.method() === 'DELETE') return route.fulfill({ json: [] })
    if (url.pathname.startsWith('/storage/v1/object/army-lists/')) {
      uploads.push(url.pathname)
      uploadMimes.push(request.postDataBuffer()?.toString().match(/Content-Type: ([^\r\n]+)/i)?.[1] || '')
      return route.fulfill({ json: { Key: url.pathname, Id: 'fixture-object' } })
    }
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user })
    const table = url.pathname.split('/').pop()
    let rows: object[] = []
    if (table === 'armies') rows = [{ id: armyId, owner_id: owner, name: 'Test legion', faction: 'Imperium', subfaction: '', description: 'Existing lore stays unchanged.', main_image_path: null, created_at: initial.uploaded_at }]
    if (table === 'profiles') rows = [{ id: owner, username: 'fixture', display_name: 'Fixture commander', theme: 'imperium' }]
    if (table === 'army_lists') {
      if (request.method() === 'POST') {
        const row = { ...request.postDataJSON(), uploaded_at: initial.uploaded_at }
        lists = [...lists, row]
        return route.fulfill({ status: 201, body: '' })
      }
      const id = url.searchParams.get('id')?.replace('eq.', '')
      if (request.method() === 'DELETE') {
        lists = lists.filter(list => list.id !== id)
        return route.fulfill({ json: [{ id }] })
      }
      rows = id ? lists.filter(list => list.id === id) : lists
    }
    const single = request.headers().accept?.includes('vnd.pgrst.object')
    return route.fulfill({ json: single ? rows[0] : rows })
  })
  return { uploads, uploadMimes }
}
test('visitors can download lists without upload or removal controls', async ({ page }) => {
  await fixtures(page, false)
  await page.goto(`${base}#/armies/${armyId}`)
  await expect(page.getByRole('heading', { name: 'Army lists', exact: true })).toBeVisible()
  await expect(page.getByLabel('Army list file')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Remove Original roster' })).toHaveCount(0)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Original roster' }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('original.json')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('owners attach, refresh, and remove a list without changing existing army content', async ({ page }) => {
  const { uploads, uploadMimes } = await fixtures(page, true)
  await page.goto(`${base}#/armies/${armyId}`)
  await expect(page.getByText(/Anyone viewing this public army page/)).toBeVisible()
  await page.getByLabel('Army list file').setInputFiles({ name: 'newrecruit.ros', mimeType: 'application/octet-stream', buffer: Buffer.from('<roster />') })
  await page.getByLabel('List label (optional)').fill('November list')
  await page.getByRole('button', { name: 'Attach list', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'November list', exact: true })).toBeVisible()
  expect(uploads).toHaveLength(1)
  expect(uploads[0]).toMatch(new RegExp(`${owner}/${armyId}/[0-9a-f-]{36}\\.ros$`))
  expect(uploadMimes).toEqual(['application/xml'])
  await page.reload()
  await expect(page.getByRole('heading', { name: 'November list', exact: true })).toBeVisible()
  await expect(page.getByText('Existing lore stays unchanged.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Original roster' })).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Remove November list' }).click()
  await expect(page.getByRole('heading', { name: 'November list', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Original roster' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
