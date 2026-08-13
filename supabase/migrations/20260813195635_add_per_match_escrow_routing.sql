create table public.match_escrow_deployments (
  version text primary key check (version ~ '^v[0-9]+$'),
  chain_id bigint not null default 8453 check (chain_id = 8453),
  escrow_address text not null unique check (escrow_address ~ '^0x[0-9a-f]{40}$'),
  correction_window_seconds integer not null check (correction_window_seconds between 60 and 604800),
  accepts_new_wagers boolean not null default false,
  deployed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index match_escrow_one_active_version_idx
  on public.match_escrow_deployments (accepts_new_wagers)
  where accepts_new_wagers;

alter table public.match_escrow_deployments enable row level security;
revoke all on public.match_escrow_deployments from public, anon, authenticated;
grant all on public.match_escrow_deployments to service_role;

insert into public.match_escrow_deployments(
  version, escrow_address, correction_window_seconds, accepts_new_wagers, deployed_at
) values (
  'v1',
  '0x01fdffd42229edfd2148773c57426368cd48b1da',
  86400,
  true,
  '2026-08-10T22:52:45Z'
) on conflict (version) do nothing;

alter table public.match_wager_references
  add column if not exists escrow_version text references public.match_escrow_deployments(version),
  add column if not exists escrow_address text check (
    escrow_address is null or escrow_address ~ '^0x[0-9a-f]{40}$'
  ),
  add column if not exists correction_window_seconds integer check (
    correction_window_seconds is null or correction_window_seconds between 60 and 604800
  );

update public.match_wager_references
set escrow_version = 'v1',
    escrow_address = '0x01fdffd42229edfd2148773c57426368cd48b1da',
    correction_window_seconds = 86400,
    updated_at = now()
where state <> 'disabled'
  and escrow_version is null;

create or replace function public.initialize_match_wager_reference()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  wager_requested boolean;
  scheduled_start timestamptz;
  deployment public.match_escrow_deployments%rowtype;
begin
  select c.wager_requested, m.scheduled_start_at
    into wager_requested, scheduled_start
  from public.pvp_matches m
  join public.game_challenges c on c.id = m.challenge_id
  where m.id = new.match_id;

  if coalesce(wager_requested, false) then
    if scheduled_start is null then raise exception 'Wagered matches must be scheduled'; end if;
    select * into deployment
      from public.match_escrow_deployments
      where accepts_new_wagers
      for share;
    if not found then raise exception 'No match escrow accepts new wagers'; end if;
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

create or replace function public.prevent_match_escrow_reroute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.escrow_version is distinct from new.escrow_version
    or old.escrow_address is distinct from new.escrow_address
    or old.correction_window_seconds is distinct from new.correction_window_seconds then
    raise exception 'A match escrow route is immutable after creation';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_match_escrow_reroute_trigger on public.match_wager_references;
create trigger prevent_match_escrow_reroute_trigger
before update of escrow_version, escrow_address, correction_window_seconds
on public.match_wager_references
for each row execute function public.prevent_match_escrow_reroute();

revoke all on function public.prevent_match_escrow_reroute() from public, anon, authenticated;
grant execute on function public.prevent_match_escrow_reroute() to service_role;

comment on table public.match_escrow_deployments is
  'Server-only registry selecting the escrow for new wagers. Existing matches retain their immutable route.';
comment on column public.match_wager_references.escrow_address is
  'Immutable Base escrow address used for this specific match.';
