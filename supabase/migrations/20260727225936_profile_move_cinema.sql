create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null check (username ~ '^[a-z0-9][a-z0-9_-]{2,23}$'),
  display_name text not null check (char_length(display_name) between 1 and 48),
  bio text not null default '' check (char_length(bio) <= 280),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

create table public.profile_wallets (
  wallet_address text primary key check (
    wallet_address ~ '^0x[0-9a-f]{40}$'
    and wallet_address = lower(wallet_address)
  ),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_primary boolean not null default false,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index profile_wallets_one_primary_idx
  on public.profile_wallets (profile_id)
  where is_primary;

create table public.nft_ownership (
  chain_id integer not null check (chain_id > 0),
  contract_address text not null check (
    contract_address ~ '^0x[0-9a-f]{40}$'
    and contract_address = lower(contract_address)
  ),
  token_id integer not null check (token_id between 1 and 1000),
  owner_wallet_address text not null check (
    owner_wallet_address ~ '^0x[0-9a-f]{40}$'
    and owner_wallet_address = lower(owner_wallet_address)
  ),
  source text not null default 'rpc' check (source in ('rpc', 'indexer', 'transfer_event', 'demo')),
  verified_block_number bigint check (verified_block_number is null or verified_block_number >= 0),
  verified_at timestamptz not null default now(),
  primary key (chain_id, contract_address, token_id)
);

create index nft_ownership_owner_idx
  on public.nft_ownership (owner_wallet_address, chain_id, contract_address, token_id);

create table public.move_templates (
  discipline smallint not null check (discipline between 0 and 5),
  catalog_version smallint not null check (catalog_version > 0),
  trick_id smallint not null check (trick_id between 0 and 63),
  outcome text not null check (outcome in ('land', 'fall')),
  template_version smallint not null default 1 check (template_version > 0),
  provider text not null default 'seedance',
  model text not null default 'seedance-2.0-fast',
  duration_seconds smallint not null default 5 check (duration_seconds between 3 and 10),
  aspect_ratio text not null default '1:1' check (aspect_ratio in ('1:1', '16:9', '9:16')),
  prompt_template text not null check (char_length(prompt_template) between 20 and 4000),
  negative_prompt text not null default '',
  settings jsonb not null default '{}'::jsonb,
  success_count integer not null default 0 check (success_count >= 0),
  failure_count integer not null default 0 check (failure_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (discipline, catalog_version, trick_id, outcome, template_version)
);

create table public.move_media_pairs (
  id uuid primary key default gen_random_uuid(),
  chain_id integer not null default 8453 check (chain_id > 0),
  contract_address text not null check (
    contract_address ~ '^0x[0-9a-f]{40}$'
    and contract_address = lower(contract_address)
  ),
  token_id integer not null check (token_id between 1 and 1000),
  discipline smallint not null check (discipline between 0 and 5),
  catalog_version smallint not null default 1 check (catalog_version > 0),
  trick_id smallint not null check (trick_id between 0 and 63),
  template_version smallint not null default 1 check (template_version > 0),
  commissioned_by_profile_id uuid references public.profiles(id) on delete set null,
  commissioned_by_wallet text not null check (
    commissioned_by_wallet ~ '^0x[0-9a-f]{40}$'
    and commissioned_by_wallet = lower(commissioned_by_wallet)
  ),
  status text not null default 'quoted' check (status in (
    'quoted', 'paid', 'queued', 'generating', 'owner_review', 'approved',
    'rejected', 'rerolling', 'failed', 'refunding', 'refunded', 'unpublished'
  )),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain_id, contract_address, token_id, catalog_version, trick_id)
);

create index move_media_pairs_token_idx
  on public.move_media_pairs (chain_id, contract_address, token_id, status, trick_id);

create table public.move_media_assets (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.move_media_pairs(id) on delete cascade,
  outcome text not null check (outcome in ('land', 'fall')),
  version smallint not null default 1 check (version > 0),
  status text not null default 'queued' check (status in (
    'queued', 'generating', 'moderating', 'owner_review', 'approved',
    'rejected', 'failed', 'unpublished'
  )),
  provider text not null default 'seedance',
  provider_job_id text,
  source_image_url text not null,
  prompt text not null check (char_length(prompt) between 20 and 4000),
  video_url text,
  poster_url text,
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'passed', 'failed', 'manual_review')),
  owner_decision text not null default 'pending' check (owner_decision in ('pending', 'approved', 'rejected')),
  generated_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pair_id, outcome, version)
);

create index move_media_assets_pair_status_idx
  on public.move_media_assets (pair_id, outcome, status, version desc);

