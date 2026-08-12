-- Gravity Goons Gooniverse foundation.
-- Mutable state is keyed to token_id. Wallet addresses are audit evidence only;
-- API routes must revalidate current Base ownership before every mutation.

create extension if not exists pgcrypto;

create table public.goon_seasons (
  id text primary key,
  title text not null,
  story text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null check (status in ('preview', 'active', 'archived')),
  created_at timestamptz not null default now()
);

create table public.goon_economies (
  token_id integer primary key check (token_id between 1 and 1000),
  grit_balance integer not null default 0 check (grit_balance >= 0),
  grit_reserved integer not null default 0 check (grit_reserved >= 0),
  lifetime_grit_earned integer not null default 0 check (lifetime_grit_earned >= 0),
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  updated_at timestamptz not null default now()
);

create table public.goon_economy_events (
  id uuid primary key default gen_random_uuid(),
  token_id integer not null check (token_id between 1 and 1000),
  idempotency_key text not null unique,
  event_type text not null check (event_type in ('earn', 'spend', 'reserve', 'release', 'reward', 'craft', 'repair', 'admin_correction')),
  grit_balance_delta integer not null default 0,
  grit_reserved_delta integer not null default 0,
  xp_delta integer not null default 0,
  material_key text check (material_key is null or material_key in ('scrap', 'threads', 'grip', 'pigment', 'components')),
  material_delta integer not null default 0,
  source_type text not null,
  source_id text,
  actor_wallet text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index goon_economy_events_token_created_idx on public.goon_economy_events (token_id, created_at desc);

create table public.goon_material_balances (
  token_id integer not null check (token_id between 1 and 1000),
  material_key text not null check (material_key in ('scrap', 'threads', 'grip', 'pigment', 'components')),
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (token_id, material_key)
);

create table public.goon_item_definitions (
  id text primary key,
  name text not null,
  description text not null,
  discipline text check (discipline is null or discipline in ('Skateboarding', 'Snowboarding', 'Surfing', 'BMX', 'Motocross', 'Skiing')),
  slot text not null check (slot in ('performance', 'protective', 'cosmetic', 'celebration')),
  tier text not null check (tier in ('basic', 'advanced', 'seasonal')),
  competitive_modifier integer not null default 0 check (competitive_modifier between 0 and 4),
  max_durability integer not null default 20 check (max_durability > 0),
  recipe jsonb not null,
  requirements jsonb not null default '{}'::jsonb,
  season_id text references public.goon_seasons(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.goon_inventory (
  id uuid primary key default gen_random_uuid(),
  token_id integer not null check (token_id between 1 and 1000),
  item_definition_id text not null references public.goon_item_definitions(id),
  durability integer not null check (durability >= 0),
  crafted_at timestamptz not null default now(),
  reserved_activity_type text,
  reserved_activity_id uuid,
  metadata jsonb not null default '{}'::jsonb
);
create index goon_inventory_token_idx on public.goon_inventory(token_id);
create index goon_inventory_reserved_idx on public.goon_inventory(reserved_activity_id) where reserved_activity_id is not null;

create table public.goon_loadouts (
  token_id integer primary key check (token_id between 1 and 1000),
  performance_item_id uuid references public.goon_inventory(id),
  protective_item_id uuid references public.goon_inventory(id),
  cosmetic_item_id uuid references public.goon_inventory(id),
  celebration_item_id uuid references public.goon_inventory(id),
  updated_at timestamptz not null default now()
);

create table public.goon_assignment_definitions (
  id uuid primary key default gen_random_uuid(),
  utc_date date not null,
  title text not null,
  description text not null,
  objective_type text not null,
  objective jsonb not null,
  reward jsonb not null,
  season_id text references public.goon_seasons(id),
  active boolean not null default true,
  unique (utc_date, title)
);

create table public.goon_assignment_completions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.goon_assignment_definitions(id),
  token_id integer not null check (token_id between 1 and 1000),
  started_by_wallet text not null,
  status text not null check (status in ('active', 'completed', 'claimed', 'expired')),
  progress jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  claimed_at timestamptz,
  unique (assignment_id, started_by_wallet)
);

create table public.goon_expeditions (
  id uuid primary key default gen_random_uuid(),
  token_id integer not null check (token_id between 1 and 1000),
  owner_wallet_at_departure text not null,
  location text not null,
  duration_minutes integer not null check (duration_minutes in (15, 120, 480)),
  risk text not null check (risk in ('safe', 'standard', 'dangerous')),
  stat_emphasis text not null check (stat_emphasis in ('Speed', 'Air', 'Control', 'Style', 'Toughness')),
  equipment_ids uuid[] not null default '{}',
  seed_commitment text not null,
  encrypted_seed text not null,
  result jsonb,
  status text not null check (status in ('active', 'ready', 'claimed', 'recalled')),
  departed_at timestamptz not null default now(),
  resolves_at timestamptz not null,
  claimed_at timestamptz,
  recalled_at timestamptz
);
create unique index one_active_expedition_per_goon on public.goon_expeditions(token_id) where status in ('active', 'ready');

create table public.trick_line_sessions (
  id uuid primary key default gen_random_uuid(),
  token_id integer check (token_id is null or token_id between 1 and 1000),
  wallet_at_start text,
  guest boolean not null default false,
  access_key_hash text,
  discipline text not null check (discipline in ('Skateboarding', 'Snowboarding', 'Surfing', 'BMX', 'Motocross', 'Skiing')),
  seed_commitment text not null,
  server_seed text not null,
  action_sequence integer not null default 0,
  banked_score integer not null default 0 check (banked_score >= 0),
  unbanked_score integer not null default 0 check (unbanked_score >= 0),
  multiplier numeric(7,2) not null default 1 check (multiplier >= 1),
  landed_count integer not null default 0 check (landed_count >= 0),
  status text not null check (status in ('active', 'banked', 'fallen', 'expired')),
  action_deadline timestamptz not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  reward_claimed boolean not null default false
);
create index trick_line_sessions_token_idx on public.trick_line_sessions(token_id, started_at desc);

create table public.trick_line_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trick_line_sessions(id) on delete cascade,
  sequence integer not null,
  trick_id integer not null,
  stance text not null check (stance in ('regular', 'switch')),
  obstacle text not null,
  call_mode text not null check (call_mode in ('standard', 'send')),
  grit_used integer not null default 0 check (grit_used between 0 and 3),
  chance integer not null check (chance between 1 and 99),
  roll integer not null check (roll between 1 and 100),
  landed boolean not null,
  score_delta integer not null,
  transcript jsonb not null,
  created_at timestamptz not null default now(),
  unique (session_id, sequence)
);

create table public.goon_quest_progress (
  token_id integer not null check (token_id between 1 and 1000),
  season_id text not null references public.goon_seasons(id),
  quest_key text not null,
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (token_id, season_id, quest_key)
);

create table public.goon_trophies (
  id uuid primary key default gen_random_uuid(),
  token_id integer not null check (token_id between 1 and 1000),
  trophy_key text not null,
  title text not null,
  season_id text references public.goon_seasons(id),
  metadata jsonb not null default '{}'::jsonb,
  earned_at timestamptz not null default now(),
  unique (token_id, trophy_key)
);

create table public.goon_community_objectives (
  id text primary key,
  season_id text not null references public.goon_seasons(id),
  title text not null,
  discipline text,
  target_amount bigint not null check (target_amount > 0),
  contributed_amount bigint not null default 0 check (contributed_amount >= 0),
  completed_at timestamptz
);

create table public.competitive_loadout_reservations (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid,
  match_id uuid,
  token_id integer not null check (token_id between 1 and 1000),
  wallet_at_reservation text not null,
  item_ids uuid[] not null default '{}',
  grit_committed integer not null default 0 check (grit_committed between 0 and 3),
  equipment_modifier integer not null default 0 check (equipment_modifier between 0 and 4),
  loadout_hash text not null,
  ruleset_hash text not null,
  status text not null check (status in ('reserved', 'locked', 'consumed', 'released')),
  created_at timestamptz not null default now(),
  released_at timestamptz
);
create unique index one_live_competitive_reservation_per_goon on public.competitive_loadout_reservations(token_id) where status in ('reserved', 'locked');

-- Atomic, idempotent economy mutation. Only service_role may execute it.
create or replace function public.apply_goon_economy_event(
  p_token_id integer,
  p_idempotency_key text,
  p_event_type text,
  p_grit_balance_delta integer default 0,
  p_grit_reserved_delta integer default 0,
  p_xp_delta integer default 0,
  p_material_key text default null,
  p_material_delta integer default 0,
  p_source_type text default 'system',
  p_source_id text default null,
  p_actor_wallet text default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.goon_economies
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_economy public.goon_economies;
  existing_event uuid;
  next_balance integer;
  next_reserved integer;
  next_material integer;
begin
  if p_token_id < 1 or p_token_id > 1000 then raise exception 'INVALID_TOKEN_ID'; end if;
  if p_material_key is null and p_material_delta <> 0 then raise exception 'MATERIAL_KEY_REQUIRED'; end if;

  select id into existing_event from public.goon_economy_events where idempotency_key = p_idempotency_key;
  if existing_event is not null then
    select * into current_economy from public.goon_economies where token_id = p_token_id;
    return current_economy;
  end if;

  insert into public.goon_economies(token_id) values (p_token_id) on conflict do nothing;
  select * into current_economy from public.goon_economies where token_id = p_token_id for update;
  next_balance := current_economy.grit_balance + p_grit_balance_delta;
  next_reserved := current_economy.grit_reserved + p_grit_reserved_delta;
  if next_balance < 0 or next_reserved < 0 then raise exception 'INSUFFICIENT_GRIT'; end if;

  if p_material_key is not null then
    insert into public.goon_material_balances(token_id, material_key) values (p_token_id, p_material_key) on conflict do nothing;
    select quantity + p_material_delta into next_material from public.goon_material_balances where token_id = p_token_id and material_key = p_material_key for update;
    if next_material < 0 then raise exception 'INSUFFICIENT_MATERIAL'; end if;
    update public.goon_material_balances set quantity = next_material, updated_at = now() where token_id = p_token_id and material_key = p_material_key;
  end if;

  update public.goon_economies set
    grit_balance = next_balance,
    grit_reserved = next_reserved,
    lifetime_grit_earned = lifetime_grit_earned + greatest(p_grit_balance_delta, 0),
    xp = xp + greatest(p_xp_delta, 0),
    level = greatest(level, 1 + floor(sqrt((xp + greatest(p_xp_delta, 0))::numeric / 100))::integer),
    updated_at = now()
  where token_id = p_token_id returning * into current_economy;

  insert into public.goon_economy_events(
    token_id, idempotency_key, event_type, grit_balance_delta, grit_reserved_delta, xp_delta,
    material_key, material_delta, source_type, source_id, actor_wallet, metadata
  ) values (
    p_token_id, p_idempotency_key, p_event_type, p_grit_balance_delta, p_grit_reserved_delta, p_xp_delta,
    p_material_key, p_material_delta, p_source_type, p_source_id, p_actor_wallet, p_metadata
  );
  return current_economy;
end;
$$;
revoke all on function public.apply_goon_economy_event(integer,text,text,integer,integer,integer,text,integer,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.apply_goon_economy_event(integer,text,text,integer,integer,integer,text,integer,text,text,text,jsonb) to service_role;

-- Season One and thirty launch recipes. No item is granted automatically.
insert into public.goon_seasons(id, title, story, starts_at, status) values
  ('zero-g-blackout-s1', 'Season One — ZERO-G Blackout', 'The district is dark. Salvage the parts, rebuild six generators, and bring the Gooniverse back online.', '2026-08-12T00:00:00Z', 'preview');

insert into public.goon_item_definitions(id,name,description,discipline,slot,tier,competitive_modifier,max_durability,recipe,requirements,season_id) values
  ('skate-bearings-basic','KRAKED Street Bearings','Reliable speed for Skate Trick Lines.','Skateboarding','performance','basic',1,20,'{"scrap":4,"components":2}','{}',null),
  ('skate-trucks-advanced','REDLINE Hollow Trucks','Precision trucks built for difficult lines.','Skateboarding','performance','advanced',3,18,'{"scrap":8,"grip":5,"components":6}','{"blueprint":"redline-trucks"}',null),
  ('snow-wax-basic','RIPTIDE All-Temp Wax','A basic speed edge for snow lines.','Snowboarding','performance','basic',1,20,'{"pigment":2,"components":3}','{}',null),
  ('snow-edge-advanced','AFTERSHOCK Carbon Edge','High-control edge kit for deep lines.','Snowboarding','performance','advanced',3,18,'{"scrap":6,"grip":6,"components":7}','{"blueprint":"carbon-edge"}',null),
  ('surf-fins-basic','UPDRAFT Thruster Fins','Balanced fins for clean direction changes.','Surfing','performance','basic',1,20,'{"scrap":3,"grip":3,"components":2}','{}',null),
  ('surf-tail-advanced','GRAVITY WORKS Vector Tail','Fast-release tail and fin package.','Surfing','performance','advanced',3,18,'{"grip":7,"pigment":4,"components":7}','{"blueprint":"vector-tail"}',null),
  ('bmx-grips-basic','REDLINE Lock Grips','Basic control upgrade for BMX lines.','BMX','performance','basic',1,20,'{"grip":4,"threads":2}','{}',null),
  ('bmx-hub-advanced','KRAKED Freecoaster Hub','Technical hub for advanced combinations.','BMX','performance','advanced',3,18,'{"scrap":7,"grip":4,"components":7}','{"blueprint":"freecoaster"}',null),
  ('moto-pegs-basic','MUDLORD Control Pegs','Durable contact points for moto lines.','Motocross','performance','basic',1,20,'{"scrap":5,"grip":2}','{}',null),
  ('moto-suspension-advanced','AFTERSHOCK Air Shock','A tuned suspension package for hard landings.','Motocross','performance','advanced',3,18,'{"scrap":8,"components":8}','{"blueprint":"air-shock"}',null),
  ('ski-wax-basic','RIPTIDE Cold Wax','Basic glide compound for ski lines.','Skiing','performance','basic',1,20,'{"pigment":2,"components":3}','{}',null),
  ('ski-bindings-advanced','UPDRAFT Vector Bindings','Responsive bindings for aerial control.','Skiing','performance','advanced',3,18,'{"scrap":6,"grip":5,"components":7}','{"blueprint":"vector-bindings"}',null),
  ('helmet-zero-g','ZERO-G Impact Helmet','Protective shell stamped with the ZERO-G bolt.',null,'protective','basic',1,30,'{"scrap":5,"threads":3,"components":3}','{}',null),
  ('helmet-blackout','Blackout Generator Helmet','Season One protective helmet with live power rails.',null,'protective','seasonal',2,30,'{"scrap":8,"pigment":8,"components":10}','{"quest":"generator-one"}','zero-g-blackout-s1'),
  ('hat-nightshift','NIGHTSHIFT Five-Panel','Low-profile sponsor cap.',null,'cosmetic','basic',0,40,'{"threads":4,"pigment":2}','{}',null),
  ('glasses-aftershock','AFTERSHOCK Visor','Reactive visor with an electric edge.',null,'cosmetic','advanced',0,40,'{"scrap":2,"pigment":5,"components":4}','{"achievement":"first-ranked-win"}',null),
  ('background-bar','ZERO-G Bar Backdrop','Profile background from the bar after closing.',null,'cosmetic','basic',0,40,'{"threads":3,"pigment":4}','{}',null),
  ('background-scrapyard','Scrapyard Sundown','Profile background earned from salvage runs.',null,'cosmetic','advanced',0,40,'{"threads":4,"pigment":6,"scrap":3}','{"expeditions":5}',null),
  ('wrap-teal','Ion Teal Equipment Wrap','Teal equipment wrap for every discipline.',null,'cosmetic','basic',0,40,'{"pigment":5,"threads":2}','{}',null),
  ('wrap-coral','Reactor Coral Equipment Wrap','Coral equipment wrap for every discipline.',null,'cosmetic','basic',0,40,'{"pigment":5,"threads":2}','{}',null),
  ('wrap-blackout','Blackout Circuit Wrap','Limited circuit wrap from Season One.',null,'cosmetic','seasonal',0,40,'{"pigment":10,"components":8}','{"quest":"blackout-wrap"}','zero-g-blackout-s1'),
  ('effect-sparks','Landing Sparks','A sharp spark burst on a landed move.',null,'celebration','basic',0,30,'{"scrap":3,"pigment":3,"components":2}','{}',null),
  ('effect-smoke','Impact Smoke','A smoke ring that follows a hard landing.',null,'celebration','advanced',0,30,'{"pigment":7,"components":5}','{"achievement":"line-five"}',null),
  ('effect-blackout','Blackout Overdrive','Season One electric overdrive celebration.',null,'celebration','seasonal',0,30,'{"pigment":9,"components":12}','{"quest":"overdrive"}','zero-g-blackout-s1'),
  ('battery-zero-g','ZERO-G Battery Pack','Workshop battery required for generator objectives.',null,'celebration','seasonal',0,10,'{"scrap":5,"pigment":4,"components":10}','{}','zero-g-blackout-s1'),
  ('pads-street','Street Pad Set','Protective pads for board and bike disciplines.',null,'protective','basic',1,25,'{"threads":4,"grip":3,"scrap":2}','{}',null),
  ('armor-mudlord','MUDLORD Chest Armor','Advanced protection for rough landings.',null,'protective','advanced',2,28,'{"threads":7,"scrap":7,"components":5}','{"achievement":"tough-line"}',null),
  ('goggles-powder','POWDER PANIC Goggles','Protective optics for snow disciplines.',null,'protective','basic',1,25,'{"threads":3,"pigment":3,"components":2}','{}',null),
  ('celebration-confetti','Goonfetti Cannon','A ridiculous victory blast for the Arena.',null,'celebration','advanced',0,30,'{"threads":6,"pigment":8,"components":4}','{"wins":3}',null),
  ('border-founder','Blackout Founder Border','Permanent profile border for Season One founders.',null,'cosmetic','seasonal',0,99,'{"pigment":12,"components":12}','{"quest":"blackout-founder"}','zero-g-blackout-s1');

insert into public.goon_community_objectives(id,season_id,title,discipline,target_amount) values
  ('blackout-skate-generator','zero-g-blackout-s1','Skate Generator','Skateboarding',5000),
  ('blackout-snow-generator','zero-g-blackout-s1','Snow Generator','Snowboarding',5000),
  ('blackout-surf-generator','zero-g-blackout-s1','Surf Generator','Surfing',5000),
  ('blackout-bmx-generator','zero-g-blackout-s1','BMX Generator','BMX',5000),
  ('blackout-moto-generator','zero-g-blackout-s1','Moto Generator','Motocross',5000),
  ('blackout-ski-generator','zero-g-blackout-s1','Ski Generator','Skiing',5000);

-- RLS: direct browser writes are denied. Public reads are limited to career
-- presentation data; private activity state is available only through APIs.
alter table public.goon_seasons enable row level security;
alter table public.goon_economies enable row level security;
alter table public.goon_economy_events enable row level security;
alter table public.goon_material_balances enable row level security;
alter table public.goon_item_definitions enable row level security;
alter table public.goon_inventory enable row level security;
alter table public.goon_loadouts enable row level security;
alter table public.goon_assignment_definitions enable row level security;
alter table public.goon_assignment_completions enable row level security;
alter table public.goon_expeditions enable row level security;
alter table public.trick_line_sessions enable row level security;
alter table public.trick_line_actions enable row level security;
alter table public.goon_quest_progress enable row level security;
alter table public.goon_trophies enable row level security;
alter table public.goon_community_objectives enable row level security;
alter table public.competitive_loadout_reservations enable row level security;

create policy "public reads goon seasons" on public.goon_seasons for select using (true);
create policy "public reads goon career totals" on public.goon_economies for select using (true);
create policy "public reads material totals" on public.goon_material_balances for select using (true);
create policy "public reads item catalog" on public.goon_item_definitions for select using (active);
create policy "public reads goon inventory" on public.goon_inventory for select using (true);
create policy "public reads goon loadouts" on public.goon_loadouts for select using (true);
create policy "public reads current assignments" on public.goon_assignment_definitions for select using (active);
create policy "public reads quest progress" on public.goon_quest_progress for select using (true);
create policy "public reads trophies" on public.goon_trophies for select using (true);
create policy "public reads community objectives" on public.goon_community_objectives for select using (true);

grant select on public.goon_seasons, public.goon_economies, public.goon_material_balances,
  public.goon_item_definitions, public.goon_inventory, public.goon_loadouts,
  public.goon_assignment_definitions, public.goon_quest_progress, public.goon_trophies,
  public.goon_community_objectives to anon, authenticated;
grant all on public.goon_seasons, public.goon_economies, public.goon_economy_events,
  public.goon_material_balances, public.goon_item_definitions, public.goon_inventory,
  public.goon_loadouts, public.goon_assignment_definitions, public.goon_assignment_completions,
  public.goon_expeditions, public.trick_line_sessions, public.trick_line_actions,
  public.goon_quest_progress, public.goon_trophies, public.goon_community_objectives,
  public.competitive_loadout_reservations to service_role;
