import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ARMY_LIST_MAX_BYTES, armyListDownloadName, validateArmyList } from '../lib/armyLists'
import { armyLists, armyListDownload, removeArmyList, retryArmyListCleanup, uploadArmyList } from '../services/armyLists'
import type { ArmyList } from '../types/domain'

const mocks = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), remove: vi.fn(), sign: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  db: () => ({ from: mocks.from, storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, createSignedUrl: mocks.sign }) } }),
}))
const owner = '00000000-0000-0000-0000-000000000001'
const army = '10000000-0000-0000-0000-000000000001'
const id = '30000000-0000-0000-0000-000000000001'
const list: ArmyList = { id, army_id: army, uploaded_by: owner, object_path: `${owner}/${army}/${id}.json`, file_extension: 'json', file_name: 'newrecruit.json', file_size: 200, label: 'Strike Force', uploaded_at: '2026-11-26T00:00:00Z' }
function response(data: unknown, error: unknown = null) {
  const chain = Object.assign(Promise.resolve({ data, error }), {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), insert: vi.fn(), delete: vi.fn(), single: vi.fn(),
  })
  for (const method of ['select', 'eq', 'order', 'range', 'insert', 'delete', 'single'] as const) chain[method].mockReturnValue(chain)
  return chain
}
function pending() {
  const key = Object.keys(localStorage).find(k => k.startsWith('army-list-cleanup:'))!
  return { key, rows: JSON.parse(localStorage.getItem(key) || '[]') as { id: string; path: string; armyId: string }[] }
}
beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  mocks.upload.mockResolvedValue({ error: null })
  mocks.remove.mockResolvedValue({ error: null })
  mocks.from.mockImplementation(() => response([]))
})

