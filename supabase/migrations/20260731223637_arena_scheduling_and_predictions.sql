alter table public.game_challenges
  add column if not exists match_mode text not null default 'async_ranked'
    check (match_mode in ('async_ranked', 'live_ranked')),
  add column if not exists proposed_start_at timestamptz,
  add column if not exists ruleset_hash text not null default ('0x' || repeat('0', 64))
    check (ruleset_hash ~ '^0x[0-9a-f]{64}$'),
  add column if not exists wager_requested boolean not null default false,
  add column if not exists stake_minor bigint check (stake_minor is null or stake_minor in (1000000, 5000000, 10000000, 25000000)),
  add column if not exists house_fee_bps smallint not null default 0 check (house_fee_bps between 0 and 250);

alter table public.game_challenges
  add constraint live_challenge_has_start check (
    (match_mode = 'async_ranked' and proposed_start_at is null)
    or (match_mode = 'live_ranked' and proposed_start_at is not null)
  ),
  add constraint wager_terms_are_complete check (
    (not wager_requested and stake_minor is null)
    or (wager_requested and match_mode = 'live_ranked' and stake_minor is not null)
  );

alter table public.pvp_matches
  add column if not exists match_mode text not null default 'async_ranked'
    check (match_mode in ('async_ranked', 'live_ranked')),
  add column if not exists scheduled_start_at timestamptz,
  add column if not exists check_in_opens_at timestamptz,
  add column if not exists betting_closes_at timestamptz,
  add column if not exists first_checked_in_at timestamptz,
  add column if not exists second_checked_in_at timestamptz,
  add column if not exists first_action_at timestamptz,
  add column if not exists ruleset_hash text not null default ('0x' || repeat('0', 64))
    check (ruleset_hash ~ '^0x[0-9a-f]{64}$'),
  add column if not exists public_sequence bigint not null default 0 check (public_sequence >= 0),
  add column if not exists wager_reference text;

create table public.arena_match_events (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  sequence bigint not null check (sequence > 0),
  event_type text not null check (event_type in (
    'scheduled','check_in_open','player_checked_in','ready','started','turn_resolved',
    'completed','cancelled','expired','voided','disputed','rescheduled','market_suspended'
  )),
  public_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (match_id, sequence)
);

