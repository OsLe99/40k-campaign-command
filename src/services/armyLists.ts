import { db } from '../lib/supabase'
import { armyListDownloadName, validateArmyList } from '../lib/armyLists'
import type { ArmyList } from '../types/domain'
import { unwrap } from './api'

const bucket = () => db().storage.from('army-lists')
type PendingUpload = { id: string; armyId: string; path: string }
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const validUuid = new RegExp(`^${uuid}$`)
const validPath = new RegExp(`^${uuid}/${uuid}/${uuid}\\.(json|ros|rosz|txt|pdf)$`)
const cleanupKey = (userId: string) => `army-list-cleanup:${import.meta.env.VITE_SUPABASE_URL}:${userId}`

function pendingUploads(userId: string): PendingUpload[] {
  const value: unknown = JSON.parse(localStorage.getItem(cleanupKey(userId)) || '[]')
  if (!Array.isArray(value) || !value.every((p): p is PendingUpload =>
    p && typeof p.id === 'string' && validUuid.test(p.id) && typeof p.armyId === 'string' && validUuid.test(p.armyId)
    && typeof p.path === 'string' && validPath.test(p.path) && p.path.startsWith(`${userId}/${p.armyId}/${p.id}.`))) {
    throw new Error('The pending army-list cleanup record is invalid. Contact support before clearing browser storage.')
  }
  return value
}
function forgetUpload(userId: string, path: string) {
  localStorage.setItem(cleanupKey(userId), JSON.stringify(pendingUploads(userId).filter(p => p.path !== path)))
}
async function cleanUpload(userId: string, upload: PendingUpload) {
  // A lost HTTP response can leave a successful metadata insert. Never delete
  // the object if a linked attachment exists, even if a cleanup intent remains.
  const linked = unwrap(await db().from('army_lists').select('id').eq('object_path', upload.path))
  if (!linked.length) {
    const { error } = await bucket().remove([upload.path])
    if (error) throw error
  }
  forgetUpload(userId, upload.path)
}
export async function armyLists(armyId: string): Promise<ArmyList[]> {
  const rows: ArmyList[] = []
  for (let from = 0; ; from += 100) {
    const page = unwrap(await db().from('army_lists').select('*').eq('army_id', armyId).order('uploaded_at', { ascending: false }).order('id').range(from, from + 99))
    rows.push(...page)
    if (page.length < 100) return rows
  }
}
export async function uploadArmyList(armyId: string, userId: string, file: File, label: string) {
  const { extension, contentType } = validateArmyList(file)
  if (!validUuid.test(armyId) || !validUuid.test(userId)) throw new Error('Invalid army or commander.')
  if (label.trim().length > 120) throw new Error('List labels must be at most 120 characters.')
  const id = crypto.randomUUID()
  const path = `${userId}/${armyId}/${id}.${extension}`
  const pending = { id, armyId, path }
  // Persist the cleanup intent before uploading; if browser storage is
  // unavailable, fail before creating an object that cannot be recovered.
  localStorage.setItem(cleanupKey(userId), JSON.stringify([...pendingUploads(userId), pending]))
  try {
    const body = new File([file], file.name, { type: contentType })
    const { error } = await bucket().upload(path, body, { contentType, upsert: false })
    if (error) throw error
    const result = await db().from('army_lists').insert({
      id, army_id: armyId, uploaded_by: userId, object_path: path,
      file_name: file.name, file_extension: extension, file_size: file.size, label: label.trim(),
    })
    if (result.error) throw result.error
  } catch (cause) {
    try { await cleanUpload(userId, pending) } catch {
      throw new Error('The upload did not complete. Use Retry list cleanup with the original account in this browser before uploading again.', { cause })
    }
    throw cause
  }
  // An uncleared intent is safe: retry checks for linked metadata first.
  try { forgetUpload(userId, path) } catch { /* Preserve the successful upload. */ }
}
export async function retryArmyListCleanup(userId: string, armyId: string) {
  let failed = false
  for (const pending of pendingUploads(userId).filter(p => p.armyId === armyId)) {
    try { await cleanUpload(userId, pending) } catch { failed = true }
  }
  if (failed) throw new Error('Some army list uploads could not be cleaned up. Keep browser storage and retry with the original account.')
}
export async function armyListDownload(list: ArmyList) {
  const { data, error } = await bucket().createSignedUrl(list.object_path, 60, { download: armyListDownloadName(list.file_name) })
  if (error) throw error
  return data.signedUrl
}
export async function removeArmyList(list: ArmyList) {
  // Use current server metadata, not a path supplied by a stale UI or caller.
  const current = unwrap(await db().from('army_lists').select('*').eq('id', list.id).eq('army_id', list.army_id).single())
  const { error } = await bucket().remove([current.object_path])
  if (error) throw error
  const result = await db().from('army_lists').delete().eq('id', current.id).select('id')
  if (result.error || !result.data?.length) {
    throw new Error('The file was removed but its attachment entry could not be removed. Retry Remove to finish cleanup.', { cause: result.error })
  }
}
