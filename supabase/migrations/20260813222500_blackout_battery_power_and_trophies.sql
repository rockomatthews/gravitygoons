update public.goon_item_definitions set description='A consumable ZERO-G power cell. Contributes exactly 100 power to the owning Goon discipline generator.',max_durability=1,requirements='{"season":"zero-g-blackout-s1","consumable":true,"power":100}'::jsonb where id='battery-zero-g';
create or replace function public.contribute_zero_g_battery(p_token_id integer,p_wallet text,p_inventory_id uuid,p_discipline text)returns jsonb language plpgsql security definer set search_path=public as $$
declare objective public.goon_community_objectives%rowtype;career_power integer;trophy_title text;
begin
if p_token_id not between 1 and 1000 then raise exception 'INVALID_TOKEN_ID';end if;
if p_discipline not in('Skateboarding','Snowboarding','Surfing','BMX','Motocross','Skiing')then raise exception 'INVALID_DISCIPLINE';end if;
perform 1 from public.goon_inventory where id=p_inventory_id and token_id=p_token_id and item_definition_id='battery-zero-g' and reserved_activity_id is null for update;if not found then raise exception 'AVAILABLE_ZERO_G_BATTERY_REQUIRED';end if;
delete from public.goon_inventory where id=p_inventory_id;
update public.goon_community_objectives set contributed_amount=least(target_amount,contributed_amount+100),completed_at=case when contributed_amount+100>=target_amount then coalesce(completed_at,now())else completed_at end where season_id='zero-g-blackout-s1' and discipline=p_discipline returning * into objective;if not found then raise exception 'GENERATOR_NOT_FOUND';end if;
insert into public.goon_quest_progress(token_id,season_id,quest_key,progress,updated_at)values(p_token_id,'zero-g-blackout-s1','generator-power',100,now())on conflict(token_id,season_id,quest_key)do update set progress=public.goon_quest_progress.progress+100,updated_at=now()returning progress into career_power;
trophy_title:=case career_power when 100 then 'Grid Starter' when 500 then 'Power Runner' when 1500 then 'Generator Engineer' when 3000 then 'Blackout Overdriver' else null end;
if trophy_title is not null then insert into public.goon_trophies(token_id,trophy_key,title,season_id,metadata)values(p_token_id,'blackout-power-'||career_power,trophy_title,'zero-g-blackout-s1',jsonb_build_object('power',career_power,'discipline',p_discipline,'wallet',lower(p_wallet)))on conflict(token_id,trophy_key)do nothing;end if;
return jsonb_build_object('tokenId',p_token_id,'discipline',p_discipline,'powerAdded',100,'careerPower',career_power,'generatorPower',objective.contributed_amount,'generatorTarget',objective.target_amount,'trophy',trophy_title);end;$$;
revoke all on function public.contribute_zero_g_battery(integer,text,uuid,text)from public,anon,authenticated;grant execute on function public.contribute_zero_g_battery(integer,text,uuid,text)to service_role;