describe('army list validation', () => {
  it.each(['json', 'ros', 'rosz', 'txt', 'pdf'])('accepts %s exports with canonical MIME, regardless of browser file type', extension => {
    const result = validateArmyList(new File(['export'], `roster.${extension.toUpperCase()}`, { type: 'application/octet-stream' }))
    expect(result.extension).toBe(extension)
    expect(result.contentType).toBeTruthy()
  })
  it('rejects unsupported, empty, oversized, long, and unsafe filenames', () => {
    for (const name of ['list.html', 'list.pdf.exe', '../list.pdf', 'folder\\list.json', 'bad\nlist.txt', `${'a'.repeat(180)}.json`]) {
      expect(() => validateArmyList({ name, size: 100 })).toThrow()
    }
    expect(() => validateArmyList({ name: 'list.json', size: 0 })).toThrow(/empty/)
    expect(() => validateArmyList({ name: 'list.json', size: ARMY_LIST_MAX_BYTES + 1 })).toThrow(/8 MiB/)
    expect(() => validateArmyList({ name: 'list.json', size: ARMY_LIST_MAX_BYTES })).not.toThrow()
    expect(armyListDownloadName('../bad\n"name.pdf')).toBe('_bad__name.pdf')
  })
})
describe('army list services', () => {
  it('uploads original bytes with a random path and preserves metadata without overwriting', async () => {
    const insert = response(null)
    mocks.from.mockReturnValueOnce(insert)
    const file = new File(['{"roster":{}}'], 'my list.json')
    await uploadArmyList(army, owner, file, ' November ')
    const [path, uploaded, options] = mocks.upload.mock.calls[0]
    expect(path).toMatch(new RegExp(`^${owner}/${army}/[0-9a-f-]{36}\\.json$`))
    expect(uploaded.name).toBe(file.name)
    expect(uploaded.size).toBe(file.size)
    expect(uploaded.type).toBe('application/json')
    const contents = await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsText(uploaded)
    })
    expect(contents).toBe('{"roster":{}}')
    expect(options).toEqual({ contentType: 'application/json', upsert: false })
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ file_name: 'my list.json', label: 'November', file_size: file.size, object_path: path }))
    expect(pending().rows).toEqual([])
  })
  it('rejects invalid files before any upload or metadata mutation', async () => {
    await expect(uploadArmyList(army, owner, new File(['bad'], 'bad.exe'), '')).rejects.toThrow(/Choose/)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('rolls back an object if the metadata insert fails', async () => {
    mocks.from.mockReturnValueOnce(response(null, new Error('Metadata failed'))).mockReturnValueOnce(response([]))
    await expect(uploadArmyList(army, owner, new File(['list'], 'roster.txt'), '')).rejects.toThrow('Metadata failed')
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0][0]])
    expect(pending().rows).toEqual([])
  })
  it('retains a cleanup intent on failure, scopes retries to account and army, then clears it', async () => {
    mocks.from.mockReturnValueOnce(response(null, new Error('Metadata failed'))).mockReturnValueOnce(response([]))
    mocks.remove.mockResolvedValueOnce({ error: new Error('Offline') })
    await expect(uploadArmyList(army, owner, new File(['list'], 'roster.txt'), '')).rejects.toThrow(/Retry list cleanup/)
    expect(pending().rows).toHaveLength(1)
    const removes = mocks.remove.mock.calls.length
    await retryArmyListCleanup('00000000-0000-0000-0000-000000000002', army)
    await retryArmyListCleanup(owner, '10000000-0000-0000-0000-000000000002')
    expect(mocks.remove).toHaveBeenCalledTimes(removes)
    await retryArmyListCleanup(owner, army)
    expect(pending().rows).toEqual([])
  })
  it('never removes an attachment whose insert succeeded despite a lost response', async () => {
    mocks.from.mockReturnValueOnce(response(null, new Error('Lost response'))).mockReturnValueOnce(response([{ id }]))
    await expect(uploadArmyList(army, owner, new File(['list'], 'roster.txt'), '')).rejects.toThrow('Lost response')
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(pending().rows).toEqual([])
  })
  it('does not delete anything when metadata lookup fails during rollback', async () => {
    mocks.from.mockReturnValueOnce(response(null, new Error('Insert failed'))).mockReturnValueOnce(response(null, new Error('Read failed')))
    await expect(uploadArmyList(army, owner, new File(['list'], 'roster.txt'), '')).rejects.toThrow(/Retry list cleanup/)
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(pending().rows).toHaveLength(1)
  })
  it('fails before upload when browser cleanup storage is unavailable', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
    try {
      await expect(uploadArmyList(army, owner, new File(['list'], 'roster.txt'), '')).rejects.toThrow('Storage blocked')
      expect(mocks.upload).not.toHaveBeenCalled()
    } finally { spy.mockRestore() }
  })
  it('creates a fresh short-lived attachment URL on demand and surfaces signing errors', async () => {
    mocks.sign.mockResolvedValueOnce({ data: { signedUrl: 'https://storage.example/download' }, error: null })
    expect(await armyListDownload(list)).toBe('https://storage.example/download')
    expect(mocks.sign).toHaveBeenCalledWith(list.object_path, 60, { download: 'newrecruit.json' })
    mocks.sign.mockResolvedValueOnce({ data: null, error: new Error('Signing failed') })
    await expect(armyListDownload(list)).rejects.toThrow('Signing failed')
  })
  it('does not remove metadata when Storage removal fails', async () => {
    mocks.from.mockReturnValueOnce(response(list))
    mocks.remove.mockResolvedValueOnce({ error: new Error('Removal failed') })
    await expect(removeArmyList(list)).rejects.toThrow('Removal failed')
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
  it('allows retrying an incomplete metadata removal using the current server path', async () => {
    const current = { ...list, object_path: list.object_path.replace('.json', '.pdf') }
    mocks.from.mockReturnValueOnce(response(current)).mockReturnValueOnce(response(null, new Error('Metadata unavailable')))
    await expect(removeArmyList(list)).rejects.toThrow(/Retry Remove/)
    expect(mocks.remove).toHaveBeenCalledWith([current.object_path])
    mocks.from.mockReturnValueOnce(response(current)).mockReturnValueOnce(response([{ id }]))
    await expect(removeArmyList(list)).resolves.toBeUndefined()
  })
  it('loads attachment lists using stable pagination', async () => {
    const first = response(Array.from({ length: 100 }, () => list))
    const second = response([])
    mocks.from.mockReturnValueOnce(first).mockReturnValueOnce(second)
    expect(await armyLists(army)).toHaveLength(100)
    expect(first.range).toHaveBeenCalledWith(0, 99)
    expect(second.range).toHaveBeenCalledWith(100, 199)
  })
})
