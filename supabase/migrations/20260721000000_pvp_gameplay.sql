create table public.pvp_matches (
  id uuid primary key default gen_random_uuid(),
  ruleset_version smallint not null default 1 check (ruleset_version > 0),
  season integer not null default 1 check (season > 0),
  discipline smallint not null check (discipline between 0 and 5),
  match_word text not null check (match_word ~ '^[A-Z]{3,8}$'),
  first_token_id integer not null check (first_token_id between 1 and 1000),
  second_token_id integer not null check (second_token_id between 1 and 1000),
  first_wallet_address text not null check (first_wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  second_wallet_address text not null check (second_wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  winner_token_id integer check (winner_token_id between 1 and 1000),
  loser_token_id integer check (loser_token_id between 1 and 1000),
  server_seed_commit text not null check (server_seed_commit ~ '^0x[0-9a-fA-F]{64}$'),
  server_seed_reveal text,
  result_hash text check (result_hash is null or result_hash ~ '^0x[0-9a-fA-F]{64}$'),
  status text not null default 'queued' check (status in ('queued', 'matched', 'locking', 'revealed', 'resolving', 'completed', 'cancelled', 'expired', 'disputed', 'voided')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (first_token_id <> second_token_id),
  check (lower(first_wallet_address) <> lower(second_wallet_address)),
  check (winner_token_id is null or winner_token_id in (first_token_id, second_token_id)),
  check (loser_token_id is null or loser_token_id in (first_token_id, second_token_id)),
  check (winner_token_id is null or loser_token_id is null or winner_token_id <> loser_token_id)
);

create table public.pvp_rounds (
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  round_number smallint not null check (round_number > 0),
  first_choice_commit text not null check (first_choice_commit ~ '^0x[0-9a-fA-F]{64}$'),
  second_choice_commit text not null check (second_choice_commit ~ '^0x[0-9a-fA-F]{64}$'),
  first_trick_id smallint check (first_trick_id between 0 and 63),
  second_trick_id smallint check (second_trick_id between 0 and 63),
  first_client_nonce text,
  second_client_nonce text,
  first_landing_chance smallint check (first_landing_chance between 0 and 100),
  second_landing_chance smallint check (second_landing_chance between 0 and 100),
  first_originality smallint check (first_originality between 0 and 100),
  second_originality smallint check (second_originality between 0 and 100),
  first_landed boolean,
  second_landed boolean,
  first_performance numeric(8, 2) check (first_performance >= 0),
  second_performance numeric(8, 2) check (second_performance >= 0),
  winner_token_id integer check (winner_token_id between 1 and 1000),
  loser_token_id integer check (loser_token_id between 1 and 1000),
  letter_awarded text check (letter_awarded is null or letter_awarded ~ '^[A-Z]$'),
  round_seed_reveal text,
  transcript jsonb not null default '{}'::jsonb,
  status text not null default 'locking' check (status in ('locking', 'revealed', 'resolved', 'voided', 'disputed')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (match_id, round_number)
);

create table public.athlete_battle_records (
  token_id integer primary key check (token_id between 1 and 1000),
  discipline smallint not null check (discipline between 0 and 5),
  matches_played integer not null default 0 check (matches_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  current_streak integer not null default 0,
  best_streak integer not null default 0 check (best_streak >= 0),
  rating numeric(8, 2) not null default 1500 check (rating >= 0),
  rating_deviation numeric(8, 2) not null default 350 check (rating_deviation > 0),
  updated_at timestamptz not null default now(),
  check (wins + losses + draws = matches_played)
);

create table public.wallet_battle_records (
  wallet_address text primary key check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  matches_played integer not null default 0 check (matches_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  rating numeric(8, 2) not null default 1500 check (rating >= 0),
  rating_deviation numeric(8, 2) not null default 350 check (rating_deviation > 0),
  updated_at timestamptz not null default now(),
  check (wins + losses + draws = matches_played)
);

create table public.spectator_predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  predicted_token_id integer not null check (predicted_token_id between 1 and 1000),
  stake_type text not null default 'play_points' check (stake_type in ('play_points', 'licensed_partner')),
  amount numeric(20, 0) not null check (amount > 0),
  result text check (result is null or result in ('won', 'lost', 'voided')),
  settled_amount numeric(20, 0) check (settled_amount is null or settled_amount >= 0),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (match_id, wallet_address),
  check (stake_type <> 'play_points' or settled_amount is null or settled_amount >= 0)
);

create index pvp_matches_status_created_idx on public.pvp_matches (status, created_at desc);
create index pvp_matches_tokens_created_idx on public.pvp_matches (first_token_id, second_token_id, created_at desc);
create index pvp_rounds_match_status_idx on public.pvp_rounds (match_id, status, round_number);
create index spectator_predictions_match_idx on public.spectator_predictions (match_id, created_at);

alter table public.pvp_matches enable row level security;
alter table public.pvp_rounds enable row level security;
alter table public.athlete_battle_records enable row level security;
alter table public.wallet_battle_records enable row level security;
alter table public.spectator_predictions enable row level security;

grant select on public.athlete_battle_records to anon, authenticated;
grant all on public.pvp_matches, public.pvp_rounds, public.athlete_battle_records, public.wallet_battle_records, public.spectator_predictions to service_role;

create policy "Public athlete records are readable"
  on public.athlete_battle_records for select
  to anon, authenticated
  using (true);

comment on table public.pvp_matches is 'Server-authoritative PvP match state. Browser clients must use guarded APIs and wallet-signed actions.';
comment on table public.pvp_rounds is 'Commit-reveal choices and deterministic round evidence. Do not expose unrevealed choices or secrets.';
comment on table public.wallet_battle_records is 'Player skill belongs to the wallet and is intentionally separate from the transferable athlete record.';
comment on table public.spectator_predictions is 'Play-point predictions only by default. Real-value stakes require a separately licensed and compliant operator.';
