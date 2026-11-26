import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env }
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
assert(url && key?.startsWith('sb_publishable_'), 'Configure a project URL and publishable key before hosted verification.')
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

for (const table of ['campaigns', 'profiles', 'armies', 'campaign_members', 'campaign_armies', 'battles', 'battle_participants', 'battle_responses', 'army_images', 'army_lists', 'battle_images', 'global_admins', 'moderation_log', 'standings']) {
  const { error } = await client.from(table).select('*', { head: true }).limit(1)
  assert.equal(error, null, `Anonymous read failed for ${table}: ${error?.message}`)
}
console.log('PASS: all 14 table/view read endpoints respond through the real Data API.')

const metricNames = ['played', 'wins', 'draws', 'opponents', 'best_campaign', 'completed_campaigns']
const nonexistentPlayer = crypto.randomUUID()
for (const args of [{ target_player: nonexistentPlayer }, { target_player: nonexistentPlayer, target_campaign: crypto.randomUUID() }]) {
  const { data, error } = await client.rpc('achievement_summary', args)
  assert.equal(error, null, `Read-only achievement RPC failed: ${error?.message}`)
  assert.equal(data?.length, 1, 'Achievement summary must return exactly one row.')
  assert(metricNames.every(name => data[0][name] === 0), 'Nonexistent players must have zero visible progress.')
}
console.log('PASS: anonymous overall/scoped achievement summaries respond without creating records.')

const rpc = await client.rpc('create_campaign', { data: { name: 'Unauthorized verification attempt' } })
assert.equal(rpc.error?.code, '42501', 'Anonymous write RPC must be denied by grants.')
const directWrite = await client.from('battles').update({ status: 'Confirmed' }).eq('id', crypto.randomUUID())
assert.equal(directWrite.error?.code, '42501', 'Anonymous direct battle updates must be denied.')
console.log('PASS: anonymous write RPC and direct battle updates are denied.')

const response = await fetch(new URL('/auth/v1/settings', url), { headers: { apikey: key } })
assert(response.ok, `Auth settings endpoint returned HTTP ${response.status}.`)
const settings = await response.json()
assert.equal(settings.external?.email, true, 'Email authentication must be enabled.')
assert.equal(settings.mailer_autoconfirm, false, 'Email confirmation must be enabled.')
console.log('PASS: Auth is reachable, email authentication is enabled, and email confirmation is required.')
