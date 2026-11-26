// @vitest-environment node
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const pg = new PGlite()
const people = Array.from({ length: 7 }, (_, i) => `91000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`)
const armies = people.map(id => id.replace('91000000', '92000000'))
type Summary = { played: number; wins: number; draws: number; opponents: number; best_campaign: number; completed_campaigns: number }
const zero: Summary = { played: 0, wins: 0, draws: 0, opponents: 0, best_campaign: 0, completed_campaigns: 0 }

async function admin() { await pg.exec('reset role') }
async function as(player: string | null) {
  await admin()
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [player || ''])
  await pg.exec(player ? 'set role authenticated' : 'set role anon')
}
async function campaign(published = true, status = 'Active') {
  await admin()
  const { rows } = await pg.query<{ id: string }>('insert into public.campaigns(name,created_by,is_published,status) values($1,$2,$3,$4) returning id', ['Milestone campaign', people[0], published, status])
  const id = rows[0].id
  await pg.query("insert into public.campaign_members(campaign_id,player_id,role) values($1,$2,'CampaignAdmin'),($1,$3,'Member')", [id, people[0], people[1]])
  for (const army of armies) await pg.query('insert into public.campaign_armies(campaign_id,army_id) values($1,$2)', [id, army])
  return id
}
async function battle(cid: string, status = 'Confirmed', result = 'Win', others = [1]) {
  await admin()
  const { rows } = await pg.query<{ id: string }>("insert into public.battles(campaign_id,mission,battle_date,status,submitted_by) values($1,'Milestone battle','2026-11-26',$2,$3) returning id", [cid, status, people[0]])
  const id = rows[0].id
  for (const i of [0, ...others]) {
    await pg.query('insert into public.battle_participants(battle_id,player_id,army_id,result) values($1,$2,$3,$4)', [id, people[i], armies[i], i === 0 ? result : result === 'Draw' ? 'Draw' : result === 'Win' ? 'Loss' : 'Win'])
  }
  return id
}
async function summary(cid: string | null = null, player = people[0]) {
  return (await pg.query<Summary>('select * from public.achievement_summary($1,$2)', [player, cid])).rows[0]
}
beforeAll(async () => {
  await pg.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    grant usage on schema public,auth,storage to anon,authenticated;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,delete on storage.objects to anon,authenticated;
  `)
  const directory = new URL('../../supabase/migrations/', import.meta.url)
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) await pg.exec(await readFile(new URL(name, directory), 'utf8'))
  for (const [i, id] of people.entries()) {
    await pg.query('insert into auth.users values($1)', [id])
    await pg.query("insert into public.armies(id,name,faction,owner_id) values($1,'Milestone force','Test',$2)", [armies[i], id])
  }
  await pg.query('insert into public.global_admins(player_id) values($1)', [people[6]])
}, 30000)
beforeEach(async () => { await admin(); await pg.exec('begin') })
afterEach(async () => { await admin(); await pg.exec('rollback') })
afterAll(async () => { await pg.close() })

describe('automatic milestone PostgreSQL metrics', () => {
  it('returns zeros for new players and inaccessible/nonexistent scopes', async () => {
    const privateCampaign = await campaign(false)
    await battle(privateCampaign)
    await as(null)
    expect(await summary()).toEqual(zero)
    expect(await summary(privateCampaign)).toEqual(zero)
    expect(await summary('99000000-0000-0000-0000-000000000001')).toEqual(zero)
    expect(await summary(null, people[4])).toEqual(zero)
  })
  it('counts only confirmed reports', async () => {
    const cid = await campaign()
    for (const status of ['Confirmed', 'Pending', 'Disputed', 'Rejected']) await battle(cid, status)
    await as(null)
    expect(await summary()).toEqual({ ...zero, played: 1, wins: 1, opponents: 1, best_campaign: 1 })
  })
  it('aggregates complete history at and around battle thresholds', async () => {
    const cid = await campaign()
    for (let count = 1; count <= 21; count++) {
      await battle(cid)
      if ([1, 4, 5, 19, 20, 21].includes(count)) {
        await as(null)
        expect((await summary()).played).toBe(count)
        expect((await summary()).best_campaign).toBe(count)
      }
    }
  })
  it('keeps campaign totals separate rather than summing progress for Campaign Regular', async () => {
    const a = await campaign()
    const b = await campaign()
    for (let i = 0; i < 3; i++) await battle(a)
    for (let i = 0; i < 2; i++) await battle(b)
    await as(null)
    expect(await summary()).toMatchObject({ played: 5, best_campaign: 3 })
    expect(await summary(a)).toMatchObject({ played: 3, best_campaign: 3 })
    expect(await summary(b)).toMatchObject({ played: 2, best_campaign: 2 })
  })
  it('deduplicates repeated opponents across battles and campaigns', async () => {
    const a = await campaign()
    const b = await campaign()
    for (let i = 0; i < 5; i++) await battle(a)
    await battle(b)
    await as(null)
    expect((await summary()).opponents).toBe(1)
  })
  it('counts a multiplayer battle once, but includes every distinct opponent', async () => {
    const cid = await campaign()
    await battle(cid, 'Confirmed', 'Win', [1, 2, 3, 4, 5])
    await as(null)
    expect(await summary()).toMatchObject({ played: 1, wins: 1, opponents: 5, best_campaign: 1 })
  })
  it('counts wins and draws independently', async () => {
    const cid = await campaign()
    for (const result of ['Win', 'Loss', 'Draw']) await battle(cid, 'Confirmed', result)
    await as(null)
    expect(await summary()).toMatchObject({ played: 3, wins: 1, draws: 1 })
  })
  it('counts inactive historical participants and recalculates completed/reopened campaigns', async () => {
    const cid = await campaign(true, 'Completed')
    await battle(cid)
    await pg.query('update public.campaign_members set is_active=false where campaign_id=$1', [cid])
    await as(null)
    expect(await summary()).toMatchObject({ played: 1, completed_campaigns: 1 })
    await admin()
    await pg.query("update public.campaigns set status='Active' where id=$1", [cid])
    await as(null)
    expect((await summary()).completed_campaigns).toBe(0)
  })
  it('does not count a completed campaign with only unconfirmed reports', async () => {
    const cid = await campaign(true, 'Completed')
    await battle(cid, 'Pending')
    await as(null)
    expect(await summary()).toEqual(zero)
  })
  it('recalculates when actual correction and resolution RPCs change a report', async () => {
    const cid = await campaign()
    const bid = await battle(cid)
    await as(people[0])
    await pg.query('select public.revise_battle($1,1,$2)', [bid, { mission: 'Corrected', description: '', battle_date: '2026-11-26', participants: [0, 1].map(i => ({ player_id: people[i], army_id: armies[i], result: i ? 'Loss' : 'Win' })) }])
    expect(await summary()).toEqual(zero)
    await pg.query("select public.resolve_battle($1,2,'Confirmed','Verified')", [bid])
    expect((await summary()).played).toBe(1)
    await pg.query("select public.resolve_battle($1,2,'Rejected','Incorrect report')", [bid])
    expect(await summary()).toEqual(zero)
  })
  it('enforces caller visibility for anonymous users, outsiders, members, and global admins', async () => {
    const published = await campaign()
    const hidden = await campaign(false)
    await battle(published)
    await battle(hidden)
    await battle(hidden)
    for (const viewer of [null, people[2]]) {
      await as(viewer)
      expect((await summary()).played).toBe(1)
      expect(await summary(hidden)).toEqual(zero)
    }
    for (const viewer of [people[1], people[6]]) {
      await as(viewer)
      expect((await summary()).played).toBe(3)
      expect((await summary(hidden)).played).toBe(2)
    }
    await admin()
    await pg.query('update public.campaign_members set is_active=false where campaign_id=$1 and player_id=$2', [hidden, people[1]])
    await as(people[1])
    expect((await summary()).played).toBe(1)
  })
  it('runs without elevated rights or implicit PUBLIC execution grants', async () => {
    await admin()
    const { rows } = await pg.query<{ elevated: boolean; stable: string; public_execute: boolean }>(`
      select p.prosecdef as elevated, p.provolatile as stable,
        exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute
      from pg_proc p where p.oid='public.achievement_summary(uuid,uuid)'::regprocedure
    `)
    expect(rows[0]).toEqual({ elevated: false, stable: 's', public_execute: false })
    await as(null)
    expect(await summary()).toEqual(zero)
  })
  it('replays the hosted verification script without retaining fixture users', async () => {
    await admin()
    const before = (await pg.query<{ count: number }>('select count(*)::integer as count from auth.users')).rows[0].count
    await pg.exec(await readFile(new URL('../../scripts/check-achievements.sql', import.meta.url), 'utf8'))
    const after = (await pg.query<{ count: number }>('select count(*)::integer as count from auth.users')).rows[0].count
    expect(after).toBe(before)
  })
})
