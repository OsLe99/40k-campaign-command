-- Derived milestones: no award rows, client writes, or elevated reads.
create function public.achievement_summary(target_player uuid, target_campaign uuid default null)
returns table (
  played integer,
  wins integer,
  draws integer,
  opponents integer,
  best_campaign integer,
  completed_campaigns integer
)
language sql stable security invoker set search_path = '' as $$
  with eligible as materialized (
    select b.id, b.campaign_id, p.result, c.status as campaign_status
    from public.battle_participants p
    join public.battles b on b.id = p.battle_id
    join public.campaigns c on c.id = b.campaign_id
    where p.player_id = target_player and b.status = 'Confirmed'
      and (target_campaign is null or b.campaign_id = target_campaign)
  ), campaign_totals as (
    select campaign_id, count(*)::integer as total
    from eligible group by campaign_id
  )
  select
    count(*)::integer,
    count(*) filter(where e.result = 'Win')::integer,
    count(*) filter(where e.result = 'Draw')::integer,
    (select count(distinct p.player_id)::integer
      from eligible b join public.battle_participants p on p.battle_id = b.id
      where p.player_id <> target_player),
    coalesce((select max(total) from campaign_totals), 0)::integer,
    count(distinct e.campaign_id) filter(where e.campaign_status = 'Completed')::integer
  from eligible e;
$$;
revoke all on function public.achievement_summary(uuid, uuid) from public, anon, authenticated;
grant execute on function public.achievement_summary(uuid, uuid) to anon, authenticated;
comment on function public.achievement_summary(uuid, uuid) is
  'Read-only milestone metrics from confirmed battles visible to the caller. Corrections and campaign visibility/lifecycle changes recalculate results.';
