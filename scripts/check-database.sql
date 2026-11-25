-- Run the entire file through an authorized administrative SQL connection.
-- Fixtures exist only inside this transaction. Never replace ROLLBACK with COMMIT.
begin;
set local statement_timeout = '30s';
set local plpgsql.check_asserts = on;
do $$
declare p1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid();
begin
  perform set_config('test.player1', p1::text, true);
  perform set_config('test.player2', p2::text, true);
  insert into auth.users(id) values(p1),(p2);
  assert (select count(*)=2 from public.profiles where id in (p1,p2)), 'Signup trigger failed';
  assert not exists(select 1 from public.global_admins where player_id in (p1,p2)), 'Signup granted global privileges';
  assert not has_table_privilege('authenticated','public.battles','update'), 'Direct status writes are allowed';
  assert not has_table_privilege('authenticated','public.global_admins','insert'), 'Direct global promotion is allowed';
  assert not has_function_privilege('anon','public.create_campaign(jsonb)','execute'), 'Anonymous RPC writes are allowed';
  assert not has_function_privilege('authenticated','private.set_participants(uuid,uuid,jsonb)','execute'), 'Internal participant function is exposed';
end;
$$;
set local role authenticated;
do $$
declare cid uuid; aid uuid;
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.player1'),true);
  cid := public.create_campaign('{"name":"Transactional verification"}');
  perform set_config('test.campaign',cid::text,true);
  assert (select role='CampaignAdmin' from public.campaign_members where campaign_id=cid and player_id=auth.uid()), 'Creator lacks scoped admin';
  perform public.save_campaign(cid,'{"name":"Transactional verification","status":"Active","is_published":true}');
  insert into public.armies(name,faction) values('Verification army one','Imperium') returning id into aid;
  perform set_config('test.army1',aid::text,true);
  perform public.register_army(cid,aid);
  begin
    perform public.set_global_admin(auth.uid(),true);
    raise exception 'Global escalation was allowed';
  exception when raise_exception then
    if sqlerrm <> 'Global administrator required' then raise; end if;
  end;
  begin
    perform public.manage_member(cid,auth.uid(),'Member',false);
    raise exception 'Final campaign administrator removal was allowed';
  exception when raise_exception then
    if sqlerrm <> 'Keep at least one active campaign administrator' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',current_setting('test.player2'),true);
  perform public.join_campaign(cid);
  insert into public.armies(name,faction) values('Verification army two','Chaos') returning id into aid;
  perform set_config('test.army2',aid::text,true);
  perform public.register_army(cid,aid);
  begin
    perform public.save_campaign(cid,'{"name":"Unauthorized change","status":"Active","is_published":true}');
    raise exception 'Member changed campaign settings';
  exception when raise_exception then
    if sqlerrm <> 'Campaign administrator required' then raise; end if;
  end;
end;
$$;
do $$
declare cid uuid := current_setting('test.campaign')::uuid; bid uuid; report jsonb;
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.player1'),true);
  report := jsonb_build_object('mission','Verification battle','battle_date',current_date,
    'participants',jsonb_build_array(
      jsonb_build_object('player_id',current_setting('test.player1'),'army_id',current_setting('test.army1'),'result','Win'),
      jsonb_build_object('player_id',current_setting('test.player2'),'army_id',current_setting('test.army2'),'result','Loss')));
  bid := public.submit_battle(cid,report);
  perform set_config('test.battle',bid::text,true);
  assert (select status='Pending' from public.battles where id=bid), 'Report did not start Pending';
  assert (select points=0 from public.standings where campaign_id=cid and player_id=auth.uid()), 'Pending battle counted';
  perform set_config('request.jwt.claim.sub',current_setting('test.player2'),true);
  perform public.respond_battle(bid,1,'Confirmed','');
  assert (select status='Confirmed' from public.battles where id=bid), 'Opponent confirmation failed';
  assert (select points=3 from public.standings where campaign_id=cid and player_id=current_setting('test.player1')::uuid), 'Winner points incorrect';
  perform set_config('request.jwt.claim.sub',current_setting('test.player1'),true);
  perform public.revise_battle(bid,1,report);
  assert (select revision=2 and status='Pending' from public.battles where id=bid), 'Revision did not reset status';
  assert not exists(select 1 from public.battle_participants where battle_id=bid and is_confirmed), 'Revision retained attestations';
  begin
    perform public.respond_battle(bid,1,'Confirmed','');
    raise exception 'Stale revision was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Report changed. Reload and review the latest revision' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',current_setting('test.player2'),true);
  perform public.respond_battle(bid,2,'Disputed','Verification dispute');
  perform public.respond_battle(bid,2,'Confirmed','Verification agreement');
  assert (select status='Disputed' from public.battles where id=bid), 'Dispute was automatically cleared';
  perform set_config('request.jwt.claim.sub',current_setting('test.player1'),true);
  perform public.resolve_battle(bid,2,'Rejected','Verification resolution');
  assert exists(select 1 from public.moderation_log where battle_id=bid and action='battle.rejected'), 'Resolution was not audited';
  perform public.manage_member(cid,current_setting('test.player2')::uuid,'Member',false);
  perform set_config('request.jwt.claim.sub',current_setting('test.player2'),true);
  perform public.join_campaign(cid);
  assert (select not is_active from public.campaign_members where campaign_id=cid and player_id=auth.uid()), 'Inactive member reactivated itself';
  perform set_config('request.jwt.claim.sub','',true);
end;
$$;
set local role anon;
do $$
begin
  assert exists(select 1 from public.campaigns where id=current_setting('test.campaign')::uuid), 'Public campaign is hidden';
  assert not exists(select 1 from public.battles where id=current_setting('test.battle')::uuid), 'Rejected report is public';
end;
$$;
reset role;
rollback;
select 'PASS: transactional signup trigger, membership, grants, battle lifecycle, standings, stale revisions, disputes, moderation, and anonymous visibility; all fixtures rolled back.' as result;
