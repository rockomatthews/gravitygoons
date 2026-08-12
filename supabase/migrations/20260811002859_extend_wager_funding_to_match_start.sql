create or replace function public.initialize_match_wager_reference()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  wager_requested boolean;
  scheduled_start timestamptz;
begin
  select c.wager_requested, m.scheduled_start_at
    into wager_requested, scheduled_start
  from public.pvp_matches m
  join public.game_challenges c on c.id = m.challenge_id
  where m.id = new.match_id;

  if coalesce(wager_requested, false) then
    if scheduled_start is null then raise exception 'Wagered matches must be scheduled'; end if;
    new.escrow_match_id := public.escrow_match_id_for_uuid(new.match_id);
    -- Players may fund until the scheduled start. The previous 15-minute cutoff
    -- contradicted the challenge UI and made otherwise valid deposits revert.
    new.funding_deadline := scheduled_start;
    new.state := 'created';
  else
    new.state := 'disabled';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.initialize_match_wager_reference() from public, anon, authenticated;
grant execute on function public.initialize_match_wager_reference() to service_role;

-- Repair accepted wagers that have not reached escrow yet. Never alter a
-- partially funded or locked wager because its signed/on-chain terms are fixed.
update public.match_wager_references wager
set funding_deadline = match.scheduled_start_at,
    updated_at = now()
from public.pvp_matches match
where wager.match_id = match.id
  and wager.state = 'created'
  and wager.funded_a_tx_hash is null
  and wager.funded_b_tx_hash is null
  and match.scheduled_start_at is not null
  and wager.funding_deadline is distinct from match.scheduled_start_at;

comment on function public.initialize_match_wager_reference() is
  'Initializes match escrow mirrors and permits equal-stake USDC funding until the scheduled match start.';
