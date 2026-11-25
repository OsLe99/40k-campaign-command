begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

select ok((select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname in
    ('profiles','global_admins','campaigns','campaign_members','armies','campaign_armies','battles',
     'battle_participants','battle_responses','army_images','battle_images','moderation_log')), 'RLS enabled on every application table');
select ok(not has_table_privilege('anon','public.battles','insert'), 'Visitors cannot insert battles');
select ok(not has_table_privilege('authenticated','public.battles','update'), 'Players cannot update battle statuses directly');
select ok(not has_table_privilege('authenticated','public.global_admins','insert'), 'Players cannot self-promote globally');
select ok(not has_table_privilege('authenticated','public.campaign_members','update'), 'Players cannot self-promote within campaigns');
select ok(not has_column_privilege('authenticated','public.armies','owner_id','update'), 'Army ownership is immutable to clients');
select ok(not has_function_privilege('anon','public.create_campaign(jsonb)','execute'), 'Visitors cannot execute write RPCs');
select ok(not has_function_privilege('authenticated','private.set_participants(uuid,uuid,jsonb)','execute'), 'Internal participant insertion is not exposed');
select ok((select bool_and(not public) from storage.buckets where id in ('army-images','battle-images')), 'Photograph buckets are private');
select ok((select 'security_invoker=true'=any(reloptions) from pg_class where oid='public.standings'::regclass), 'Standings preserve caller RLS');

insert into auth.users(id) values('00000000-0000-0000-0000-000000000011');
select is((select count(*)::int from public.profiles where id='00000000-0000-0000-0000-000000000011'),1,'Signup trigger creates a profile');
select is((select count(*)::int from public.global_admins where player_id='00000000-0000-0000-0000-000000000011'),0,'Signup creates no global privileges');
set local role anon;
select is((select count(*)::int from public.campaigns),0,'Visitor sees no unpublished campaigns');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
set local role authenticated;
select lives_ok($$select public.create_campaign('{"name":"Native test campaign"}')$$,'Authenticated user creates a draft');
select is((select role from public.campaign_members where player_id=auth.uid()),'CampaignAdmin','Creator is campaign admin');
select throws_ok($$select public.set_global_admin(auth.uid(),true)$$,'P0001','Global administrator required','Campaign admin is not global admin');

select * from finish();
rollback;
