-- Close reservation/spend races and make all mastery settlements idempotent,
-- including qualified=false results. Service-role APIs remain the only callers.

alter table public.goon_economies
  drop constraint if exists goon_economies_reserved_not_above_balance,
  add constraint goon_economies_reserved_not_above_balance
    check (grit_reserved <= grit_balance);

alter table public.trick_line_sessions
  add column if not exists mastery_settled_at timestamptz;

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
  if next_balance < 0 or next_reserved < 0 or next_reserved > next_balance then
    raise exception 'INSUFFICIENT_SPENDABLE_GRIT';
  end if;

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

create or replace function public.start_trick_line_mastery(
  p_token_id integer,p_wallet text,p_target_trick_id integer,p_entry_cost integer,p_discipline text,
  p_seed_commitment text,p_server_seed text,p_access_key_hash text,p_action_deadline timestamptz,p_mastery_chance integer
) returns public.trick_line_sessions
language plpgsql security invoker set search_path=public as $$
declare s public.trick_line_sessions; spendable integer;
begin
  if p_entry_cost not in (3,5,8) then raise exception 'INVALID_ENTRY_COST'; end if;
  insert into public.goon_economies(token_id) values (p_token_id) on conflict do nothing;
  select grit_balance - grit_reserved into spendable from public.goon_economies where token_id=p_token_id for update;
  if spendable < p_entry_cost then raise exception 'INSUFFICIENT_SPENDABLE_GRIT'; end if;
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
  if s.mastery_settled_at is not null then return s; end if;
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
  update public.trick_line_sessions set mastery_qualified=p_qualified,mastery_unlocked=p_unlocked,mastery_settled_at=now() where id=p_session_id returning * into s;
  return s;
end; $$;
revoke all on function public.settle_trick_line_mastery(uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.settle_trick_line_mastery(uuid,boolean,boolean) to service_role;
