-- A live setter who misses the 60-second selection window forfeits only that
-- call. Record the timeout, pass the set, and start a fresh clock for the
-- opponent. Player no-shows before a match starts remain voidable.

create or replace function public.reject_late_pvp_action()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  match_status text;
  expected_turn integer;
  deadline timestamptz;
begin
  select status, next_turn_number, action_deadline
    into match_status, expected_turn, deadline
    from public.pvp_matches
    where id = new.match_id;

  if not found then raise exception 'Match not found'; end if;
  if match_status <> 'matched' then raise exception 'Match is not accepting actions'; end if;
  if new.turn_number <> expected_turn then raise exception 'Stale turn. Expected %', expected_turn; end if;
  if new.action_type <> 'timeout' and deadline is not null and deadline <= now() then
    raise exception 'The turn clock expired. This turn can no longer be submitted';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_late_pvp_action() from public, anon, authenticated;

create or replace function public.advance_scheduled_matches()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m record;
  c record;
  started_count integer := 0;
  voided_count integer := 0;
  passed_timeout_count integer := 0;
  expired_challenge_count integer := 0;
  timed_out_token_id integer;
  next_setter_token_id integer;
  timed_out_wallet text;
  next_state jsonb;
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
    timed_out_token_id := (m.state ->> 'setterTokenId')::integer;
    if timed_out_token_id not in (m.first_token_id,m.second_token_id) then
      raise exception 'Invalid setter state for match %',m.id;
    end if;
    next_setter_token_id := case when timed_out_token_id=m.first_token_id then m.second_token_id else m.first_token_id end;
    timed_out_wallet := case when timed_out_token_id=m.first_token_id then m.first_wallet_address else m.second_wallet_address end;
    next_state := jsonb_set(
      jsonb_set(coalesce(m.state,'{}'::jsonb) - 'pendingCall','{setterTokenId}',to_jsonb(next_setter_token_id),true),
      '{previousTrick}','null'::jsonb,true
    );

    insert into public.pvp_match_actions(
      match_id,wallet_address,turn_number,idempotency_key,action_type,request_payload,result_payload
    ) values (
      m.id,timed_out_wallet,m.next_turn_number,gen_random_uuid(),'timeout',
      jsonb_build_object('reason','setter_timeout'),
      jsonb_build_object('action','setter_timeout','timedOutTokenId',timed_out_token_id,'nextSetterTokenId',next_setter_token_id)
    );

    update public.pvp_matches set
      state=next_state,
      next_turn_number=m.next_turn_number+1,
      action_deadline=now()+interval '1 minute',
      updated_at=now()
    where id=m.id;
    perform public.next_arena_event(m.id,'setter_timeout',jsonb_build_object('timedOutTokenId',timed_out_token_id,'nextSetterTokenId',next_setter_token_id));
    passed_timeout_count := passed_timeout_count + 1;
  end loop;

  update public.match_reschedule_requests set status='expired' where status='proposed' and expires_at<=now();
  return jsonb_build_object(
    'started',started_count,
    'voided',voided_count,
    'passedTimeouts',passed_timeout_count,
    'expiredChallenges',expired_challenge_count
  );
end;
$$;

revoke all on function public.advance_scheduled_matches() from public, anon, authenticated;
grant execute on function public.advance_scheduled_matches() to service_role;

comment on function public.advance_scheduled_matches() is
  'Starts scheduled matches, voids pre-match no-shows, and passes a timed-out setter call to the opponent without ending the live match.';