create table public.move_media_orders (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null unique references public.move_media_pairs(id) on delete restrict,
  profile_id uuid references public.profiles(id) on delete set null,
  payer_wallet_address text not null check (
    payer_wallet_address ~ '^0x[0-9a-f]{40}$'
    and payer_wallet_address = lower(payer_wallet_address)
  ),
  currency text not null check (currency in ('USDC', 'GAME_CREDIT')),
  amount_minor_units bigint not null check (amount_minor_units > 0),
  provider_cost_minor_units bigint not null default 0 check (provider_cost_minor_units >= 0),
  platform_margin_minor_units bigint not null default 0 check (platform_margin_minor_units >= 0),
  chain_id integer not null default 8453 check (chain_id > 0),
  payment_tx_hash text check (payment_tx_hash is null or payment_tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  payment_reference text,
  status text not null default 'quoted' check (status in ('quoted', 'submitted', 'confirmed', 'failed', 'expired', 'refunding', 'refunded')),
  quote_expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (provider_cost_minor_units + platform_margin_minor_units <= amount_minor_units)
);

create unique index move_media_orders_payment_tx_idx
  on public.move_media_orders (lower(payment_tx_hash))
  where payment_tx_hash is not null;

create table public.move_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.move_media_assets(id) on delete cascade,
  idempotency_key text not null unique,
  provider text not null default 'seedance',
  provider_job_id text,
  status text not null default 'queued' check (status in ('queued', 'submitted', 'processing', 'succeeded', 'failed', 'cancelled')),
  attempt smallint not null default 1 check (attempt between 1 and 10),
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index move_generation_provider_job_idx
  on public.move_generation_jobs (provider, provider_job_id)
  where provider_job_id is not null;

create table public.move_media_reviews (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.move_media_assets(id) on delete cascade,
  reviewer_wallet_address text not null check (
    reviewer_wallet_address ~ '^0x[0-9a-f]{40}$'
    and reviewer_wallet_address = lower(reviewer_wallet_address)
  ),
  decision text not null check (decision in ('approved', 'rejected', 'reroll')),
  note text not null default '' check (char_length(note) <= 500),
  ownership_verified_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index move_media_reviews_asset_created_idx
  on public.move_media_reviews (asset_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger move_templates_set_updated_at before update on public.move_templates
for each row execute function public.set_updated_at();
create trigger move_media_pairs_set_updated_at before update on public.move_media_pairs
for each row execute function public.set_updated_at();
create trigger move_media_assets_set_updated_at before update on public.move_media_assets
for each row execute function public.set_updated_at();
create trigger move_media_orders_set_updated_at before update on public.move_media_orders
for each row execute function public.set_updated_at();
create trigger move_generation_jobs_set_updated_at before update on public.move_generation_jobs
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.profile_wallets enable row level security;
alter table public.nft_ownership enable row level security;
alter table public.move_templates enable row level security;
alter table public.move_media_pairs enable row level security;
alter table public.move_media_assets enable row level security;
alter table public.move_media_orders enable row level security;
alter table public.move_generation_jobs enable row level security;
alter table public.move_media_reviews enable row level security;

revoke all on public.profiles, public.profile_wallets, public.nft_ownership,
  public.move_templates, public.move_media_pairs, public.move_media_assets,
  public.move_media_orders, public.move_generation_jobs, public.move_media_reviews
  from anon, authenticated;

grant select on public.profiles, public.profile_wallets, public.nft_ownership, public.move_media_pairs to anon, authenticated;
grant select on public.move_media_assets to anon, authenticated;
grant all on public.profiles, public.profile_wallets, public.nft_ownership, public.move_templates, public.move_media_pairs, public.move_media_assets, public.move_media_orders, public.move_generation_jobs, public.move_media_reviews to service_role;

create policy "Public profiles are readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Verified profile wallets are readable"
  on public.profile_wallets for select
  to anon, authenticated
  using (true);

create policy "Verified NFT ownership is readable"
  on public.nft_ownership for select
  to anon, authenticated
  using (true);

create policy "Move pair progress is readable"
  on public.move_media_pairs for select
  to anon, authenticated
  using (true);

create policy "Only approved landing assets are public"
  on public.move_media_assets for select
  to anon, authenticated
  using (
    outcome = 'land'
    and status = 'approved'
    and owner_decision = 'approved'
    and moderation_status = 'passed'
    and published_at is not null
  );

comment on table public.profiles is 'Public Gravity Goons usernames. Mutations are server-only after wallet-signature verification.';
comment on table public.profile_wallets is 'Verified wallet-to-profile links. A wallet may belong to only one Gravity Goons profile.';
comment on table public.nft_ownership is 'Server-refreshed Base ownership index used for profile collection display and owner authorization.';
comment on table public.move_templates is 'Versioned shared choreography recipes. Finished videos are never reused across NFT identities.';
comment on table public.move_media_pairs is 'One purchased LAND/FALL movie pair for a single NFT trick. Cosmetic only; never changes gameplay.';
comment on table public.move_media_assets is 'Private drafts plus public approved LAND assets. FALL URLs are never available through public RLS.';
comment on table public.move_media_orders is 'Server-only USDC or non-transferable game-credit quote and payment ledger.';
comment on table public.move_generation_jobs is 'Server-only asynchronous Seedance job ledger with idempotency and retry evidence.';
comment on table public.move_media_reviews is 'Owner approval, rejection, and reroll audit trail after current ownership verification.';
