create table public.goon_activity_commands (
  id uuid primary key default gen_random_uuid(),
  token_id integer not null check (token_id between 1 and 1000),
  idempotency_key text not null unique,
  command_type text not null,
  result jsonb not null,
  actor_wallet text,
  created_at timestamptz not null default now()
);
alter table public.goon_activity_commands enable row level security;
create policy "server only activity commands" on public.goon_activity_commands for all using (false) with check (false);
grant all on public.goon_activity_commands to service_role;

create or replace function public.craft_goon_item(
  p_token_id integer,
  p_item_definition_id text,
  p_idempotency_key text,
  p_actor_wallet text
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  existing_result jsonb;
  definition public.goon_item_definitions;
  material record;
  available integer;
  new_item public.goon_inventory;
  output jsonb;
begin
  select result into existing_result from public.goon_activity_commands where idempotency_key = p_idempotency_key;
  if existing_result is not null then return existing_result; end if;
  select * into definition from public.goon_item_definitions where id = p_item_definition_id and active for update;
  if definition.id is null then raise exception 'UNKNOWN_RECIPE'; end if;
  for material in select key, value::text::integer as amount from jsonb_each(definition.recipe)
  loop
    insert into public.goon_material_balances(token_id, material_key) values (p_token_id, material.key) on conflict do nothing;
    select quantity into available from public.goon_material_balances where token_id = p_token_id and material_key = material.key for update;
    if available < material.amount then raise exception 'INSUFFICIENT_MATERIAL:%', material.key; end if;
  end loop;
  for material in select key, value::text::integer as amount from jsonb_each(definition.recipe)
  loop
    update public.goon_material_balances set quantity = quantity - material.amount, updated_at = now() where token_id = p_token_id and material_key = material.key;
    insert into public.goon_economy_events(token_id,idempotency_key,event_type,material_key,material_delta,source_type,source_id,actor_wallet)
      values(p_token_id,p_idempotency_key || ':' || material.key,'craft',material.key,-material.amount,'workshop',definition.id,p_actor_wallet);
  end loop;
  insert into public.goon_inventory(token_id,item_definition_id,durability) values(p_token_id,definition.id,definition.max_durability) returning * into new_item;
  output := jsonb_build_object('inventoryId',new_item.id,'itemDefinitionId',definition.id,'durability',new_item.durability);
  insert into public.goon_activity_commands(token_id,idempotency_key,command_type,result,actor_wallet) values(p_token_id,p_idempotency_key,'craft',output,p_actor_wallet);
  return output;
end;
$$;
revoke all on function public.craft_goon_item(integer,text,text,text) from public, anon, authenticated;
grant execute on function public.craft_goon_item(integer,text,text,text) to service_role;

create or replace function public.repair_goon_item(
  p_token_id integer,
  p_inventory_id uuid,
  p_idempotency_key text,
  p_actor_wallet text
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  existing_result jsonb;
  owned_item public.goon_inventory;
  definition public.goon_item_definitions;
  repair_cost integer;
  repaired_item public.goon_inventory;
  output jsonb;
begin
  select result into existing_result from public.goon_activity_commands where idempotency_key = p_idempotency_key;
  if existing_result is not null then return existing_result; end if;
  select * into owned_item from public.goon_inventory where id=p_inventory_id and token_id=p_token_id for update;
  if owned_item.id is null then raise exception 'ITEM_NOT_OWNED_BY_GOON'; end if;
  if owned_item.reserved_activity_id is not null then raise exception 'ITEM_RESERVED'; end if;
  select * into definition from public.goon_item_definitions where id=owned_item.item_definition_id;
  repair_cost := greatest(0, ceil((definition.max_durability-owned_item.durability)::numeric/5)::integer);
  if repair_cost > 0 then
    insert into public.goon_material_balances(token_id,material_key) values(p_token_id,'scrap') on conflict do nothing;
    update public.goon_material_balances set quantity=quantity-repair_cost,updated_at=now() where token_id=p_token_id and material_key='scrap' and quantity>=repair_cost;
    if not found then raise exception 'INSUFFICIENT_MATERIAL:scrap'; end if;
    insert into public.goon_economy_events(token_id,idempotency_key,event_type,material_key,material_delta,source_type,source_id,actor_wallet)
      values(p_token_id,p_idempotency_key,'repair','scrap',-repair_cost,'workshop',p_inventory_id::text,p_actor_wallet);
  end if;
  update public.goon_inventory set durability=definition.max_durability where id=p_inventory_id returning * into repaired_item;
  output := to_jsonb(repaired_item);
  insert into public.goon_activity_commands(token_id,idempotency_key,command_type,result,actor_wallet) values(p_token_id,p_idempotency_key,'repair',output,p_actor_wallet);
  return output;
end;
$$;
revoke all on function public.repair_goon_item(integer,uuid,text,text) from public, anon, authenticated;
grant execute on function public.repair_goon_item(integer,uuid,text,text) to service_role;

create or replace function public.set_goon_loadout_item(
  p_token_id integer,
  p_inventory_id uuid,
  p_slot text,
  p_idempotency_key text,
  p_actor_wallet text
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  existing_result jsonb;
  owned_item public.goon_inventory;
  definition public.goon_item_definitions;
  current_loadout public.goon_loadouts;
  output jsonb;
begin
  select result into existing_result from public.goon_activity_commands where idempotency_key=p_idempotency_key;
  if existing_result is not null then return existing_result; end if;
  if p_slot not in ('performance','protective','cosmetic','celebration') then raise exception 'INVALID_SLOT'; end if;
  if p_inventory_id is not null then
    select * into owned_item from public.goon_inventory where id=p_inventory_id and token_id=p_token_id for update;
    if owned_item.id is null or owned_item.reserved_activity_id is not null then raise exception 'ITEM_NOT_ELIGIBLE_FOR_SLOT'; end if;
    select * into definition from public.goon_item_definitions where id=owned_item.item_definition_id;
    if definition.slot <> p_slot then raise exception 'ITEM_NOT_ELIGIBLE_FOR_SLOT'; end if;
  end if;
  insert into public.goon_loadouts(token_id) values(p_token_id) on conflict do nothing;
  if p_slot='performance' then update public.goon_loadouts set performance_item_id=p_inventory_id,updated_at=now() where token_id=p_token_id returning * into current_loadout;
  elsif p_slot='protective' then update public.goon_loadouts set protective_item_id=p_inventory_id,updated_at=now() where token_id=p_token_id returning * into current_loadout;
  elsif p_slot='cosmetic' then update public.goon_loadouts set cosmetic_item_id=p_inventory_id,updated_at=now() where token_id=p_token_id returning * into current_loadout;
  else update public.goon_loadouts set celebration_item_id=p_inventory_id,updated_at=now() where token_id=p_token_id returning * into current_loadout;
  end if;
  output:=to_jsonb(current_loadout);
  insert into public.goon_activity_commands(token_id,idempotency_key,command_type,result,actor_wallet) values(p_token_id,p_idempotency_key,case when p_inventory_id is null then 'unequip' else 'equip' end,output,p_actor_wallet);
  return output;
end;
$$;
revoke all on function public.set_goon_loadout_item(integer,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.set_goon_loadout_item(integer,uuid,text,text,text) to service_role;
