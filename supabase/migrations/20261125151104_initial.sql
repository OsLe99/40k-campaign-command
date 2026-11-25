-- All privileged writes pass through validated, transactional functions.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  username text not null unique check (username ~ '^[a-z0-9_]{3,40}$'),
  display_name text not null check (length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now()
);
create table public.global_admins (
  player_id uuid primary key references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  description text not null default '' check (length(description) <= 10000),
  lore text not null default '' check (length(lore) <= 20000),
  start_date date,
  end_date date,
  status text not null default 'Upcoming' check (status in ('Upcoming','Active','Completed')),
  is_published boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create table public.campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  role text not null default 'Member' check (role in ('Member','CampaignAdmin')),
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (campaign_id, player_id)
);
create index members_player_idx on public.campaign_members(player_id);
create table public.armies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id),
  name text not null check (length(name) between 1 and 120),
  faction text not null check (length(faction) between 1 and 120),
  subfaction text not null default '' check (length(subfaction) <= 120),
  description text not null default '' check (length(description) <= 10000),
  main_image_path text,
  created_at timestamptz not null default now()
);
create index armies_owner_idx on public.armies(owner_id);
create table public.campaign_armies (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  army_id uuid not null references public.armies(id),
  primary key(campaign_id, army_id)
);
create table public.battles (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id),
  mission text not null check (length(mission) between 1 and 160),
  points_limit integer check (points_limit > 0),
  battle_date date not null,
  description text not null default '' check (length(description) <= 20000),
  status text not null default 'Pending' check (status in ('Pending','Confirmed','Disputed','Rejected')),
  revision integer not null default 1,
  submitted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index battles_campaign_idx on public.battles(campaign_id, battle_date desc);
create table public.battle_participants (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  army_id uuid not null references public.armies(id),
  result text not null check (result in ('Win','Loss','Draw')),
  victory_points integer check (victory_points >= 0),
  is_confirmed boolean not null default false,
  unique (battle_id, player_id)
);
create index participants_player_idx on public.battle_participants(player_id);
create table public.battle_responses (
  battle_id uuid not null references public.battles(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  revision integer not null,
  response text not null check (response in ('Confirmed','Disputed')),
  reason text not null default '' check (length(reason) <= 2000),
  responded_at timestamptz not null default now(),
  primary key (battle_id, player_id, revision)
);
create table public.army_images (
  id uuid primary key default gen_random_uuid(),
  army_id uuid not null references public.armies(id),
  object_path text not null unique,
  caption text not null default '' check (length(caption) <= 500),
  uploaded_by uuid not null default auth.uid() references public.profiles(id),
  uploaded_at timestamptz not null default now()
);
create table public.battle_images (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id),
  object_path text not null unique,
  caption text not null default '' check (length(caption) <= 500),
  uploaded_by uuid not null default auth.uid() references public.profiles(id),
  uploaded_at timestamptz not null default now()
);
create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id),
  battle_id uuid references public.battles(id),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create function private.is_global_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.global_admins where player_id = auth.uid());
