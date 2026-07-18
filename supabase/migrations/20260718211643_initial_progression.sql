create extension if not exists pgcrypto;

create table public.trick_catalog (
  discipline smallint not null check (discipline between 0 and 5),
  catalog_version smallint not null check (catalog_version > 0),
  trick_id smallint not null check (trick_id between 0 and 63),
  display_name text not null check (char_length(display_name) between 1 and 80),
  difficulty smallint not null check (difficulty between 1 and 10),
  xp_reward integer not null check (xp_reward > 0),
  prerequisite_bitmap bigint not null default 0 check (prerequisite_bitmap >= 0),
  animation_identifier text not null check (char_length(animation_identifier) between 1 and 120),
  primary key (discipline, catalog_version, trick_id)
);

create table public.progress_cache (
  token_id integer primary key check (token_id between 1 and 1000),
  discipline smallint not null check (discipline between 0 and 5),
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  trick_bitmap numeric(20, 0) not null default 0 check (trick_bitmap >= 0),
  achievement_bitmap numeric(20, 0) not null default 0 check (achievement_bitmap >= 0),
  catalog_version smallint not null default 1 check (catalog_version > 0),
  chain_nonce integer not null default 0 check (chain_nonce >= 0),
  settlement_tx_hash text,
  settled_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  token_id integer not null check (token_id between 1 and 1000),
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  discipline smallint not null check (discipline between 0 and 5),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score integer check (score >= 0),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'started' check (status in ('started', 'completed', 'validated', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.pending_progress_claims (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  token_id integer not null check (token_id between 1 and 1000),
  xp bigint not null check (xp >= 0),
  level integer not null check (level >= 1),
  trick_bitmap numeric(20, 0) not null check (trick_bitmap >= 0),
  achievement_bitmap numeric(20, 0) not null check (achievement_bitmap >= 0),
  catalog_version smallint not null check (catalog_version > 0),
  discipline smallint not null check (discipline between 0 and 5),
  chain_nonce integer not null check (chain_nonce >= 0),
  deadline timestamptz not null,
  typed_data jsonb not null,
  signature text,
  status text not null default 'pending' check (status in ('pending', 'signed', 'submitted', 'settled', 'rejected', 'expired')),
  settlement_tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token_id, chain_nonce)
);

create table public.seasonal_leaderboard (
  season integer not null check (season > 0),
  token_id integer not null check (token_id between 1 and 1000),
  discipline smallint not null check (discipline between 0 and 5),
  season_xp bigint not null default 0 check (season_xp >= 0),
  best_score integer not null default 0 check (best_score >= 0),
  updated_at timestamptz not null default now(),
  primary key (season, token_id)
);

create index game_sessions_token_created_idx on public.game_sessions (token_id, created_at desc);
create index game_sessions_wallet_created_idx on public.game_sessions (lower(wallet_address), created_at desc);
create index pending_progress_status_idx on public.pending_progress_claims (status, created_at);
create index seasonal_leaderboard_rank_idx on public.seasonal_leaderboard (season, discipline, season_xp desc, best_score desc);

alter table public.trick_catalog enable row level security;
alter table public.progress_cache enable row level security;
alter table public.game_sessions enable row level security;
alter table public.pending_progress_claims enable row level security;
alter table public.seasonal_leaderboard enable row level security;

grant select on public.trick_catalog to anon, authenticated;
grant select on public.progress_cache to anon, authenticated;
grant select on public.seasonal_leaderboard to anon, authenticated;
grant all on public.trick_catalog, public.progress_cache, public.game_sessions, public.pending_progress_claims, public.seasonal_leaderboard to service_role;

create policy "Public trick catalog is readable"
  on public.trick_catalog for select
  to anon, authenticated
  using (true);

create policy "Settled progress is readable"
  on public.progress_cache for select
  to anon, authenticated
  using (true);

create policy "Seasonal leaderboard is readable"
  on public.seasonal_leaderboard for select
  to anon, authenticated
  using (true);

comment on table public.game_sessions is 'Server-only game evidence. Never grant browser write access.';
comment on table public.pending_progress_claims is 'Server-only EIP-712 claim staging and settlement audit trail.';
