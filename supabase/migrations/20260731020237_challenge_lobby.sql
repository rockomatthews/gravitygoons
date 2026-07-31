create table public.game_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_token_id integer not null check (challenger_token_id between 1 and 1000),
  challenged_token_id integer not null check (challenged_token_id between 1 and 1000),
  challenger_wallet text not null check (challenger_wallet ~ '^0x[0-9a-f]{40}$'),
  challenged_wallet text not null check (challenged_wallet ~ '^0x[0-9a-f]{40}$'),
  discipline smallint not null check (discipline between 0 and 5),
  status text not null default 'incoming' check (status in ('incoming','accepted','declined','cancelled','expired','active','completed')),
  confirmation_hash text not null check (confirmation_hash ~ '^0x[0-9a-f]{64}$'),
  match_id uuid references public.pvp_matches(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (challenger_token_id <> challenged_token_id),
  check (challenger_wallet <> challenged_wallet)
);

create table public.challenge_events (
  id bigint generated always as identity primary key,
  challenge_id uuid not null references public.game_challenges(id) on delete cascade,
  actor_wallet text check (actor_wallet is null or actor_wallet ~ '^0x[0-9a-f]{40}$'),
  event_type text not null check (event_type in ('created','accepted','declined','cancelled','expired','activated','completed','ownership_rejected','disputed','voided')),
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.pvp_token_locks (
  token_id integer primary key check (token_id between 1 and 1000),
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  locked_at timestamptz not null default now()
);

create table public.pvp_match_actions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  turn_number integer not null check (turn_number > 0),
  idempotency_key uuid not null,
  action_type text not null check (action_type in ('call_trick','answer_trick','use_grit','timeout','dispute')),
  request_payload jsonb not null,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  unique (match_id, idempotency_key),
  unique (match_id, turn_number)
);

alter table public.pvp_matches
  add column if not exists challenge_id uuid references public.game_challenges(id) on delete set null,
  add column if not exists next_turn_number integer not null default 1 check (next_turn_number > 0),
  add column if not exists state jsonb not null default '{"firstLosses":0,"secondLosses":0,"setterTokenId":null,"previousTrick":null,"practice":{},"grit":{}}'::jsonb,
  add column if not exists action_deadline timestamptz,
  add column if not exists settlement_version smallint not null default 1;

create unique index game_challenges_open_pair_idx
  on public.game_challenges (least(challenger_token_id, challenged_token_id), greatest(challenger_token_id, challenged_token_id))
  where status in ('incoming','accepted','active');
create index game_challenges_challenger_idx on public.game_challenges (challenger_wallet, status, created_at desc);
create index game_challenges_challenged_idx on public.game_challenges (challenged_wallet, status, created_at desc);
create index challenge_events_challenge_idx on public.challenge_events (challenge_id, created_at);
create index pvp_match_actions_match_idx on public.pvp_match_actions (match_id, turn_number);

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
  if not exists(select 1 from public.nft_ownership where chain_id=8453 and token_id=c.challenger_token_id and owner_wallet_address=c.challenger_wallet and verified_at > now() - interval '2 minutes') then raise exception 'Challenger ownership is stale'; end if;
  if not exists(select 1 from public.nft_ownership where chain_id=8453 and token_id=c.challenged_token_id and owner_wallet_address=c.challenged_wallet and verified_at > now() - interval '2 minutes') then raise exception 'Challenged ownership is stale'; end if;
  if exists(select 1 from public.pvp_token_locks where token_id in (c.challenger_token_id,c.challenged_token_id)) then raise exception 'A Goon is already in a match'; end if;

  discipline_word := (array['SKATE','SHRED','WAVES','BIKE','MOTO','SLOPE'])[c.discipline + 1];
  seed_commit := '0x' || md5(gen_random_uuid()::text || clock_timestamp()::text) || md5(clock_timestamp()::text || gen_random_uuid()::text);
  insert into public.pvp_matches(
    discipline, match_word, first_token_id, second_token_id, first_wallet_address,
    second_wallet_address, server_seed_commit, status, started_at, action_deadline, challenge_id,
    state
  ) values (
    c.discipline, discipline_word, c.challenger_token_id, c.challenged_token_id,
    c.challenger_wallet, c.challenged_wallet, seed_commit, 'matched', now(), now()+interval '24 hours', c.id,
    jsonb_build_object('firstLosses',0,'secondLosses',0,'setterTokenId',c.challenger_token_id,'previousTrick',null,'practice','{}'::jsonb,'grit',jsonb_build_object(c.challenger_token_id::text,3,c.challenged_token_id::text,3))
  ) returning id into new_match_id;
  insert into public.pvp_token_locks(token_id,match_id,wallet_address) values
    (c.challenger_token_id,new_match_id,c.challenger_wallet),
    (c.challenged_token_id,new_match_id,c.challenged_wallet);
  update public.game_challenges set status='active', match_id=new_match_id, responded_at=now(), updated_at=now() where id=c.id;
  insert into public.challenge_events(challenge_id,actor_wallet,event_type,event_data)
    values(c.id,lower(p_actor_wallet),'accepted',jsonb_build_object('matchId',new_match_id));
  return new_match_id;
