-- GRIT commitments, paid Trick Line mastery, canonical trick arsenal, and result receipts.
-- All writes remain service-role only; public clients receive sanitized API payloads.

alter table public.game_challenges
  add column if not exists challenger_grit_commitment smallint not null default 0 check (challenger_grit_commitment between 0 and 10),
  add column if not exists recipient_grit_commitment smallint check (recipient_grit_commitment between 0 and 10),
  add column if not exists challenger_grit_reservation_id uuid references public.competitive_loadout_reservations(id),
  add column if not exists recipient_grit_reservation_id uuid references public.competitive_loadout_reservations(id);

alter table public.competitive_loadout_reservations
  drop constraint if exists competitive_loadout_reservations_grit_committed_check,
  add constraint competitive_loadout_reservations_grit_committed_check check (grit_committed between 0 and 10);

alter table public.pvp_matches
  add column if not exists first_grit_start smallint not null default 0 check (first_grit_start between 0 and 10),
  add column if not exists second_grit_start smallint not null default 0 check (second_grit_start between 0 and 10),
  add column if not exists first_grit_spent smallint not null default 0 check (first_grit_spent between 0 and 10),
  add column if not exists second_grit_spent smallint not null default 0 check (second_grit_spent between 0 and 10),
  add column if not exists rewards_settled_at timestamptz;

create table if not exists public.goon_trick_mastery (
  token_id integer not null check (token_id between 1 and 1000),
  trick_id smallint not null check (trick_id between 4 and 63),
  failed_qualified_runs smallint not null default 0 check (failed_qualified_runs >= 0),
  qualified_runs smallint not null default 0 check (qualified_runs >= 0),
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (token_id, trick_id)
);

alter table public.trick_line_sessions
  add column if not exists target_trick_id smallint,
  add column if not exists entry_cost smallint not null default 0 check (entry_cost in (0,3,5,8)),
  add column if not exists mastery_chance smallint check (mastery_chance between 1 and 100),
  add column if not exists mastery_qualified boolean not null default false,
  add column if not exists mastery_unlocked boolean not null default false;

alter table public.trick_line_actions
  drop constraint if exists trick_line_actions_grit_used_check,
  add constraint trick_line_actions_grit_used_check check (grit_used = 0);

create table if not exists public.match_result_receipts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  token_id integer not null check (token_id between 1 and 1000),
  outcome text not null check (outcome in ('won','lost','voided','disputed','refunded')),
  stage text not null check (stage in ('result','settlement')),
  title text not null,
  message text not null,
  stake_minor bigint,
  total_pool_minor bigint,
  house_fee_minor bigint,
  payout_minor bigint,
  settlement_status text,
  transaction_hash text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (match_id, wallet_address, stage)
);

create index if not exists match_result_receipts_wallet_idx
  on public.match_result_receipts(wallet_address, acknowledged_at, created_at desc);

alter table public.goon_trick_mastery enable row level security;
alter table public.match_result_receipts enable row level security;
revoke all on public.goon_trick_mastery, public.match_result_receipts from anon, authenticated;
grant all on public.goon_trick_mastery, public.match_result_receipts to service_role;

