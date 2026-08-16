create table public.circuit_runs (
  id uuid primary key default gen_random_uuid(),
  token_id integer not null check (token_id between 1 and 1000),
  wallet_at_start text not null,
  level_id text not null,
  discipline text not null,
  server_seed text not null,
  seed_commitment text not null,
  access_key_hash text not null,
  sequence integer not null default 0 check (sequence between 0 and 5),
  score integer not null default 0 check (score >= 0),
  momentum integer not null default 0 check (momentum between 0 and 12),
  damage integer not null default 0 check (damage >= 0),
  status text not null default 'active' check (status in ('active','complete','wrecked','expired')),
  transcript jsonb not null default '[]'::jsonb,
  ruleset_version text not null default 'blackout-circuit-v1',
  content_version text not null default 'season-one-v1',
  action_deadline timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index one_active_circuit_run_per_goon on public.circuit_runs(token_id) where status = 'active';
create index circuit_runs_wallet_created on public.circuit_runs(lower(wallet_at_start), created_at desc);

create table public.circuit_level_records (
  token_id integer not null check (token_id between 1 and 1000),
  level_id text not null,
  best_score integer not null default 0,
  best_medal text not null default 'none' check (best_medal in ('none','bronze','silver','gold')),
  completions integer not null default 0,
  first_clear_claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (token_id, level_id)
);

create table public.circuit_licenses (
  token_id integer primary key check (token_id between 1 and 1000),
  completed_levels integer not null default 0,
  bronze_medals integer not null default 0,
  silver_medals integer not null default 0,
  gold_medals integer not null default 0,
  circuit_xp integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.circuit_runs enable row level security;
alter table public.circuit_level_records enable row level security;
alter table public.circuit_licenses enable row level security;

revoke all on public.circuit_runs, public.circuit_level_records, public.circuit_licenses from public, anon, authenticated;
grant all on public.circuit_runs, public.circuit_level_records, public.circuit_licenses to service_role;

comment on table public.circuit_runs is 'Server-authoritative Blackout Circuit sessions. Seeds and transcripts are never exposed directly.';
comment on table public.circuit_level_records is 'Permanent token-bound Blackout Circuit level records.';
comment on table public.circuit_licenses is 'Persistent Circuit career summary that follows the NFT.';