create table public.match_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  proposer_wallet text not null check (proposer_wallet ~ '^0x[0-9a-f]{40}$'),
  proposed_start_at timestamptz not null,
  confirmation_hash text not null check (confirmation_hash ~ '^0x[0-9a-f]{64}$'),
  status text not null default 'proposed' check (status in ('proposed','accepted','declined','expired')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table public.match_wager_references (
  match_id uuid primary key references public.pvp_matches(id) on delete cascade,
  escrow_match_id text,
  stake_minor bigint check (stake_minor in (1000000, 5000000, 10000000, 25000000)),
  house_fee_bps smallint not null default 0 check (house_fee_bps between 0 and 250),
  state text not null default 'disabled' check (state in ('disabled','created','partially_funded','locked','result_proposed','settled','refunded','voided','disputed')),
  updated_at timestamptz not null default now()
);

create index arena_match_events_match_idx on public.arena_match_events (match_id, sequence);
create index pvp_matches_arena_schedule_idx on public.pvp_matches (match_mode, scheduled_start_at, status);
create unique index match_reschedule_one_open_idx on public.match_reschedule_requests (match_id) where status = 'proposed';

alter table public.arena_match_events enable row level security;
alter table public.match_reschedule_requests enable row level security;
alter table public.match_wager_references enable row level security;
revoke all on public.arena_match_events, public.match_reschedule_requests, public.match_wager_references from anon, authenticated;
grant all on public.arena_match_events, public.match_reschedule_requests, public.match_wager_references to service_role;

create or replace function public.next_arena_event(
  p_match_id uuid,
  p_event_type text,
  p_public_payload jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare next_sequence bigint;
begin
  update public.pvp_matches
    set public_sequence = public_sequence + 1, updated_at = now()
    where id = p_match_id
    returning public_sequence into next_sequence;
  if next_sequence is null then raise exception 'Match not found'; end if;
  insert into public.arena_match_events(match_id, sequence, event_type, public_payload)
    values (p_match_id, next_sequence, p_event_type, coalesce(p_public_payload, '{}'::jsonb));
  perform realtime.send(
    jsonb_build_object('match_id', p_match_id, 'sequence', next_sequence, 'event_type', p_event_type, 'payload', coalesce(p_public_payload, '{}'::jsonb)),
    p_event_type, 'arena:match:' || p_match_id::text, false
  );
  perform realtime.send(
    jsonb_build_object('match_id', p_match_id, 'sequence', next_sequence, 'event_type', p_event_type),
    p_event_type, 'arena:matches', false
  );
  return next_sequence;
end;
$$;
revoke all on function public.next_arena_event(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.next_arena_event(uuid,text,jsonb) to service_role;

create or replace function public.accept_game_challenge(p_challenge_id uuid, p_actor_wallet text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.game_challenges%rowtype;
  new_match_id uuid;
  discipline_word text;
  seed_commit text;
  initial_status text;
begin
  select * into c from public.game_challenges where id = p_challenge_id for update;
  if not found then raise exception 'Challenge not found'; end if;
  if c.status <> 'incoming' then raise exception 'Challenge is no longer incoming'; end if;
  if c.expires_at <= now() then
    update public.game_challenges set status = 'expired', updated_at = now() where id = c.id;
    insert into public.challenge_events(challenge_id,event_type) values(c.id,'expired');
    raise exception 'Challenge expired';
  end if;
  if c.challenged_wallet <> lower(p_actor_wallet) then raise exception 'Only the challenged owner can accept'; end if;
  if c.match_mode = 'live_ranked' and (c.proposed_start_at < now() + interval '30 minutes' or c.proposed_start_at > now() + interval '7 days') then
    raise exception 'Scheduled matches must start between 30 minutes and 7 days from acceptance';
  end if;
  if not exists(select 1 from public.nft_ownership where chain_id=8453 and token_id=c.challenger_token_id and owner_wallet_address=c.challenger_wallet and verified_at > now() - interval '2 minutes') then raise exception 'Challenger ownership is stale'; end if;
  if not exists(select 1 from public.nft_ownership where chain_id=8453 and token_id=c.challenged_token_id and owner_wallet_address=c.challenged_wallet and verified_at > now() - interval '2 minutes') then raise exception 'Challenged ownership is stale'; end if;
  if exists(select 1 from public.pvp_token_locks where token_id in (c.challenger_token_id,c.challenged_token_id)) then raise exception 'A Goon is already in a match'; end if;

  discipline_word := (array['SKATE','SHRED','WAVES','BIKE','MOTO','SLOPE'])[c.discipline + 1];
  seed_commit := '0x' || md5(gen_random_uuid()::text || clock_timestamp()::text) || md5(clock_timestamp()::text || gen_random_uuid()::text);
  initial_status := case when c.match_mode = 'live_ranked' then 'queued' else 'matched' end;
  insert into public.pvp_matches(
    discipline, match_word, first_token_id, second_token_id, first_wallet_address,
    second_wallet_address, server_seed_commit, status, started_at, action_deadline, challenge_id,
    state, match_mode, scheduled_start_at, check_in_opens_at, betting_closes_at, ruleset_hash
  ) values (
    c.discipline, discipline_word, c.challenger_token_id, c.challenged_token_id,
    c.challenger_wallet, c.challenged_wallet, seed_commit, initial_status,
    case when c.match_mode = 'async_ranked' then now() end,
    case when c.match_mode = 'async_ranked' then now()+interval '24 hours' end,
    c.id,
    jsonb_build_object('firstLosses',0,'secondLosses',0,'setterTokenId',c.challenger_token_id,'previousTrick',null,'practice','{}'::jsonb,'grit',jsonb_build_object(c.challenger_token_id::text,3,c.challenged_token_id::text,3)),
    c.match_mode, c.proposed_start_at,
    case when c.proposed_start_at is not null then c.proposed_start_at - interval '15 minutes' end,
    c.proposed_start_at, c.ruleset_hash
  ) returning id into new_match_id;
  insert into public.pvp_token_locks(token_id,match_id,wallet_address) values
    (c.challenger_token_id,new_match_id,c.challenger_wallet),
    (c.challenged_token_id,new_match_id,c.challenged_wallet);
  insert into public.match_wager_references(match_id, stake_minor, house_fee_bps, state)
    values(new_match_id, c.stake_minor, c.house_fee_bps, 'disabled');
  update public.game_challenges set status='active', match_id=new_match_id, responded_at=now(), updated_at=now() where id=c.id;
  insert into public.challenge_events(challenge_id,actor_wallet,event_type,event_data)
    values(c.id,lower(p_actor_wallet),'accepted',jsonb_build_object('matchId',new_match_id,'mode',c.match_mode,'scheduledStartAt',c.proposed_start_at));
  perform public.next_arena_event(new_match_id, case when c.match_mode='live_ranked' then 'scheduled' else 'started' end,
    jsonb_build_object('mode',c.match_mode,'scheduledStartAt',c.proposed_start_at));
  return new_match_id;
end;
$$;
revoke all on function public.accept_game_challenge(uuid,text) from public, anon, authenticated;
grant execute on function public.accept_game_challenge(uuid,text) to service_role;

create or replace function public.check_in_scheduled_match(p_match_id uuid, p_actor_wallet text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare m public.pvp_matches%rowtype;
begin
  select * into m from public.pvp_matches where id=p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if m.match_mode <> 'live_ranked' or m.status <> 'queued' then raise exception 'Match is not awaiting check-in'; end if;
  if now() < m.check_in_opens_at then raise exception 'Check-in is not open'; end if;
  if now() > m.scheduled_start_at + interval '5 minutes' then raise exception 'Check-in has closed'; end if;
  if lower(p_actor_wallet) = m.first_wallet_address then
    update public.pvp_matches set first_checked_in_at=coalesce(first_checked_in_at,now()), updated_at=now() where id=p_match_id;
  elsif lower(p_actor_wallet) = m.second_wallet_address then
    update public.pvp_matches set second_checked_in_at=coalesce(second_checked_in_at,now()), updated_at=now() where id=p_match_id;
  else raise exception 'Only match players can check in'; end if;
  select * into m from public.pvp_matches where id=p_match_id;
  perform public.next_arena_event(p_match_id,'player_checked_in',jsonb_build_object('bothReady',m.first_checked_in_at is not null and m.second_checked_in_at is not null));
  if m.first_checked_in_at is not null and m.second_checked_in_at is not null and now() >= m.scheduled_start_at then
    update public.pvp_matches set status='matched',started_at=now(),action_deadline=now()+interval '2 minutes',updated_at=now() where id=p_match_id;
    perform public.next_arena_event(p_match_id,'started','{}'::jsonb);
  elsif m.first_checked_in_at is not null and m.second_checked_in_at is not null then
    perform public.next_arena_event(p_match_id,'ready','{}'::jsonb);
  end if;
  return jsonb_build_object('matchId',p_match_id,'firstCheckedIn',m.first_checked_in_at is not null,'secondCheckedIn',m.second_checked_in_at is not null);
end;
$$;
revoke all on function public.check_in_scheduled_match(uuid,text) from public, anon, authenticated;
grant execute on function public.check_in_scheduled_match(uuid,text) to service_role;

create or replace function public.advance_scheduled_matches()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  c record;
  started_count integer := 0;
  voided_count integer := 0;
  expired_challenge_count integer := 0;
begin
  for c in
    select id from public.game_challenges
    where status = 'incoming' and expires_at <= now()
    for update skip locked
  loop
    update public.game_challenges set status='expired',updated_at=now() where id=c.id;
    insert into public.challenge_events(challenge_id,event_type) values(c.id,'expired');
    expired_challenge_count := expired_challenge_count + 1;
  end loop;

  for m in select * from public.pvp_matches where match_mode='live_ranked' and status='queued' for update skip locked loop
    if m.first_checked_in_at is not null and m.second_checked_in_at is not null and now() >= m.scheduled_start_at then
      update public.pvp_matches set status='matched',started_at=now(),action_deadline=now()+interval '2 minutes',updated_at=now() where id=m.id;
      perform public.next_arena_event(m.id,'started','{}'::jsonb);
      started_count := started_count + 1;
    elsif now() > m.scheduled_start_at + interval '5 minutes' then
      update public.pvp_matches
        set status='voided',completed_at=now(),state=jsonb_set(coalesce(state,'{}'::jsonb),'{voidReason}','"no_show"'::jsonb),updated_at=now()
        where id=m.id;
      delete from public.pvp_token_locks where match_id=m.id;
      update public.game_challenges set status='completed',updated_at=now() where match_id=m.id;
      voided_count := voided_count + 1;
    elsif now() >= m.check_in_opens_at and m.public_sequence = 1 then
      perform public.next_arena_event(m.id,'check_in_open','{}'::jsonb);
    end if;
  end loop;

  for m in
    select * from public.pvp_matches
    where status='matched' and action_deadline is not null and action_deadline < now()
    for update skip locked
  loop
    update public.pvp_matches
      set status='voided',completed_at=now(),state=jsonb_set(coalesce(state,'{}'::jsonb),'{voidReason}','"action_timeout"'::jsonb),updated_at=now()
      where id=m.id;
    delete from public.pvp_token_locks where match_id=m.id;
    update public.game_challenges set status='completed',updated_at=now() where match_id=m.id;
    voided_count := voided_count + 1;
  end loop;

  update public.match_reschedule_requests set status='expired'
    where status='proposed' and expires_at <= now();

  return jsonb_build_object('started',started_count,'voided',voided_count,'expiredChallenges',expired_challenge_count);
end;
$$;
revoke all on function public.advance_scheduled_matches() from public, anon, authenticated;
grant execute on function public.advance_scheduled_matches() to service_role;

create or replace function public.live_match_deadline()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.match_mode='live_ranked' and new.status='matched' and new.action_deadline is not null and new.next_turn_number > old.next_turn_number then
    new.action_deadline := now() + interval '2 minutes';
    new.first_action_at := coalesce(old.first_action_at, now());
    new.betting_closes_at := least(coalesce(new.betting_closes_at, now()), now());
  end if;
  return new;
end;
$$;
create trigger pvp_live_match_deadline before update on public.pvp_matches
for each row execute function public.live_match_deadline();
revoke all on function public.live_match_deadline() from public, anon, authenticated;

create or replace function public.publish_resolved_turn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.next_arena_event(new.match_id, 'turn_resolved', jsonb_build_object(
    'turn', new.turn_number,
    'action', new.action_type,
    'result', coalesce(new.result_payload, '{}'::jsonb) - 'seedReveal' - 'serverSeed' - 'nonce'
  ));
  return new;
end;
$$;
create trigger pvp_action_public_event after insert on public.pvp_match_actions
for each row execute function public.publish_resolved_turn();
revoke all on function public.publish_resolved_turn() from public, anon, authenticated;

create or replace function public.publish_terminal_match_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status in ('completed','cancelled','expired','voided','disputed') then
    perform public.next_arena_event(new.id, new.status, jsonb_build_object(
      'winnerTokenId', new.winner_token_id,
      'resultHash', new.result_hash,
      'reason', new.state ->> 'voidReason'
    ));
  end if;
  return new;
end;
$$;
create trigger pvp_terminal_public_event after update on public.pvp_matches
for each row execute function public.publish_terminal_match_status();
revoke all on function public.publish_terminal_match_status() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule(
  'gravity-goons-advance-scheduled-matches',
  '* * * * *',
  $job$select public.advance_scheduled_matches();$job$
);