create or replace function public.reserve_match_grit(
  p_token_id integer,
  p_wallet text,
  p_challenge_id uuid,
  p_amount integer,
  p_ruleset_hash text
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare reservation_id uuid; spendable integer;
begin
  if p_amount < 0 or p_amount > 10 then raise exception 'GRIT_COMMITMENT_OUT_OF_RANGE'; end if;
  insert into public.goon_economies(token_id) values (p_token_id) on conflict do nothing;
  select grit_balance - grit_reserved into spendable from public.goon_economies where token_id=p_token_id for update;
  if spendable < p_amount then raise exception 'INSUFFICIENT_SPENDABLE_GRIT'; end if;
  insert into public.competitive_loadout_reservations(challenge_id,token_id,wallet_at_reservation,grit_committed,equipment_modifier,loadout_hash,ruleset_hash,status)
  values(p_challenge_id,p_token_id,lower(p_wallet),p_amount,0,encode(digest(p_challenge_id::text||':'||p_token_id||':'||p_amount,'sha256'),'hex'),p_ruleset_hash,'reserved')
  returning id into reservation_id;
  perform public.apply_goon_economy_event(p_token_id,'challenge:'||p_challenge_id||':'||p_token_id||':reserve','reserve',0,p_amount,0,null,0,'challenge',p_challenge_id::text,lower(p_wallet),jsonb_build_object('commitment',p_amount));
  return reservation_id;
end; $$;
revoke all on function public.reserve_match_grit(integer,text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.reserve_match_grit(integer,text,uuid,integer,text) to service_role;

create or replace function public.release_match_grit(p_challenge_id uuid, p_reason text)
returns void language plpgsql security invoker set search_path=public as $$
declare r record;
begin
  for r in select * from public.competitive_loadout_reservations where challenge_id=p_challenge_id and status in ('reserved','locked') for update
  loop
    perform public.apply_goon_economy_event(r.token_id,'challenge:'||p_challenge_id||':'||r.token_id||':release:'||p_reason,'release',0,-r.grit_committed,0,null,0,'challenge',p_challenge_id::text,r.wallet_at_reservation,jsonb_build_object('reason',p_reason));
    update public.competitive_loadout_reservations set status='released',released_at=now() where id=r.id;
  end loop;
end; $$;
revoke all on function public.release_match_grit(uuid,text) from public,anon,authenticated;
grant execute on function public.release_match_grit(uuid,text) to service_role;

create or replace function public.start_trick_line_mastery(
  p_token_id integer,p_wallet text,p_target_trick_id integer,p_entry_cost integer,p_discipline text,
  p_seed_commitment text,p_server_seed text,p_access_key_hash text,p_action_deadline timestamptz,p_mastery_chance integer
) returns public.trick_line_sessions
language plpgsql security invoker set search_path=public as $$
declare s public.trick_line_sessions;
begin
  if p_entry_cost not in (3,5,8) then raise exception 'INVALID_ENTRY_COST'; end if;
  perform public.apply_goon_economy_event(p_token_id,'trick-line-start:'||p_access_key_hash,'spend',-p_entry_cost,0,0,null,0,'trick_line',null,lower(p_wallet),jsonb_build_object('targetTrickId',p_target_trick_id));
  insert into public.trick_line_sessions(token_id,wallet_at_start,guest,discipline,seed_commitment,server_seed,access_key_hash,action_deadline,status,target_trick_id,entry_cost,mastery_chance)
  values(p_token_id,lower(p_wallet),false,p_discipline,p_seed_commitment,p_server_seed,p_access_key_hash,p_action_deadline,'active',p_target_trick_id,p_entry_cost,p_mastery_chance)
  returning * into s;
  return s;
end; $$;
revoke all on function public.start_trick_line_mastery(integer,text,integer,integer,text,text,text,text,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.start_trick_line_mastery(integer,text,integer,integer,text,text,text,text,timestamptz,integer) to service_role;

create or replace function public.settle_trick_line_mastery(p_session_id uuid,p_qualified boolean,p_unlocked boolean)
returns public.trick_line_sessions language plpgsql security invoker set search_path=public as $$
declare s public.trick_line_sessions;
begin
  select * into s from public.trick_line_sessions where id=p_session_id for update;
  if not found or s.token_id is null or s.target_trick_id is null then raise exception 'MASTERY_SESSION_NOT_FOUND'; end if;
  if s.status <> 'banked' then raise exception 'MASTERY_SESSION_NOT_BANKED'; end if;
  if s.mastery_qualified then return s; end if;
  insert into public.goon_trick_mastery(token_id,trick_id,qualified_runs,failed_qualified_runs,unlocked_at)
  values(s.token_id,s.target_trick_id,case when p_qualified then 1 else 0 end,case when p_qualified and not p_unlocked then 1 else 0 end,case when p_unlocked then now() end)
  on conflict(token_id,trick_id) do update set
    qualified_runs=public.goon_trick_mastery.qualified_runs + case when p_qualified then 1 else 0 end,
    failed_qualified_runs=public.goon_trick_mastery.failed_qualified_runs + case when p_qualified and not p_unlocked then 1 else 0 end,
    unlocked_at=coalesce(public.goon_trick_mastery.unlocked_at,case when p_unlocked then now() end),updated_at=now();
  if p_unlocked then
    insert into public.athlete_sponsor_progress(token_id) values(s.token_id) on conflict do nothing;
    update public.athlete_sponsor_progress set unlocked_trick_bitmap=set_bit(unlocked_trick_bitmap,63-s.target_trick_id,1),updated_at=now() where token_id=s.token_id;
  end if;
  update public.trick_line_sessions set mastery_qualified=p_qualified,mastery_unlocked=p_unlocked where id=p_session_id returning * into s;
  return s;
end; $$;
revoke all on function public.settle_trick_line_mastery(uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.settle_trick_line_mastery(uuid,boolean,boolean) to service_role;

create or replace function public.accept_game_challenge_with_grit(p_challenge_id uuid,p_actor_wallet text,p_recipient_grit integer)
returns uuid language plpgsql security invoker set search_path=public as $$
declare c public.game_challenges%rowtype; reservation_id uuid; new_match_id uuid;
begin
  select * into c from public.game_challenges where id=p_challenge_id for update;
  if not found or c.status <> 'incoming' then raise exception 'CHALLENGE_NOT_PENDING'; end if;
  if c.challenged_wallet <> lower(p_actor_wallet) then raise exception 'ONLY_RECIPIENT_CAN_ACCEPT'; end if;
  reservation_id := public.reserve_match_grit(c.challenged_token_id,p_actor_wallet,c.id,p_recipient_grit,c.ruleset_hash);
  update public.game_challenges set recipient_grit_commitment=p_recipient_grit,recipient_grit_reservation_id=reservation_id where id=c.id;
  new_match_id := public.accept_game_challenge(c.id,p_actor_wallet);
  update public.pvp_matches set
    first_grit_start=c.challenger_grit_commitment,second_grit_start=p_recipient_grit,
    state=jsonb_set(jsonb_set(state,array['grit',c.challenger_token_id::text],to_jsonb(c.challenger_grit_commitment),true),array['grit',c.challenged_token_id::text],to_jsonb(p_recipient_grit),true)
  where id=new_match_id;
  update public.competitive_loadout_reservations set status='locked',match_id=new_match_id where challenge_id=c.id and status='reserved';
  return new_match_id;
end; $$;
revoke all on function public.accept_game_challenge_with_grit(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.accept_game_challenge_with_grit(uuid,text,integer) to service_role;

create or replace function public.release_terminal_challenge_grit()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.status in ('declined','cancelled','expired') and old.status is distinct from new.status then
    perform public.release_match_grit(new.id,new.status);
  end if;
  return new;
end; $$;

drop trigger if exists release_terminal_challenge_grit on public.game_challenges;
create trigger release_terminal_challenge_grit
after update of status on public.game_challenges
for each row execute function public.release_terminal_challenge_grit();

create or replace function public.settle_ranked_match_career(p_match_id uuid,p_paid boolean default false,p_transaction_hash text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare m public.pvp_matches%rowtype; c public.game_challenges%rowtype; eligible boolean; paid_match boolean;
declare day_start timestamptz; pair_count integer; first_count integer; second_count integer;
declare first_remaining integer; second_remaining integer; first_spent integer; second_spent integer;
declare stake bigint; pool bigint; fee bigint; payout bigint; wins integer; reward_inserted integer;
declare winner_wallet text; loser_wallet text; milestone integer; sponsor_index integer;
declare sponsor_ids text[] := array['kraked','riptide','zero-g','redline','mudlord','powder-panic','nightshift','updraft','gravity-works','aftershock'];
begin
  select * into m from public.pvp_matches where id=p_match_id for update;
  if not found or m.status <> 'completed' or m.winner_token_id is null or m.loser_token_id is null then return jsonb_build_object('settled',false); end if;
  select * into c from public.game_challenges where id=m.challenge_id;
  paid_match := coalesce(c.wager_requested,false);
  stake := coalesce(c.stake_minor,0); pool := stake*2; fee := floor(pool*coalesce(c.house_fee_bps,0)/10000.0); payout := pool-fee;
  winner_wallet := case when m.winner_token_id=m.first_token_id then m.first_wallet_address else m.second_wallet_address end;
  loser_wallet := case when m.loser_token_id=m.first_token_id then m.first_wallet_address else m.second_wallet_address end;
  if paid_match and not p_paid then
    insert into public.match_result_receipts(match_id,wallet_address,token_id,outcome,stage,title,message,stake_minor,total_pool_minor,house_fee_minor,payout_minor,settlement_status)
    values
      (m.id,winner_wallet,m.winner_token_id,'won','result','MATCH WON','Congratulations. You won. Projected payout: '||to_char(payout/1000000.0,'FM999999990.00')||' USDC.',stake,pool,fee,payout,'pending'),
      (m.id,loser_wallet,m.loser_token_id,'lost','result','MATCH LOST','You lost '||to_char(stake/1000000.0,'FM999999990.00')||' USDC. Sorry for your loss.',stake,pool,fee,null,'pending')
    on conflict(match_id,wallet_address,stage) do nothing;
    return jsonb_build_object('settled',false,'waiting','escrow');
  end if;
  if paid_match <> p_paid then return jsonb_build_object('settled',false,'waiting',case when paid_match then 'escrow' else 'free' end); end if;
  if m.rewards_settled_at is not null then return jsonb_build_object('settled',true,'duplicate',true); end if;
  day_start := date_trunc('day',m.completed_at at time zone 'utc') at time zone 'utc';
  select count(*) into pair_count from public.pvp_matches x where x.id<>m.id and x.rewards_settled_at is not null and x.completed_at>=day_start
    and least(x.first_token_id,x.second_token_id)=least(m.first_token_id,m.second_token_id)
    and greatest(x.first_token_id,x.second_token_id)=greatest(m.first_token_id,m.second_token_id);
  select count(*) into first_count from public.pvp_matches x where x.id<>m.id and x.rewards_settled_at is not null and x.completed_at>=day_start and m.first_token_id in(x.first_token_id,x.second_token_id);
  select count(*) into second_count from public.pvp_matches x where x.id<>m.id and x.rewards_settled_at is not null and x.completed_at>=day_start and m.second_token_id in(x.first_token_id,x.second_token_id);
  eligible := pair_count=0 and first_count<3 and second_count<3;
  first_remaining := coalesce((m.state->'grit'->>m.first_token_id::text)::integer,0); second_remaining := coalesce((m.state->'grit'->>m.second_token_id::text)::integer,0);
  first_spent := greatest(0,m.first_grit_start-first_remaining); second_spent := greatest(0,m.second_grit_start-second_remaining);
  perform public.apply_goon_economy_event(m.first_token_id,'match:'||m.id||':'||m.first_token_id||':commitment','release',-first_spent,-m.first_grit_start,0,null,0,'match',m.id::text,m.first_wallet_address,jsonb_build_object('started',m.first_grit_start,'spent',first_spent,'remaining',first_remaining));
  perform public.apply_goon_economy_event(m.second_token_id,'match:'||m.id||':'||m.second_token_id||':commitment','release',-second_spent,-m.second_grit_start,0,null,0,'match',m.id::text,m.second_wallet_address,jsonb_build_object('started',m.second_grit_start,'spent',second_spent,'remaining',second_remaining));
  if eligible then
    perform public.apply_goon_economy_event(m.winner_token_id,'match:'||m.id||':'||m.winner_token_id||':reward','earn',5,0,0,null,0,'ranked_match',m.id::text,winner_wallet,jsonb_build_object('outcome','won'));
    perform public.apply_goon_economy_event(m.loser_token_id,'match:'||m.id||':'||m.loser_token_id||':reward','earn',2,0,0,null,0,'ranked_match',m.id::text,loser_wallet,jsonb_build_object('outcome','lost'));
  end if;
  insert into public.athlete_sponsor_progress(token_id) values(m.winner_token_id) on conflict do nothing;
  insert into public.pvp_match_rewards(match_id,winner_token_id,ranked_win_credited,reward_status,evidence_hash,settled_at)
  values(m.id,m.winner_token_id,true,'settled',coalesce(m.result_hash,'0x'||repeat('0',64)),now()) on conflict do nothing;
  get diagnostics reward_inserted=row_count;
  if reward_inserted=1 then
    update public.athlete_sponsor_progress set verified_ranked_wins=verified_ranked_wins+1,updated_at=now() where token_id=m.winner_token_id returning verified_ranked_wins into wins;
    milestone := case when wins in(5,15,30,50,100) then wins end;
    if milestone is not null then
      sponsor_index := array_position(array[5,15,30,50,100],milestone)*2-1;
      insert into public.athlete_sponsor_offers(token_id,milestone_wins,first_sponsor_id,second_sponsor_id,status)
      values(m.winner_token_id,milestone,sponsor_ids[sponsor_index],sponsor_ids[sponsor_index+1],'pending') on conflict do nothing;
    end if;
  end if;
  insert into public.match_result_receipts(match_id,wallet_address,token_id,outcome,stage,title,message,stake_minor,total_pool_minor,house_fee_minor,payout_minor,settlement_status,transaction_hash)
  values
    (m.id,winner_wallet,m.winner_token_id,'won',case when paid_match then 'settlement' else 'result' end,'MATCH WON',case when paid_match then 'PAID — '||to_char(payout/1000000.0,'FM999999990.00')||' USDC was sent to your wallet.' else 'Congratulations. You won this ranked match. '||case when eligible then '+5 GRIT.' else 'Daily career reward limit reached.' end end,nullif(stake,0),nullif(pool,0),nullif(fee,0),case when paid_match then payout end,case when paid_match then 'paid' else 'complete' end,p_transaction_hash),
    (m.id,loser_wallet,m.loser_token_id,'lost',case when paid_match then 'settlement' else 'result' end,'MATCH LOST',case when paid_match then 'You lost '||to_char(stake/1000000.0,'FM999999990.00')||' USDC. Sorry for your loss.' else 'You lost this ranked match. Sorry for your loss. '||case when eligible then '+2 GRIT.' else 'Daily career reward limit reached.' end end,nullif(stake,0),nullif(pool,0),nullif(fee,0),null,case when paid_match then 'paid' else 'complete' end,p_transaction_hash)
  on conflict(match_id,wallet_address,stage) do nothing;
  update public.competitive_loadout_reservations set status='consumed',released_at=now() where challenge_id=m.challenge_id and status='locked';
  update public.pvp_matches set rewards_settled_at=now(),first_grit_spent=first_spent,second_grit_spent=second_spent where id=m.id;
  return jsonb_build_object('settled',true,'eligible',eligible);
end; $$;
revoke all on function public.settle_ranked_match_career(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.settle_ranked_match_career(uuid,boolean,text) to service_role;

create or replace function public.accept_sponsor_offer(p_offer_id uuid,p_token_id integer,p_sponsor_id text,p_wallet text)
returns public.athlete_sponsor_offers language plpgsql security invoker set search_path=public as $$
declare offer public.athlete_sponsor_offers; trick_id integer; already_unlocked boolean;
begin
  select * into offer from public.athlete_sponsor_offers where id=p_offer_id and token_id=p_token_id for update;
  if not found or offer.status<>'pending' then raise exception 'SPONSOR_OFFER_NOT_PENDING'; end if;
  if p_sponsor_id not in(offer.first_sponsor_id,offer.second_sponsor_id) then raise exception 'INVALID_SPONSOR_CHOICE'; end if;
  trick_id := 4 + array_position(array['kraked','riptide','zero-g','redline','mudlord','powder-panic','nightshift','updraft','gravity-works','aftershock'],p_sponsor_id)-1;
  select get_bit(unlocked_trick_bitmap,63-trick_id)=1 into already_unlocked from public.athlete_sponsor_progress where token_id=p_token_id for update;
  insert into public.athlete_sponsors(token_id,sponsor_id,milestone_wins,accepted_at_wins)
  select p_token_id,p_sponsor_id,offer.milestone_wins,verified_ranked_wins from public.athlete_sponsor_progress where token_id=p_token_id;
  update public.athlete_sponsor_progress set active_sponsor_id=p_sponsor_id,unlocked_trick_bitmap=set_bit(unlocked_trick_bitmap,63-trick_id,1),updated_at=now() where token_id=p_token_id;
  if already_unlocked then
    perform public.apply_goon_economy_event(p_token_id,'sponsor-offer:'||offer.id||':replacement','material',0,0,0,'components',5,'sponsor',offer.id::text,lower(p_wallet),jsonb_build_object('reason','duplicate_trick_replacement'));
  end if;
  update public.athlete_sponsor_offers set status='accepted',accepted_sponsor_id=p_sponsor_id,accepted_at=now() where id=offer.id returning * into offer;
  return offer;
end; $$;
revoke all on function public.accept_sponsor_offer(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.accept_sponsor_offer(uuid,integer,text,text) to service_role;

create or replace function public.release_voided_match_grit()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.status in ('voided','cancelled','expired') and old.status is distinct from new.status and new.challenge_id is not null then
    perform public.release_match_grit(new.challenge_id,new.status);
  end if;
  return new;
end; $$;
drop trigger if exists release_voided_match_grit on public.pvp_matches;
create trigger release_voided_match_grit after update of status on public.pvp_matches for each row execute function public.release_voided_match_grit();
