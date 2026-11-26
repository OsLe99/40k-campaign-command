// @vitest-environment node
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { THEME_IDS } from '../lib/themes'

// PostgreSQL engine with minimal platform schema stubs. These tests validate
// PostgreSQL grants/RLS/functions, not the GoTrue or Storage HTTP services.
const pg = new PGlite()
const owner = '00000000-0000-0000-0000-000000000001'
const opponent = '00000000-0000-0000-0000-000000000002'
const stranger = '00000000-0000-0000-0000-000000000003'
const army1 = '10000000-0000-0000-0000-000000000001'
const army2 = '10000000-0000-0000-0000-000000000002'
let campaign: string
let otherCampaign: string
let battle: string
async function as(pid: string | null) {
  await pg.exec('reset role')
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [pid || ''])
  await pg.exec(pid ? 'set role authenticated' : 'set role anon')
}
async function scalar(sql: string, params: unknown[] = []) {
  const result = await pg.query<Record<string, unknown>>(sql, params)
  return Object.values(result.rows[0] || {})[0]
}
const payload = () => ({
  mission: 'The Silent Gate', battle_date: '2026-11-25', points_limit: 2000, description: 'Test report',
  participants: [{ player_id: owner, army_id: army1, result: 'Win' }, { player_id: opponent, army_id: army2, result: 'Loss' }],
})
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
  const migrationDirectory = new URL('../../supabase/migrations/', import.meta.url)
  for (const name of (await readdir(migrationDirectory)).filter(name => name.endsWith('.sql')).sort()) {
    await pg.exec(await readFile(new URL(name, migrationDirectory), 'utf8'))
  }
  await pg.query('insert into auth.users values ($1),($2),($3)', [owner, opponent, stranger])
  await as(owner)
  campaign = String(await scalar("select public.create_campaign('{\"name\":\"Campaign A\"}')"))
  await pg.query('select public.save_campaign($1,$2)', [campaign, { name: 'Campaign A', status: 'Active', is_published: true }])
  await pg.query('insert into public.armies(id,name,faction) values($1,$2,$3)', [army1, 'First legion', 'Imperium'])
  await pg.query('select public.register_army($1,$2)', [campaign, army1])
  await as(opponent)
  await pg.query('select public.join_campaign($1)', [campaign])
  await pg.query('insert into public.armies(id,name,faction) values($1,$2,$3)', [army2, 'Second legion', 'Chaos'])
  await pg.query('select public.register_army($1,$2)', [campaign, army2])
  otherCampaign = String(await scalar("select public.create_campaign('{\"name\":\"Campaign B\"}')"))
}, 30000)
afterAll(async () => { await pg.close() })

