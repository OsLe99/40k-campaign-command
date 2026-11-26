-- Run the complete file administratively. All fixtures and mutations roll back.
begin;
set local statement_timeout='30s';
set local plpgsql.check_asserts=on;
do $$
declare
  p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); p3 uuid:=gen_random_uuid();
  a1 uuid:=gen_random_uuid(); a2 uuid:=gen_random_uuid();
  c1 uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid();
  b1 uuid:=gen_random_uuid(); b2 uuid:=gen_random_uuid();
begin
  perform set_config('test.achievement_owner',p1::text,true);
  perform set_config('test.achievement_member',p2::text,true);
  perform set_config('test.achievement_outsider',p3::text,true);
  perform set_config('test.achievement_public',c1::text,true);
  perform set_config('test.achievement_hidden',c2::text,true);
  perform set_config('test.achievement_battle',b2::text,true);
  perform set_config('test.achievement_army1',a1::text,true);
  perform set_config('test.achievement_army2',a2::text,true);
  insert into auth.users(id) values(p1),(p2),(p3);
  insert into public.armies(id,name,faction,owner_id) values(a1,'Achievement fixture force','Test',p1),(a2,'Achievement fixture force','Test',p2);
  insert into public.campaigns(id,name,created_by,is_published,status)
    values(c1,'Achievement verification public',p1,true,'Active'),(c2,'Achievement verification hidden',p1,false,'Completed');
  insert into public.campaign_members(campaign_id,player_id,role)
    values(c1,p1,'CampaignAdmin'),(c1,p2,'Member'),(c2,p1,'CampaignAdmin'),(c2,p2,'Member');
  insert into public.campaign_armies(campaign_id,army_id) values(c1,a1),(c1,a2),(c2,a1),(c2,a2);
  insert into public.battles(id,campaign_id,mission,battle_date,status,submitted_by)
    values(b1,c1,'Achievement fixture','2026-11-26','Confirmed',p1),(b2,c2,'Achievement fixture','2026-11-26','Confirmed',p1);
  insert into public.battle_participants(battle_id,player_id,army_id,result)
    values(b1,p1,a1,'Win'),(b1,p2,a2,'Loss'),(b2,p1,a1,'Draw'),(b2,p2,a2,'Draw');
  assert not (select prosecdef from pg_proc where oid='public.achievement_summary(uuid,uuid)'::regprocedure), 'Achievement summary must not elevate rights';
end;
$$;
set local role anon;
do $$
declare s record;
begin
  perform set_config('request.jwt.claim.sub','',true);
  select * into s from public.achievement_summary(current_setting('test.achievement_owner')::uuid);
  assert s.played=1 and s.wins=1 and s.draws=0 and s.opponents=1 and s.best_campaign=1 and s.completed_campaigns=0, 'Public metrics leaked hidden history or counted incorrectly';
  select * into s from public.achievement_summary(current_setting('test.achievement_owner')::uuid,current_setting('test.achievement_hidden')::uuid);
  assert s.played=0 and s.opponents=0 and s.completed_campaigns=0, 'Anonymous scoped metrics leaked hidden history';
end;
$$;
set local role authenticated;
do $$
declare s record;
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.achievement_outsider'),true);
  select * into s from public.achievement_summary(current_setting('test.achievement_owner')::uuid);
  assert s.played=1, 'Outsider metrics leaked hidden history';
  perform set_config('request.jwt.claim.sub',current_setting('test.achievement_member'),true);
  select * into s from public.achievement_summary(current_setting('test.achievement_owner')::uuid);
  assert s.played=2 and s.wins=1 and s.draws=1 and s.opponents=1 and s.best_campaign=1 and s.completed_campaigns=1, 'Member metrics are incorrect';
  select * into s from public.achievement_summary(current_setting('test.achievement_owner')::uuid,current_setting('test.achievement_hidden')::uuid);
  assert s.played=1 and s.draws=1 and s.completed_campaigns=1, 'Campaign filter is incorrect';
  perform set_config('request.jwt.claim.sub',current_setting('test.achievement_owner'),true);
  perform public.revise_battle(current_setting('test.achievement_battle')::uuid,1,jsonb_build_object(
    'mission','Corrected achievement fixture','battle_date','2026-11-26','description','',
    'participants',jsonb_build_array(
      jsonb_build_object('player_id',current_setting('test.achievement_owner'),'army_id',current_setting('test.achievement_army1'),'result','Draw'),
      jsonb_build_object('player_id',current_setting('test.achievement_member'),'army_id',current_setting('test.achievement_army2'),'result','Draw')
    )
  ));
  select * into s from public.achievement_summary(auth.uid());
  assert s.played=1 and s.completed_campaigns=0, 'Correction did not reset derived milestones';
  perform public.resolve_battle(current_setting('test.achievement_battle')::uuid,2,'Confirmed','Verified fixture');
  select * into s from public.achievement_summary(auth.uid());
  assert s.played=2 and s.completed_campaigns=1, 'Reconfirmation did not restore milestones';
  perform public.save_campaign(current_setting('test.achievement_hidden')::uuid,'{"name":"Achievement verification hidden","status":"Active","is_published":false}'::jsonb);
  select * into s from public.achievement_summary(auth.uid());
  assert s.completed_campaigns=0, 'Reopening a campaign did not recalculate completion';
end;
$$;
reset role;
insert into public.global_admins(player_id) values(current_setting('test.achievement_outsider')::uuid);
set local role authenticated;
do $$
declare s record;
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.achievement_outsider'),true);
  select * into s from public.achievement_summary(current_setting('test.achievement_owner')::uuid);
  assert s.played=2, 'Global admin cannot read authorized private history';
end;
$$;
reset role;
rollback;
select 'PASS: caller-security achievement metrics, private-history isolation, campaign scope, deduplicated opponents, corrections/reconfirmation, and campaign reopening; fixtures rolled back.' as result;