end;
$$;

revoke all on function public.accept_game_challenge(uuid,text) from public, anon, authenticated;
grant execute on function public.accept_game_challenge(uuid,text) to service_role;

create or replace view public.discipline_ranks
with (security_invoker=true) as
select
  token_id, discipline, matches_played, wins, losses, draws, current_streak, rating,
  case when matches_played < 5 then null else dense_rank() over (
    partition by discipline order by rating desc, wins desc, token_id asc
  ) end as discipline_rank
from public.athlete_battle_records;

alter table public.game_challenges enable row level security;
alter table public.challenge_events enable row level security;
alter table public.pvp_token_locks enable row level security;
alter table public.pvp_match_actions enable row level security;
revoke all on public.game_challenges, public.challenge_events, public.pvp_token_locks, public.pvp_match_actions from anon, authenticated;
grant all on public.game_challenges, public.challenge_events, public.pvp_token_locks, public.pvp_match_actions to service_role;
grant select on public.discipline_ranks to anon, authenticated;

create or replace function public.broadcast_challenge_change()
returns trigger
security definer
language plpgsql
set search_path = public
as $$
begin
  perform realtime.broadcast_changes('wallet:' || new.challenger_wallet, tg_op, tg_op, tg_table_name, tg_table_schema, new, old);
  perform realtime.broadcast_changes('wallet:' || new.challenged_wallet, tg_op, tg_op, tg_table_name, tg_table_schema, new, old);
  return new;
end;
$$;
create trigger game_challenges_broadcast after insert or update on public.game_challenges
for each row execute function public.broadcast_challenge_change();

create or replace function public.broadcast_match_change()
returns trigger
security definer
language plpgsql
set search_path = public
as $$
begin
  perform realtime.broadcast_changes('match:' || new.id::text, tg_op, tg_op, tg_table_name, tg_table_schema, new, old);
  return new;
end;
$$;
create trigger pvp_matches_broadcast after update on public.pvp_matches
for each row execute function public.broadcast_match_change();

create policy "Authenticated wallet can receive its private lobby broadcasts"
on realtime.messages for select to authenticated
using (
  topic = 'wallet:' || lower(coalesce(auth.jwt() ->> 'wallet_address', ''))
  or (
    topic like 'match:%'
    and exists (
      select 1 from public.pvp_matches m
      where m.id::text = substring(topic from 7)
      and lower(coalesce(auth.jwt() ->> 'wallet_address', '')) in (m.first_wallet_address, m.second_wallet_address)
    )
  )
);

comment on table public.game_challenges is 'Server-controlled, non-wagering ranked challenge lifecycle. Default expiry is 72 hours.';
comment on table public.challenge_events is 'Append-only audit ledger for challenge transitions and validation failures.';
comment on table public.pvp_match_actions is 'Idempotent, monotonic wallet-authenticated authoritative match commands.';