describe('PostgreSQL migration and authorization', () => {
  it('creates profiles but no administrator from signup', async () => {
    await as(owner)
    expect(await scalar('select count(*)::int from public.profiles')).toBe(3)
    expect(await scalar('select count(*)::int from public.global_admins')).toBe(0)
    expect(await scalar('select role from public.campaign_members where campaign_id=$1 and player_id=$2', [campaign, owner])).toBe('CampaignAdmin')
  })
  it('allows anonymous published reads but hides drafts and denies writes', async () => {
    await as(null)
    expect(await scalar('select count(*)::int from public.campaigns')).toBe(1)
    expect(await scalar('select count(*)::int from public.campaigns where id=$1', [otherCampaign])).toBe(0)
    await expect(pg.query("select public.create_campaign('{\"name\":\"Forged\"}')")).rejects.toThrow(/permission denied/)
    await expect(pg.query('insert into public.armies(name,faction) values($1,$2)', ['forged', 'x'])).rejects.toThrow(/permission denied/)
  })
  it('prevents role escalation, ownership forgery, and direct status writes', async () => {
    await as(opponent)
    await expect(pg.query('insert into public.global_admins(player_id) values($1)', [opponent])).rejects.toThrow(/permission denied/)
    await expect(pg.query("update public.campaign_members set role='CampaignAdmin' where player_id=$1", [opponent])).rejects.toThrow(/permission denied/)
    await expect(pg.query('select public.set_global_admin($1,true)', [opponent])).rejects.toThrow(/Global administrator/)
    await expect(pg.query("insert into public.armies(name,faction,owner_id) values('forged','x',$1)", [owner])).rejects.toThrow(/row-level security/)
    await expect(pg.query("update public.battles set status='Confirmed'")).rejects.toThrow(/permission denied/)
  })
  it('isolates campaign administration and guards the last admin', async () => {
    await as(opponent)
    await expect(pg.query('select public.save_campaign($1,$2)', [campaign, { name: 'stolen' }])).rejects.toThrow(/administrator required/)
    await as(owner)
    await expect(pg.query('select public.manage_member($1,$2,$3,false)', [campaign, owner, 'Member'])).rejects.toThrow(/at least one/)
    await expect(pg.query('select public.save_campaign($1,$2)', [otherCampaign, { name: 'stolen' }])).rejects.toThrow(/administrator required/)
  })
  it('rejects missing, duplicated, invalid and forged battle participants atomically', async () => {
    await as(owner)
    const data = payload()
    for (const invalid of [
      { ...data, participants: null }, { ...data, participants: [] },
      { ...data, participants: [data.participants[0], data.participants[0]] },
      { ...data, participants: [{ ...data.participants[0], army_id: army2 }, data.participants[1]] },
      { ...data, participants: data.participants.map(p => ({ ...p, result: 'Win' })) },
      { ...data, participants: [data.participants[0], { ...data.participants[1], player_id: stranger }] },
    ]) await expect(pg.query('select public.submit_battle($1,$2)', [campaign, invalid])).rejects.toThrow()
    expect(await scalar('select count(*)::int from public.battles')).toBe(0)
  })
  it('submits pending reports, hides them from public readers, and waits for opponent', async () => {
    await as(owner)
    battle = String(await scalar('select public.submit_battle($1,$2)', [campaign, payload()]))
    expect(await scalar('select status from public.battles where id=$1', [battle])).toBe('Pending')
    expect(await scalar('select points from public.standings where campaign_id=$1 and player_id=$2', [campaign, owner])).toBe(0)
    await as(null)
    expect(await scalar('select count(*)::int from public.battles')).toBe(0)
    await as(stranger)
    await expect(pg.query('select public.respond_battle($1,1,$2,$3)', [battle, 'Confirmed', ''])).rejects.toThrow(/participant required/)
  })
  it('confirms a report and counts it only in its own campaign', async () => {
    await as(opponent)
    await pg.query("select public.respond_battle($1,1,'Confirmed','')", [battle])
    expect(await scalar('select status from public.battles where id=$1', [battle])).toBe('Confirmed')
    await as(null)
    expect(await scalar('select count(*)::int from public.battles')).toBe(1)
    expect(await scalar('select points from public.standings where campaign_id=$1 and player_id=$2', [campaign, owner])).toBe(3)
    await as(opponent)
    expect(await scalar('select points from public.standings where campaign_id=$1 and player_id=$2', [otherCampaign, opponent])).toBe(0)
  })
  it('invalidates confirmations on correction and preserves revision history', async () => {
    await as(owner)
    await pg.query('select public.revise_battle($1,1,$2)', [battle, payload()])
    expect(await scalar('select revision from public.battles where id=$1', [battle])).toBe(2)
    expect(await scalar('select count(*)::int from public.battle_participants where battle_id=$1 and is_confirmed', [battle])).toBe(0)
    expect(await scalar('select points from public.standings where campaign_id=$1 and player_id=$2', [campaign, owner])).toBe(0)
    expect(await scalar('select count(*)::int from public.battle_responses where battle_id=$1', [battle])).toBe(2)
    await expect(pg.query("select public.respond_battle($1,1,'Confirmed','')", [battle])).rejects.toThrow(/Report changed/)
    await expect(pg.query("select public.resolve_battle($1,1,'Confirmed','Stale decision')", [battle])).rejects.toThrow(/Report changed/)
  })
  it('keeps disputes blocked until an audited administrator decision', async () => {
    await as(opponent)
    await expect(pg.query("select public.respond_battle($1,2,'Disputed','')", [battle])).rejects.toThrow(/Explain/)
    await pg.query("select public.respond_battle($1,2,'Disputed','Wrong score')", [battle])
    await pg.query("select public.respond_battle($1,2,'Confirmed','Now agree')", [battle])
    expect(await scalar('select status from public.battles where id=$1', [battle])).toBe('Disputed')
    await expect(pg.query("select public.resolve_battle($1,2,'Confirmed','Override')", [battle])).rejects.toThrow(/administrator required/)
    await as(owner)
    await pg.query("select public.resolve_battle($1,2,'Rejected','Incorrect army roster')", [battle])
    expect(await scalar('select status from public.battles where id=$1', [battle])).toBe('Rejected')
    expect(await scalar("select count(*)::int from public.moderation_log where battle_id=$1 and action='battle.rejected'", [battle])).toBe(1)
  })
  it('prevents deactivated members from rejoining or submitting', async () => {
    await as(owner)
    await pg.query("select public.manage_member($1,$2,'Member',false)", [campaign, opponent])
    await as(opponent)
    await pg.query('select public.join_campaign($1)', [campaign])
    expect(await scalar('select is_active from public.campaign_members where campaign_id=$1 and player_id=$2', [campaign, opponent])).toBe(false)
    await expect(pg.query('select public.submit_battle($1,$2)', [campaign, payload()])).rejects.toThrow(/membership required/)
    await as(owner)
    await pg.query("select public.manage_member($1,$2,'Member',true)", [campaign, opponent])
  })
  it('protects Storage object paths and metadata associations', async () => {
    await as(owner)
    const path = `${owner}/${army1}/photo.png`
    await pg.query("insert into storage.objects(bucket_id,name) values('army-images',$1)", [path])
    await pg.query('insert into public.army_images(army_id,object_path) values($1,$2)', [army1, path])
    await as(opponent)
    await expect(pg.query("insert into storage.objects(bucket_id,name) values('army-images',$1)", [`${opponent}/${army1}/forged.png`])).rejects.toThrow(/row-level security/)
    await expect(pg.query('insert into public.army_images(army_id,object_path) values($1,$2)', [army2, path])).rejects.toThrow()
    expect(await scalar("select count(*)::int from storage.objects where name=$1", [path])).toBe(1)
  })
  it('keeps profile edits scoped and ownership columns immutable', async () => {
    await as(opponent)
    await pg.query("update public.profiles set display_name='Invader' where id=$1", [owner])
    expect(await scalar('select display_name from public.profiles where id=$1', [owner])).toBe('New commander')
    await expect(pg.query('update public.armies set owner_id=$1 where id=$2', [opponent, army1])).rejects.toThrow(/permission denied/)
  })
  it('allows global moderation but prevents removing the final global admin', async () => {
    await pg.exec('reset role')
    await pg.query('insert into public.global_admins(player_id) values($1)', [stranger])
    await as(stranger)
    expect(await scalar('select count(*)::int from public.campaigns')).toBe(2)
    await expect(pg.query('select public.set_global_admin($1,false)', [stranger])).rejects.toThrow(/at least one/)
    await pg.query('select public.set_global_admin($1,true)', [owner])
    expect(await scalar('select count(*)::int from public.global_admins')).toBe(2)
  })
  it('runs the hosted SQL verification without retaining its fixture records', async () => {
    await pg.exec('reset role')
    const before = await scalar('select count(*)::int from auth.users')
    await pg.exec(await readFile(new URL('../../scripts/check-database.sql', import.meta.url), 'utf8'))
    expect(await scalar('select count(*)::int from auth.users')).toBe(before)
    expect(await scalar('select count(*)::int from public.campaigns')).toBe(2)
  })
  it('defaults accounts to Imperium and accepts only the ten personal themes', async () => {
    await as(owner)
    expect(await scalar('select theme from public.profiles where id=$1', [owner])).toBe('imperium')
    for (const theme of THEME_IDS) {
      await pg.query('update public.profiles set theme=$1 where id=$2', [theme, owner])
      expect(await scalar('select theme from public.profiles where id=$1', [owner])).toBe(theme)
    }
    await expect(pg.query('update public.profiles set theme=$1 where id=$2', ['not-a-theme', owner])).rejects.toThrow(/profiles_theme_check/)
    await expect(pg.query('update public.profiles set theme=null where id=$1', [owner])).rejects.toThrow(/null/)
  })
  it('keeps theme updates owner-only, even for global admins, and leaves all game data unchanged', async () => {
    await pg.exec('reset role')
    const snapshots = await Promise.all(['campaigns', 'armies', 'battles'].map(table => scalar(`select jsonb_agg(to_jsonb(t) order by id) from public.${table} t`)))
    await as(opponent)
    const ordinary = await pg.query("update public.profiles set theme='chaos' where id=$1 returning id", [owner])
    expect(ordinary.rows).toEqual([])
    await as(stranger)
    const administrator = await pg.query("update public.profiles set theme='chaos' where id=$1 returning id", [owner])
    expect(administrator.rows).toEqual([])
    await as(owner)
    await pg.query("update public.profiles set theme='tau' where id=$1", [owner])
    expect(await scalar('select theme from public.profiles where id=$1', [opponent])).toBe('imperium')
    await as(null)
    await expect(pg.query("update public.profiles set theme='orks' where id=$1", [owner])).rejects.toThrow(/permission denied/)
    await pg.exec('reset role')
    const after = await Promise.all(['campaigns', 'armies', 'battles'].map(table => scalar(`select jsonb_agg(to_jsonb(t) order by id) from public.${table} t`)))
    expect(after).toEqual(snapshots)
  })
  it('replays hosted theme permission checks and rolls back all fixtures', async () => {
    await pg.exec('reset role')
    const before = await scalar('select count(*)::int from auth.users')
    await pg.exec(await readFile(new URL('../../scripts/check-themes.sql', import.meta.url), 'utf8'))
    expect(await scalar('select count(*)::int from auth.users')).toBe(before)
  })
  it('enforces attachment paths, ownership, metadata limits, and immutable associations', async () => {
    await as(opponent)
    const attachment = '30000000-0000-0000-0000-000000000001'
    const path = `${opponent}/${army2}/${attachment}.json`
    await pg.query("insert into storage.objects(bucket_id,name) values('army-lists',$1)", [path])
    const insert = (changes: Record<string, unknown> = {}) => {
      const row = { id: attachment, army_id: army2, uploaded_by: opponent, object_path: path, file_name: 'roster.json', file_extension: 'json', file_size: 200, ...changes }
      return pg.query(`insert into public.army_lists(${Object.keys(row).join(',')}) values(${Object.keys(row).map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row))
    }
    await expect(insert({ uploaded_by: owner })).rejects.toThrow()
    await expect(insert({ army_id: army1 })).rejects.toThrow()
    for (const file_name of ['../roster.json', 'folder\\roster.json', 'bad\nname.json', 'roster.exe']) {
      await expect(insert({ file_name })).rejects.toThrow(/check constraint/)
    }
    for (const file_size of [0, 8388609]) await expect(insert({ file_size })).rejects.toThrow(/check constraint/)
    await insert()
    await expect(pg.query("update public.army_lists set label='changed' where id=$1", [attachment])).rejects.toThrow(/permission denied/)
    await expect(pg.query("insert into storage.objects(bucket_id,name) values('army-lists',$1)", [`${opponent}/${army1}/${attachment}.json`])).rejects.toThrow(/row-level security/)
    await expect(pg.query("insert into storage.objects(bucket_id,name) values('army-lists',$1)", [`${opponent}/${army2}/bad.html`])).rejects.toThrow(/row-level security/)
    await as(null)
    expect(await scalar('select count(*)::int from public.army_lists where id=$1', [attachment])).toBe(1)
    expect(await scalar("select count(*)::int from storage.objects where bucket_id='army-lists' and name=$1", [path])).toBe(1)
    await expect(pg.query('delete from public.army_lists where id=$1', [attachment])).rejects.toThrow(/permission denied/)
    await pg.exec('reset role')
    const visitor = '00000000-0000-0000-0000-000000000004'
    await pg.query('insert into auth.users values($1)', [visitor])
    await as(visitor)
    expect((await pg.query('delete from public.army_lists where id=$1 returning id', [attachment])).rows).toEqual([])
    expect((await pg.query("delete from storage.objects where bucket_id='army-lists' and name=$1 returning id", [path])).rows).toEqual([])
    await as(opponent)
    await pg.query("delete from storage.objects where bucket_id='army-lists' and name=$1", [path])
    await pg.query('delete from public.army_lists where id=$1', [attachment])
  })
  it('allows orphan cleanup and global moderation without granting admin upload access', async () => {
    const attachment = '30000000-0000-0000-0000-000000000002'
    const path = `${opponent}/${army2}/${attachment}.pdf`
    await as(opponent)
    await pg.query("insert into storage.objects(bucket_id,name) values('army-lists',$1)", [path])
    await as(null)
    expect(await scalar("select count(*)::int from storage.objects where bucket_id='army-lists' and name=$1", [path])).toBe(0)
    await as(opponent)
    await pg.query('insert into public.army_lists(id,army_id,object_path,file_name,file_extension,file_size) values($1,$2,$3,$4,$5,$6)', [attachment, army2, path, 'list.pdf', 'pdf', 300])
    await as(stranger)
    await expect(pg.query("insert into storage.objects(bucket_id,name) values('army-lists',$1)", [`${stranger}/${army2}/${attachment}.pdf`])).rejects.toThrow(/row-level security/)
    await pg.query("delete from storage.objects where bucket_id='army-lists' and name=$1", [path])
    await pg.query('delete from public.army_lists where id=$1', [attachment])
    expect(await scalar('select count(*)::int from public.army_lists where id=$1', [attachment])).toBe(0)
    await as(opponent)
    await pg.query("insert into storage.objects(bucket_id,name) values('army-lists',$1)", [path])
    await pg.query("delete from storage.objects where bucket_id='army-lists' and name=$1", [path])
    expect(await scalar("select count(*)::int from storage.objects where bucket_id='army-lists' and name=$1", [path])).toBe(0)
  })
  it('requires an existing object and prevents army deletion from orphaning attachments', async () => {
    await as(opponent)
    const attachment = '30000000-0000-0000-0000-000000000003'
    const army = String(await scalar("insert into public.armies(name,faction) values('Attachment-only army','Imperium') returning id"))
    const path = `${opponent}/${army}/${attachment}.txt`
    const insert = () => pg.query('insert into public.army_lists(id,army_id,object_path,file_name,file_extension,file_size) values($1,$2,$3,$4,$5,$6)', [attachment, army, path, 'list.txt', 'txt', 50])
    await expect(insert()).rejects.toThrow(/row-level security/)
    await pg.query("insert into storage.objects(bucket_id,name) values('army-lists',$1)", [path])
    await insert()
    await expect(pg.query('delete from public.armies where id=$1', [army])).rejects.toThrow(/foreign key/)
    await pg.query("delete from storage.objects where bucket_id='army-lists' and name=$1", [path])
    await pg.query('delete from public.army_lists where id=$1', [attachment])
    await pg.query('delete from public.armies where id=$1', [army])
  })
  it('replays attachment hosted verification without retaining fixtures', async () => {
    await pg.exec('reset role')
    const before = await scalar('select count(*)::int from auth.users')
    await pg.exec(await readFile(new URL('../../scripts/check-army-lists.sql', import.meta.url), 'utf8'))
    expect(await scalar('select count(*)::int from auth.users')).toBe(before)
  })
})