$$;
create function private.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.campaign_members where campaign_id=cid and player_id=auth.uid() and is_active);
$$;
create function private.is_campaign_admin(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_global_admin() or exists(
    select 1 from public.campaign_members where campaign_id=cid and player_id=auth.uid() and role='CampaignAdmin' and is_active);
$$;
create function private.can_read_campaign(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.campaigns where id=cid and
    (is_published or private.is_member(cid) or private.is_global_admin()));
$$;
create function private.can_read_battle(bid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.battles where id=bid and
    (private.is_campaign_admin(campaign_id) or
     (private.can_read_campaign(campaign_id) and (status='Confirmed' or private.is_member(campaign_id)))));
$$;
create function private.can_edit_battle_image(bid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.battles b where b.id=bid and
    (private.is_campaign_admin(b.campaign_id) or (b.status <> 'Rejected' and private.is_member(b.campaign_id) and
      exists(select 1 from public.battle_participants p where p.battle_id=bid and p.player_id=auth.uid()))));
$$;
create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Never use signup metadata to assign privileges.
  insert into public.profiles(id, username, display_name)
  values(new.id, 'player_' || replace(new.id::text,'-',''), 'New commander');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.create_profile();

create function private.clear_main_image() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.armies set main_image_path=null where id=old.army_id and main_image_path=old.object_path;
  return old;
end;
$$;
create trigger on_army_image_deleted before delete on public.army_images
for each row execute function private.clear_main_image();

do $$
declare t text;
begin
  foreach t in array array['profiles','global_admins','campaigns','campaign_members','armies','campaign_armies',
    'battles','battle_participants','battle_responses','army_images','battle_images','moderation_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end;
$$;
grant update(username, display_name, avatar_url) on public.profiles to authenticated;
grant insert on public.armies to authenticated;
grant update(name, faction, subfaction, description, main_image_path) on public.armies to authenticated;
grant delete on public.armies to authenticated;
grant insert, delete on public.army_images, public.battle_images to authenticated;

create policy profiles_read on public.profiles for select using (true);
create policy profiles_edit on public.profiles for update to authenticated using (id=auth.uid()) with check(id=auth.uid());
create policy global_admins_read on public.global_admins for select to authenticated
  using(player_id=auth.uid() or private.is_global_admin());
create policy campaigns_read on public.campaigns for select using(private.can_read_campaign(id));
create policy members_read on public.campaign_members for select using(private.can_read_campaign(campaign_id));
create policy armies_read on public.armies for select using(true);
create policy armies_insert on public.armies for insert to authenticated with check(owner_id=auth.uid());
create policy armies_update on public.armies for update to authenticated
  using(owner_id=auth.uid() or private.is_global_admin()) with check(owner_id=auth.uid() or private.is_global_admin());
create policy armies_delete on public.armies for delete to authenticated using(owner_id=auth.uid() or private.is_global_admin());
create policy campaign_armies_read on public.campaign_armies for select using(private.can_read_campaign(campaign_id));
create policy battles_read on public.battles for select using(private.can_read_battle(id));
create policy participants_read on public.battle_participants for select using(private.can_read_battle(battle_id));
create policy responses_read on public.battle_responses for select to authenticated using(private.can_read_battle(battle_id));
create policy army_images_read on public.army_images for select using(true);
create policy army_images_insert on public.army_images for insert to authenticated
  with check(uploaded_by=auth.uid() and exists(select 1 from public.armies where id=army_id and owner_id=auth.uid())
    and split_part(object_path,'/',1)=auth.uid()::text and split_part(object_path,'/',2)=army_id::text
    and exists(select 1 from storage.objects where bucket_id='army-images' and name=object_path));
create policy army_images_delete on public.army_images for delete to authenticated
  using(uploaded_by=auth.uid() or private.is_global_admin());
create policy battle_images_read on public.battle_images for select using(private.can_read_battle(battle_id));
create policy battle_images_insert on public.battle_images for insert to authenticated
  with check(uploaded_by=auth.uid() and private.can_edit_battle_image(battle_id)
    and split_part(object_path,'/',1)=auth.uid()::text and split_part(object_path,'/',2)=battle_id::text
    and exists(select 1 from storage.objects where bucket_id='battle-images' and name=object_path));
create policy battle_images_delete on public.battle_images for delete to authenticated
  using(uploaded_by=auth.uid() or exists(select 1 from public.battles where id=battle_id and private.is_campaign_admin(campaign_id)));
create policy moderation_read on public.moderation_log for select to authenticated
  using(private.is_global_admin() or private.is_campaign_admin(campaign_id));

create function public.create_campaign(data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into public.campaigns(name, description, lore, start_date, end_date, created_by)
  values(trim(data->>'name'), coalesce(data->>'description',''), coalesce(data->>'lore',''),
    nullif(data->>'start_date','')::date, nullif(data->>'end_date','')::date, auth.uid()) returning id into cid;
  insert into public.campaign_members(campaign_id, player_id, role) values(cid, auth.uid(), 'CampaignAdmin');
  return cid;
end;
$$;
create function public.save_campaign(cid uuid, data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_campaign_admin(cid) then raise exception 'Campaign administrator required'; end if;
  update public.campaigns set name=trim(data->>'name'), description=coalesce(data->>'description',''),
    lore=coalesce(data->>'lore',''), start_date=nullif(data->>'start_date','')::date,
    end_date=nullif(data->>'end_date','')::date, status=data->>'status',
    is_published=(data->>'is_published')::boolean, updated_at=now() where id=cid;
  insert into public.moderation_log(campaign_id,actor_id,action,reason) values(cid,auth.uid(),'campaign.updated','Campaign settings updated');
end;
$$;
create function public.join_campaign(cid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.campaigns where id=cid and is_published and status <> 'Completed') then
    raise exception 'Campaign is not open for enrollment';
  end if;
  insert into public.campaign_members(campaign_id,player_id) values(cid,auth.uid())
  on conflict(campaign_id,player_id) do nothing;
  -- Removed members cannot reactivate themselves.
end;
$$;
create function public.manage_member(cid uuid, pid uuid, new_role text, active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.campaigns where id=cid for update;
  if not private.is_campaign_admin(cid) then raise exception 'Campaign administrator required'; end if;
  if not exists(select 1 from public.campaign_members where campaign_id=cid and player_id=pid) then
    raise exception 'Member not found';
  end if;
  if (not active or new_role <> 'CampaignAdmin') and
    exists(select 1 from public.campaign_members where campaign_id=cid and player_id=pid and role='CampaignAdmin' and is_active) and
    (select count(*) from public.campaign_members where campaign_id=cid and role='CampaignAdmin' and is_active)=1 then
    raise exception 'Keep at least one active campaign administrator';
  end if;
  update public.campaign_members set role=new_role, is_active=active where campaign_id=cid and player_id=pid;
  insert into public.moderation_log(campaign_id,actor_id,action,reason)
  values(cid,auth.uid(),'membership.updated',pid::text || ': ' || new_role || ', active=' || active);
end;
$$;
create function public.register_army(cid uuid, aid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.campaign_members where campaign_id=cid and player_id=auth.uid() and is_active for update;
  if not found or not exists(select 1 from public.armies where id=aid and owner_id=auth.uid()) then
    raise exception 'Register only your own army in a campaign you belong to';
  end if;
  insert into public.campaign_armies values(cid,aid) on conflict do nothing;
end;
$$;

-- Shared validation and participant insertion, inaccessible through the Data API.
create function private.set_participants(bid uuid, cid uuid, people jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare person jsonb; total integer; wins integer; draws integer;
begin
  if jsonb_typeof(people) is distinct from 'array' then
    raise exception 'Participants must be an array';
  end if;
  if jsonb_array_length(people) < 2 or jsonb_array_length(people) > 20 then
    raise exception 'A battle requires 2 to 20 distinct participants';
  end if;
  total := jsonb_array_length(people);
  select count(*) filter(where p->>'result'='Win'), count(*) filter(where p->>'result'='Draw')
  into wins, draws from jsonb_array_elements(people) p;
  if not ((wins=1 and draws=0) or (wins=0 and draws=total)) then
    raise exception 'Use one winner and remaining losses, or all draws';
  end if;
  if not exists(select 1 from jsonb_array_elements(people) p where p->>'player_id'=auth.uid()::text)
    and not private.is_campaign_admin(cid) then raise exception 'Submitter must participate'; end if;
  for person in select * from jsonb_array_elements(people) loop
    perform 1 from public.campaign_members where campaign_id=cid and player_id=(person->>'player_id')::uuid and is_active for share;
    if not found then raise exception 'Every participant must be an active campaign member'; end if;
    if not exists(select 1 from public.armies a join public.campaign_armies ca on ca.army_id=a.id
      where a.id=(person->>'army_id')::uuid and a.owner_id=(person->>'player_id')::uuid and ca.campaign_id=cid) then
      raise exception 'Participants must own campaign-registered armies';
    end if;
    insert into public.battle_participants(battle_id,player_id,army_id,result,victory_points,is_confirmed)
    values(bid,(person->>'player_id')::uuid,(person->>'army_id')::uuid,person->>'result',
      nullif(person->>'victory_points','')::integer,false);
  end loop;
end;
$$;
create function public.submit_battle(cid uuid, data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare bid uuid;
begin
  if not private.is_member(cid) then raise exception 'Active campaign membership required'; end if;
  if not exists(select 1 from public.campaigns where id=cid and status='Active') then raise exception 'Campaign must be active'; end if;
  if not exists(select 1 from jsonb_array_elements(data->'participants') p where p->>'player_id'=auth.uid()::text) then
    raise exception 'Submitter must participate';
  end if;
  insert into public.battles(campaign_id,mission,points_limit,battle_date,description,submitted_by)
  values(cid,trim(data->>'mission'),nullif(data->>'points_limit','')::integer,(data->>'battle_date')::date,
    coalesce(data->>'description',''),auth.uid()) returning id into bid;
  perform private.set_participants(bid,cid,data->'participants');
  update public.battle_participants set is_confirmed=true where battle_id=bid and player_id=auth.uid();
  insert into public.battle_responses(battle_id,player_id,revision,response) values(bid,auth.uid(),1,'Confirmed');
  return bid;
end;
$$;
create function public.respond_battle(bid uuid, expected_revision integer, answer text, explanation text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare b public.battles;
begin
  select * into b from public.battles where id=bid for update;
  if expected_revision is distinct from b.revision then raise exception 'Report changed. Reload and review the latest revision'; end if;
  if b.id is null or not private.is_member(b.campaign_id) or
    not exists(select 1 from public.battle_participants where battle_id=bid and player_id=auth.uid()) then
    raise exception 'Active participant required';
  end if;
  if b.status not in ('Pending','Disputed') then raise exception 'Battle is already finalized'; end if;
  if answer not in ('Confirmed','Disputed') or answer is null then raise exception 'Invalid response'; end if;
  if answer='Disputed' and length(trim(explanation))=0 then raise exception 'Explain the dispute'; end if;
  insert into public.battle_responses(battle_id,player_id,revision,response,reason)
  values(bid,auth.uid(),b.revision,answer,explanation)
  on conflict(battle_id,player_id,revision) do update
    set response=excluded.response, reason=excluded.reason, responded_at=now();
  update public.battle_participants set is_confirmed=(answer='Confirmed') where battle_id=bid and player_id=auth.uid();
  update public.battles set status=case
    -- A disputed battle requires explicit administrative resolution or a revision.
    when b.status='Disputed' or answer='Disputed' then 'Disputed'
    when not exists(select 1 from public.battle_participants where battle_id=bid and not is_confirmed) then 'Confirmed'
    else 'Pending' end, updated_at=now() where id=bid;
end;
$$;
create function public.revise_battle(bid uuid, expected_revision integer, data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.battles;
begin
  select * into b from public.battles where id=bid for update;
  if expected_revision is distinct from b.revision then raise exception 'Report changed. Reload and review the latest revision'; end if;
  if b.id is null or not (private.is_campaign_admin(b.campaign_id) or
    (b.submitted_by=auth.uid() and private.is_member(b.campaign_id) and b.status in ('Pending','Disputed'))) then
    raise exception 'Battle correction not permitted';
  end if;
  delete from public.battle_participants where battle_id=bid;
  perform private.set_participants(bid,b.campaign_id,data->'participants');
  update public.battles set mission=trim(data->>'mission'), description=coalesce(data->>'description',''),
    points_limit=nullif(data->>'points_limit','')::integer, battle_date=(data->>'battle_date')::date,
    revision=revision+1, status='Pending', updated_at=now() where id=bid;
  insert into public.moderation_log(campaign_id,battle_id,actor_id,action,reason)
  values(b.campaign_id,bid,auth.uid(),'battle.revised','All participants must reconfirm the new revision');
end;
$$;
create function public.resolve_battle(bid uuid, expected_revision integer, decision text, explanation text) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.battles;
begin
  select * into b from public.battles where id=bid for update;
  if expected_revision is distinct from b.revision then raise exception 'Report changed. Reload and review the latest revision'; end if;
  if b.id is null or not private.is_campaign_admin(b.campaign_id) then raise exception 'Campaign administrator required'; end if;
  if decision not in ('Confirmed','Rejected') or decision is null or length(trim(explanation))=0 then
    raise exception 'Choose Confirmed or Rejected and provide a reason';
  end if;
  update public.battles set status=decision,updated_at=now() where id=bid;
  insert into public.moderation_log(campaign_id,battle_id,actor_id,action,reason)
  values(b.campaign_id,bid,auth.uid(),'battle.' || lower(decision),explanation);
end;
$$;
create function public.set_global_admin(pid uuid, enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize role changes so the final administrator cannot be removed concurrently.
  lock table public.global_admins in exclusive mode;
  if not private.is_global_admin() then raise exception 'Global administrator required'; end if;
  if enabled then insert into public.global_admins(player_id) values(pid) on conflict do nothing;
  else
    if (select count(*) from public.global_admins)=1 and exists(select 1 from public.global_admins where player_id=pid) then
      raise exception 'Keep at least one global administrator';
    end if;
    delete from public.global_admins where player_id=pid;
  end if;
  insert into public.moderation_log(actor_id,action,reason) values(auth.uid(),'global_role.updated',pid::text || ': ' || enabled);
end;
$$;

create view public.standings with (security_invoker = true) as
select m.campaign_id, m.player_id, p.username, p.display_name,
  count(b.id)::integer as played,
  count(b.id) filter(where bp.result='Win')::integer as wins,
  count(b.id) filter(where bp.result='Loss')::integer as losses,
  count(b.id) filter(where bp.result='Draw')::integer as draws,
  coalesce(sum(case when b.id is null then 0 when bp.result='Win' then 3 when bp.result='Draw' then 1 else 0 end),0)::integer as points
from public.campaign_members m join public.profiles p on p.id=m.player_id
left join public.battle_participants bp on bp.player_id=m.player_id
left join public.battles b on b.id=bp.battle_id and b.campaign_id=m.campaign_id and b.status='Confirmed'
where m.is_active or exists(select 1 from public.battles hb join public.battle_participants hp on hp.battle_id=hb.id
  where hb.campaign_id=m.campaign_id and hb.status='Confirmed' and hp.player_id=m.player_id)
group by m.campaign_id,m.player_id,p.username,p.display_name;
grant select on public.standings to anon, authenticated;

-- Functions receive no implicit PUBLIC execution privilege.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_global_admin(), private.is_member(uuid), private.is_campaign_admin(uuid),
  private.can_read_campaign(uuid), private.can_read_battle(uuid), private.can_edit_battle_image(uuid) to anon, authenticated;
revoke all on function public.create_campaign(jsonb), public.save_campaign(uuid,jsonb),
  public.join_campaign(uuid), public.manage_member(uuid,uuid,text,boolean), public.register_army(uuid,uuid),
  public.submit_battle(uuid,jsonb), public.respond_battle(uuid,integer,text,text), public.revise_battle(uuid,integer,jsonb),
  public.resolve_battle(uuid,integer,text,text), public.set_global_admin(uuid,boolean) from public, anon, authenticated;
grant execute on function public.create_campaign(jsonb), public.save_campaign(uuid,jsonb),
  public.join_campaign(uuid), public.manage_member(uuid,uuid,text,boolean), public.register_army(uuid,uuid),
  public.submit_battle(uuid,jsonb), public.respond_battle(uuid,integer,text,text), public.revise_battle(uuid,integer,jsonb),
  public.resolve_battle(uuid,integer,text,text), public.set_global_admin(uuid,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('army-images','army-images',false,8388608,array['image/jpeg','image/png','image/webp']),
('battle-images','battle-images',false,8388608,array['image/jpeg','image/png','image/webp']);

create policy campaign_image_read on storage.objects for select using (
  (bucket_id='army-images' and (split_part(storage.objects.name,'/',1)=auth.uid()::text or
    exists(select 1 from public.army_images i where i.object_path=storage.objects.name))) or
  (bucket_id='battle-images' and (split_part(storage.objects.name,'/',1)=auth.uid()::text or
    exists(select 1 from public.battle_images i where i.object_path=storage.objects.name and private.can_read_battle(i.battle_id))))
);
create policy campaign_image_upload on storage.objects for insert to authenticated with check(
  split_part(storage.objects.name,'/',1)=auth.uid()::text and (
    (bucket_id='army-images' and exists(select 1 from public.armies a where a.id::text=split_part(storage.objects.name,'/',2) and a.owner_id=auth.uid())) or
    (bucket_id='battle-images' and exists(select 1 from public.battles b where b.id::text=split_part(storage.objects.name,'/',2) and private.can_edit_battle_image(b.id)))
  )
);
create policy campaign_image_delete on storage.objects for delete to authenticated using(
  bucket_id in ('army-images','battle-images') and (split_part(storage.objects.name,'/',1)=auth.uid()::text or private.is_global_admin() or
    (bucket_id='battle-images' and exists(select 1 from public.battles b where b.id::text=split_part(storage.objects.name,'/',2) and private.is_campaign_admin(b.campaign_id))))
);
