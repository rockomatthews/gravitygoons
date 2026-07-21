create table public.athlete_sponsor_progress (
  token_id integer primary key check (token_id between 1 and 1000),
  verified_ranked_wins integer not null default 0 check (verified_ranked_wins >= 0),
  active_sponsor_id text,
  unlocked_trick_bitmap bit(64) not null default B'0000000000000000000000000000000000000000000000000000000000001111',
  catalog_version smallint not null default 1 check (catalog_version > 0),
  updated_at timestamptz not null default now()
);

create table public.athlete_sponsors (
  token_id integer not null references public.athlete_sponsor_progress(token_id) on delete cascade,
  sponsor_id text not null check (sponsor_id ~ '^[a-z0-9-]{2,32}$'),
  milestone_wins integer not null check (milestone_wins in (5, 15, 30, 50, 100)),
  accepted_at_wins integer not null check (accepted_at_wins >= milestone_wins),
  source_match_id uuid references public.pvp_matches(id),
  accepted_at timestamptz not null default now(),
  primary key (token_id, sponsor_id),
  unique (token_id, milestone_wins)
);

create table public.athlete_sponsor_offers (
  id uuid primary key default gen_random_uuid(),
  token_id integer not null references public.athlete_sponsor_progress(token_id) on delete cascade,
  milestone_wins integer not null check (milestone_wins in (5, 15, 30, 50, 100)),
  first_sponsor_id text not null check (first_sponsor_id ~ '^[a-z0-9-]{2,32}$'),
  second_sponsor_id text not null check (second_sponsor_id ~ '^[a-z0-9-]{2,32}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  accepted_sponsor_id text,
  offered_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (first_sponsor_id <> second_sponsor_id),
  check (accepted_sponsor_id is null or accepted_sponsor_id in (first_sponsor_id, second_sponsor_id)),
  check ((status = 'accepted') = (accepted_sponsor_id is not null and accepted_at is not null))
);

create unique index athlete_sponsor_pending_offer_idx
  on public.athlete_sponsor_offers (token_id, milestone_wins)
  where status = 'pending';

create table public.pvp_match_rewards (
  match_id uuid primary key references public.pvp_matches(id) on delete restrict,
  winner_token_id integer not null references public.athlete_sponsor_progress(token_id),
  ranked_win_credited boolean not null default false,
  reward_status text not null default 'pending' check (reward_status in ('pending', 'settled', 'voided', 'reversed')),
  evidence_hash text not null check (evidence_hash ~ '^0x[0-9a-fA-F]{64}$'),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  check ((reward_status = 'settled') = (ranked_win_credited and settled_at is not null))
);

create index athlete_sponsors_token_accepted_idx on public.athlete_sponsors (token_id, accepted_at desc);
create index athlete_sponsor_offers_token_status_idx on public.athlete_sponsor_offers (token_id, status, milestone_wins);

alter table public.athlete_sponsor_progress enable row level security;
alter table public.athlete_sponsors enable row level security;
alter table public.athlete_sponsor_offers enable row level security;
alter table public.pvp_match_rewards enable row level security;

grant select on public.athlete_sponsor_progress, public.athlete_sponsors to anon, authenticated;
grant all on public.athlete_sponsor_progress, public.athlete_sponsors, public.athlete_sponsor_offers, public.pvp_match_rewards to service_role;

create policy "Public sponsor progression is readable"
  on public.athlete_sponsor_progress for select
  to anon, authenticated
  using (true);

create policy "Public athlete sponsors are readable"
  on public.athlete_sponsors for select
  to anon, authenticated
  using (true);

comment on table public.athlete_sponsor_progress is 'Public settled sponsor career state. Only the trusted game service may write verified wins or trick unlocks.';
comment on table public.athlete_sponsors is 'Permanent sponsor history attached to the NFT and retained through transfers.';
comment on table public.athlete_sponsor_offers is 'Private server-controlled sponsor choices. Acceptance APIs must verify current Base NFT ownership.';
comment on table public.pvp_match_rewards is 'Idempotency ledger preventing one ranked match from crediting sponsor progression more than once.';
