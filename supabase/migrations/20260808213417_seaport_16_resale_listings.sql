create table public.seaport_listings (
  id uuid primary key default gen_random_uuid(),
  chain_id integer not null default 8453 check (chain_id = 8453),
  protocol_address text not null check (protocol_address = '0x0000000000000068f116a894984e2db1123eb395'),
  order_hash text not null unique check (order_hash ~ '^0x[0-9a-f]{64}$'),
  token_id integer not null check (token_id between 1 and 1000),
  offerer_wallet text not null check (offerer_wallet ~ '^0x[0-9a-f]{40}$'),
  payment_token text not null check (payment_token ~ '^0x[0-9a-f]{40}$'),
  currency text not null check (currency in ('ETH','USDC')),
  price_minor numeric(78,0) not null check (price_minor > 0),
  royalty_recipient text not null check (royalty_recipient ~ '^0x[0-9a-f]{40}$'),
  royalty_minor numeric(78,0) not null check (royalty_minor >= 0),
  order_payload jsonb not null,
  status text not null default 'active' check (status in ('active','fulfilled','cancelled','expired','invalid')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  fulfillment_tx_hash text check (fulfillment_tx_hash is null or fulfillment_tx_hash ~ '^0x[0-9a-f]{64}$'),
  cancellation_tx_hash text check (cancellation_tx_hash is null or cancellation_tx_hash ~ '^0x[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at),
  check (jsonb_typeof(order_payload) = 'object')
);

create unique index seaport_listings_one_active_token_idx on public.seaport_listings(token_id) where status = 'active';
create index seaport_listings_offeror_idx on public.seaport_listings(offerer_wallet, status, created_at desc);
create index seaport_listings_active_expiry_idx on public.seaport_listings(status, expires_at);

alter table public.seaport_listings enable row level security;
revoke all on public.seaport_listings from public, anon, authenticated;
grant all on public.seaport_listings to service_role;

comment on table public.seaport_listings is
  'Off-chain Seaport 1.6 order book for Gravity Goons. NFTs remain in seller wallets until fulfillment.';
