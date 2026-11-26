import { db } from '../lib/supabase'
import { validateImage } from '../lib/utils'
import type { Army, BattleInput, Campaign, Profile } from '../types/domain'
import type { Database, Json } from '../types/database'
import type { ThemeId } from '../lib/themes'

export const PAGE_SIZE = 12
export function unwrap<T>(response: { data: T; error: unknown }): NonNullable<T> {
  if (response.error) throw response.error
  return response.data as NonNullable<T>
}
export async function rpc<N extends keyof Database['public']['Functions']>(name: N, args: Database['public']['Functions'][N]['Args']) {
  const { data, error } = await db().rpc(name, args)
  if (error) throw error
  return data
}
const json = (value: object) => value as Json
async function allRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const result: T[] = []
  for (let from = 0; ; from += 500) {
    const page = unwrap(await fetchPage(from, from + 499))
    result.push(...page)
    if (page.length < 500) return result
  }
}
export const api = {
  achievementSummary: async (playerId: string, campaignId?: string) => {
    const rows = await rpc('achievement_summary', { target_player: playerId, ...(campaignId ? { target_campaign: campaignId } : {}) })
    if (!rows?.[0]) throw new Error('Achievement progress is unavailable. Please try again.')
    return rows[0]
  },
  campaigns: async (page: number) => unwrap(await db().from('campaigns').select('*').order('created_at', { ascending: false }).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)),
  campaign: async (id: string) => unwrap(await db().from('campaigns').select('*').eq('id', id).single()),
  profiles: () => allRows((from, to) => db().from('profiles').select('*').order('display_name').order('id').range(from, to)),
  profile: async (id: string) => unwrap(await db().from('profiles').select('*').eq('id', id).single()),
  members: (id: string) => allRows((from, to) => db().from('campaign_members').select('*').eq('campaign_id', id).order('joined_at').order('id').range(from, to)),
  armies: (owner?: string) => allRows((from, to) => {
    let q = db().from('armies').select('*').order('created_at', { ascending: false }).order('id')
    if (owner) q = q.eq('owner_id', owner)
    return q.range(from, to)
  }),
  army: async (id: string) => unwrap(await db().from('armies').select('*').eq('id', id).single()),
  registrations: (id: string) => allRows((from, to) => db().from('campaign_armies').select('*').eq('campaign_id', id).order('army_id').range(from, to)),
  confirmedCount: async (id: string) => {
    const { count, error } = await db().from('battles').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'Confirmed')
    if (error) throw error
    return count || 0
  },
  battles: async (id: string, page: number) => unwrap(await db().from('battles').select('*').eq('campaign_id', id).order('battle_date', { ascending: false }).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)),
  myBattles: async (id: string) => {
    const participants = await allRows((from, to) => db().from('battle_participants').select('battle_id').eq('player_id', id).order('battle_id').range(from, to))
    const batches = []
    for (let i = 0; i < participants.length; i += 100) {
      batches.push(...await allRows((from, to) => db().from('battles').select('*').in('id', participants.slice(i, i + 100).map(p => p.battle_id)).order('id').range(from, to)))
    }
    return batches.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  },
  battle: async (id: string) => unwrap(await db().from('battles').select('*').eq('id', id).single()),
  participants: async (id: string) => unwrap(await db().from('battle_participants').select('*').eq('battle_id', id)),
  responses: async (id: string) => unwrap(await db().from('battle_responses').select('*').eq('battle_id', id).order('revision', { ascending: false })),
  standings: (id: string) => allRows((from, to) => db().from('standings').select('*').eq('campaign_id', id).order('points', { ascending: false }).order('player_id').range(from, to)),
  admins: async () => unwrap(await db().from('global_admins').select('*')),
  audit: async (id?: string) => {
    let q = db().from('moderation_log').select('*').order('created_at', { ascending: false }).limit(100)
    if (id) q = q.eq('campaign_id', id)
    return unwrap(await q)
  },
  createCampaign: (data: object) => rpc('create_campaign', { data: json(data) }),
  saveCampaign: (cid: string, data: Campaign | object) => rpc('save_campaign', { cid, data: json(data) }),
  saveArmy: async (data: Pick<Army, 'name' | 'faction' | 'subfaction' | 'description'>, id?: string) =>
    unwrap(await (id ? db().from('armies').update(data).eq('id', id) : db().from('armies').insert(data)).select('*').single()),
  saveProfile: async (id: string, data: Pick<Profile, 'username' | 'display_name'>) =>
    unwrap(await db().from('profiles').update(data).eq('id', id).select('*').single()),
  saveTheme: async (id: string, theme: ThemeId) =>
    unwrap(await db().from('profiles').update({ theme }).eq('id', id).select('*').single()),
  submitBattle: (cid: string, data: BattleInput) => rpc('submit_battle', { cid, data: json(data) }),
  reviseBattle: (bid: string, revision: number, data: BattleInput) => rpc('revise_battle', { bid, expected_revision: revision, data: json(data) }),
}

export type GalleryKind = 'army' | 'battle'
export async function images(kind: GalleryKind, id: string) {
  if (kind === 'army') return unwrap(await db().from('army_images').select('*').eq('army_id', id).order('uploaded_at'))
  return unwrap(await db().from('battle_images').select('*').eq('battle_id', id).order('uploaded_at'))
}
export async function uploadImage(kind: GalleryKind, id: string, userId: string, file: File, caption: string) {
  validateImage(file)
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
  const path = `${userId}/${id}/${crypto.randomUUID()}.${ext}`
  const bucket = `${kind}-images`
  const { error } = await db().storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  try {
    const result = kind === 'army'
      ? await db().from('army_images').insert({ army_id: id, object_path: path, caption })
      : await db().from('battle_images').insert({ battle_id: id, object_path: path, caption })
    if (result.error) throw result.error
  } catch (cause) {
    const cleanup = await db().storage.from(bucket).remove([path])
    if (cleanup.error) {
      const pending: { bucket: string; path: string }[] = JSON.parse(localStorage.getItem('image-cleanup') || '[]')
      localStorage.setItem('image-cleanup', JSON.stringify([...pending, { bucket, path }]))
      throw new Error('Image metadata failed. An unused upload is queued for cleanup; use Retry cleanup in the gallery.', { cause })
    }
    throw cause
  }
}
export async function deleteImage(kind: GalleryKind, id: string, path: string) {
  // Delete the object first. If metadata removal fails, retrying is safe.
  const removed = await db().storage.from(`${kind}-images`).remove([path])
  if (removed.error) throw removed.error
  const result = await db().from(kind === 'army' ? 'army_images' : 'battle_images').delete().eq('id', id)
  if (result.error) throw result.error
}
export async function retryImageCleanup() {
  const pending: { bucket: string; path: string }[] = JSON.parse(localStorage.getItem('image-cleanup') || '[]')
  const remaining = []
  for (const item of pending) {
    if ((await db().storage.from(item.bucket).remove([item.path])).error) remaining.push(item)
  }
  localStorage.setItem('image-cleanup', JSON.stringify(remaining))
  if (remaining.length) throw new Error('Some uploads could not be cleaned up. Sign in with the original uploader and retry.')
}
