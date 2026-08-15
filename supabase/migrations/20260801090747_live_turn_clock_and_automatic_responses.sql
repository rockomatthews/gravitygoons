-- Live setters get one minute to choose a call. Required responder attempts are
-- resolved by the application in the same authoritative action, so they do not
-- receive a separate action deadline.
create or replace function public.check_in_scheduled_match(p_match_id uuid, p_actor_wallet text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.pvp_matches%rowtype;
begin
  select * into m from public.pvp_matches where id=p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if m.match_mode <> 'live_ranked' or m.status <> 'queued' then raise exception 'Match is not awaiting check-in'; end if;
  if now() < m.check_in_opens_at then raise exception 'Check-in is not open'; end if;
  if now() > m.scheduled_start_at + interval '5 minutes' then raise exception 'Check-in has closed'; end if;
  if lower(p_actor_wallet) = m.first_wallet_address then
    update public.pvp_matches set first_checked_in_at=coalesce(first_checked_in_at,now()),updated_at=now() where id=p_match_id;
  elsif lower(p_actor_wallet) = m.second_wallet_address then
    update public.pvp_matches set second_checked_in_at=coalesce(second_checked_in_at,now()),updated_at=now() where id=p_match_id;
  else raise exception 'Only match players can check in'; end if;
  select * into m from public.pvp_matches where id=p_match_id;
  perform public.next_arena_event(p_match_id,'player_checked_in',jsonb_build_object('bothReady',m.first_checked_in_at is not null and m.second_checked_in_at is not null));
  if m.first_checked_in_at is not null and m.second_checked_in_at is not null and now() >= m.scheduled_start_at then
    update public.pvp_matches set status='matched',started_at=now(),action_deadline=now()+interval '1 minute',updated_at=now() where id=p_match_id;
    perform public.next_arena_event(p_match_id,'started','{}'::jsonb);
  elsif m.first_checked_in_at is not null and m.second_checked_in_at is not null then
    perform public.next_arena_event(p_match_id,'ready','{}'::jsonb);
  end if;
  return jsonb_build_object('matchId',p_match_id,'firstCheckedIn',m.first_checked_in_at is not null,'secondCheckedIn',m.second_checked_in_at is not null);
end;
$$;
revoke all on function public.check_in_scheduled_match(uuid,text) from public, anon, authenticated;
grant execute on function public.check_in_scheduled_match(uuid,text) to service_role;

create or replace function public.advance_scheduled_matches()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m record; c record; started_count integer := 0; voided_count integer := 0; expired_challenge_count integer := 0;
begin
  for c in select id from public.game_challenges where status='incoming' and expires_at<=now() for update skip locked loop
    update public.game_challenges set status='expired',updated_at=now() where id=c.id;
    insert into public.challenge_events(challenge_id,event_type) values(c.id,'expired');
    expired_challenge_count := expired_challenge_count + 1;
  end loop;
  for m in select * from public.pvp_matches where match_mode='live_ranked' and status='queued' for update skip locked loop
    if m.first_checked_in_at is not null and m.second_checked_in_at is not null and now() >= m.scheduled_start_at then
      update public.pvp_matches set status='matched',started_at=now(),action_deadline=now()+interval '1 minute',updated_at=now() where id=m.id;
      perform public.next_arena_event(m.id,'started','{}'::jsonb);
      started_count := started_count + 1;
    elsif now() > m.scheduled_start_at + interval '5 minutes' then
      update public.pvp_matches set status='voided',completed_at=now(),state=jsonb_set(coalesce(state,'{}'::jsonb),'{voidReason}','"no_show"'::jsonb),updated_at=now() where id=m.id;
      delete from public.pvp_token_locks where match_id=m.id;
      update public.game_challenges set status='completed',updated_at=now() where match_id=m.id;
      voided_count := voided_count + 1;
    elsif now() >= m.check_in_opens_at and m.public_sequence=1 then
      perform public.next_arena_event(m.id,'check_in_open','{}'::jsonb);
    end if;
  end loop;
  for m in select * from public.pvp_matches where status='matched' and action_deadline is not null and action_deadline<now() for update skip locked loop
    update public.pvp_matches set status='voided',completed_at=now(),state=jsonb_set(coalesce(state,'{}'::jsonb),'{voidReason}','"action_timeout"'::jsonb),updated_at=now() where id=m.id;
    delete from public.pvp_token_locks where match_id=m.id;
    update public.game_challenges set status='completed',updated_at=now() where match_id=m.id;
    voided_count := voided_count + 1;
  end loop;
  update public.match_reschedule_requests set status='expired' where status='proposed' and expires_at<=now();
  return jsonb_build_object('started',started_count,'voided',voided_count,'expiredChallenges',expired_challenge_count);
end;
$$;
revoke all on function public.advance_scheduled_matches() from public, anon, authenticated;
grant execute on function public.advance_scheduled_matches() to service_role;

create or replace function public.live_match_deadline()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.match_mode='live_ranked' and new.status='matched' and new.action_deadline is not null and new.next_turn_number>old.next_turn_number then
    new.action_deadline := now() + interval '1 minute';
    new.first_action_at := coalesce(old.first_action_at,now());
    new.betting_closes_at := least(coalesce(new.betting_closes_at,now()),now());
  end if;
  return new;
end;
$$;
revoke all on function public.live_match_deadline() from public, anon, authenticated;
