insert into public.match_escrow_deployments(
  version, escrow_address, correction_window_seconds, accepts_new_wagers, deployed_at
) values (
  'v2',
  '0xda1ff1521f67ca1f40cc32140d992299e81f9efe',
  600,
  false,
  '2026-08-13T20:48:54Z'::timestamptz
)
on conflict (version) do update
set escrow_address = excluded.escrow_address,
    correction_window_seconds = excluded.correction_window_seconds,
    deployed_at = excluded.deployed_at;

create table public.match_escrow_test_pairs (
  wallet_low text not null check (wallet_low ~ '^0x[0-9a-f]{40}$'),
  wallet_high text not null check (wallet_high ~ '^0x[0-9a-f]{40}$'),
  escrow_version text not null references public.match_escrow_deployments(version),
  enabled boolean not null default true,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (wallet_low, wallet_high),
  check (wallet_low < wallet_high)
);

alter table public.match_escrow_test_pairs enable row level security;
revoke all on public.match_escrow_test_pairs from public, anon, authenticated;
grant all on public.match_escrow_test_pairs to service_role;

create index match_escrow_test_pairs_active_idx
  on public.match_escrow_test_pairs (expires_at)
  where enabled;

create or replace function public.initialize_match_wager_reference()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  wager_requested boolean;
  scheduled_start timestamptz;
  challenger_wallet text;
  challenged_wallet text;
  test_version text;
  deployment public.match_escrow_deployments%rowtype;
begin
  select c.wager_requested, m.scheduled_start_at, c.challenger_wallet, c.challenged_wallet
    into wager_requested, scheduled_start, challenger_wallet, challenged_wallet
  from public.pvp_matches m
  join public.game_challenges c on c.id = m.challenge_id
  where m.id = new.match_id;

  if coalesce(wager_requested, false) then
    if scheduled_start is null then raise exception 'Wagered matches must be scheduled'; end if;

    select p.escrow_version into test_version
      from public.match_escrow_test_pairs p
      where p.wallet_low = least(challenger_wallet, challenged_wallet)
        and p.wallet_high = greatest(challenger_wallet, challenged_wallet)
        and p.enabled
        and p.expires_at > now();

    if test_version is not null then
      select * into deployment
        from public.match_escrow_deployments
        where version = test_version
        for share;
    else
      select * into deployment
        from public.match_escrow_deployments
        where accepts_new_wagers
        for share;
    end if;

    if not found then raise exception 'No match escrow route is configured'; end if;
    new.escrow_match_id := public.escrow_match_id_for_uuid(new.match_id);
    new.escrow_version := deployment.version;
    new.escrow_address := deployment.escrow_address;
    new.correction_window_seconds := deployment.correction_window_seconds;
    new.funding_deadline := scheduled_start;
    new.state := 'created';
  else
    new.escrow_version := null;
    new.escrow_address := null;
    new.correction_window_seconds := null;
    new.state := 'disabled';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.initialize_match_wager_reference() from public, anon, authenticated;
grant execute on function public.initialize_match_wager_reference() to service_role;

comment on table public.match_escrow_test_pairs is
  'Server-only exact wallet-pair allowlist for testing an inactive escrow before the public cutover.';
