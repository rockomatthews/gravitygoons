create extension if not exists pgcrypto with schema extensions;

alter table public.match_wager_references
  drop constraint if exists match_wager_references_state_check;

alter table public.match_wager_references
  add column if not exists funding_deadline timestamptz,
  add column if not exists terms_hash text check (terms_hash is null or terms_hash ~ '^0x[0-9a-fA-F]{64}$'),
  add column if not exists funded_a_tx_hash text check (funded_a_tx_hash is null or funded_a_tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  add column if not exists funded_b_tx_hash text check (funded_b_tx_hash is null or funded_b_tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  add column if not exists result_tx_hash text check (result_tx_hash is null or result_tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  add column if not exists finalization_tx_hash text check (finalization_tx_hash is null or finalization_tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  add column if not exists dispute_deadline timestamptz,
  add column if not exists last_chain_sync_at timestamptz;

alter table public.match_wager_references
  add constraint match_wager_references_state_check check (state in (
    'disabled','created','partially_funded','locked','settlement_pending',
    'result_proposed','settled','refund_pending','refunded','voided','disputed'
  ));

create or replace function public.escrow_match_id_for_uuid(p_match_id uuid)
returns text
language sql
immutable
strict
set search_path = public, extensions
as $$
  select '0x' || encode(extensions.digest(convert_to(p_match_id::text, 'UTF8'), 'sha256'), 'hex')
$$;

revoke all on function public.escrow_match_id_for_uuid(uuid) from public, anon, authenticated;
grant execute on function public.escrow_match_id_for_uuid(uuid) to service_role;

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
    new.funding_deadline := scheduled_start - interval '15 minutes';
    new.state := 'created';
  else
    new.state := 'disabled';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists initialize_match_wager_reference_trigger on public.match_wager_references;
create trigger initialize_match_wager_reference_trigger
before insert on public.match_wager_references
for each row execute function public.initialize_match_wager_reference();

revoke all on function public.initialize_match_wager_reference() from public, anon, authenticated;
grant execute on function public.initialize_match_wager_reference() to service_role;

create or replace function public.authoritative_match_result_hash(p_match_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  payload jsonb;
begin
  select jsonb_build_object(
    'schema', 'gravity-goons-authoritative-result-v1',
    'matchId', m.id,
    'rulesetHash', m.ruleset_hash,
    'winnerTokenId', m.winner_token_id,
    'loserTokenId', m.loser_token_id,
    'completedAt', m.completed_at,
    'finalState', m.state,
    'transcript', coalesce((
      select jsonb_agg(jsonb_build_object(
        'turn', a.turn_number,
        'wallet', a.wallet_address,
        'action', a.action_type,
        'request', a.request_payload,
        'result', a.result_payload,
        'createdAt', a.created_at
      ) order by a.turn_number)
      from public.pvp_match_actions a where a.match_id = m.id
    ), '[]'::jsonb)
  ) into payload
  from public.pvp_matches m where m.id = p_match_id;
  if payload is null then raise exception 'Match not found'; end if;
  return '0x' || encode(extensions.digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex');
end;
$$;

revoke all on function public.authoritative_match_result_hash(uuid) from public, anon, authenticated;
grant execute on function public.authoritative_match_result_hash(uuid) to service_role;

create or replace function public.finalize_authoritative_wager_state()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  computed_hash text;
begin
  if new.status = 'completed' and new.winner_token_id is not null then
    if new.result_hash is null then
      computed_hash := public.authoritative_match_result_hash(new.id);
      update public.pvp_matches set result_hash = computed_hash where id = new.id;
    end if;
    update public.match_wager_references
      set state = case when state = 'locked' then 'settlement_pending' else state end,
          updated_at = now()
      where match_id = new.id;
  elsif new.status = 'voided' and old.status is distinct from new.status then
    update public.match_wager_references
      set state = case when state in ('created','partially_funded','locked') then 'refund_pending' else state end,
          updated_at = now()
      where match_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists finalize_authoritative_wager_state_trigger on public.pvp_matches;
create trigger finalize_authoritative_wager_state_trigger
after update of status, winner_token_id, result_hash on public.pvp_matches
for each row execute function public.finalize_authoritative_wager_state();

revoke all on function public.finalize_authoritative_wager_state() from public, anon, authenticated;
grant execute on function public.finalize_authoritative_wager_state() to service_role;

create or replace function public.require_locked_wager_for_check_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare wager_state text;
begin
  if new.match_mode = 'live_ranked'
    and (new.first_checked_in_at is distinct from old.first_checked_in_at
      or new.second_checked_in_at is distinct from old.second_checked_in_at
      or (old.status <> 'matched' and new.status = 'matched')) then
    select state into wager_state from public.match_wager_references where match_id = new.id;
    if wager_state is not null and wager_state not in ('disabled','locked') then
      raise exception 'Both USDC stakes must be locked before player check-in';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists require_locked_wager_for_check_in_trigger on public.pvp_matches;
create trigger require_locked_wager_for_check_in_trigger
before update of first_checked_in_at, second_checked_in_at, status on public.pvp_matches
for each row execute function public.require_locked_wager_for_check_in();

revoke all on function public.require_locked_wager_for_check_in() from public, anon, authenticated;
grant execute on function public.require_locked_wager_for_check_in() to service_role;

comment on table public.match_wager_references is
  'Server-only mirror of GoonMatchEscrow lifecycle. On-chain state is authoritative for funds.';
