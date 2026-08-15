-- Three missed setter-selection clocks by the same Goon are an authoritative
-- match forfeit. A first or second miss still passes only the set.

create or replace function public.settle_pvp_timeout_forfeit(
  p_match_id uuid,
  p_loser_token_id integer,
  p_next_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.pvp_matches%rowtype;
  v_winner_token_id integer;
  winner_wallet text;
  loser_wallet text;
  winner_rating numeric;
  loser_rating numeric;
  winner_streak integer;
  winner_best_streak integer;
  athlete_delta integer;
  winner_wallet_rating numeric;
  loser_wallet_rating numeric;
  wallet_delta integer;
begin
  select * into m from public.pvp_matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if m.status <> 'matched' then raise exception 'Match is not accepting a timeout forfeit'; end if;
  if p_loser_token_id not in (m.first_token_id, m.second_token_id) then
    raise exception 'Invalid timeout-forfeit loser';
  end if;

  v_winner_token_id := case when p_loser_token_id = m.first_token_id then m.second_token_id else m.first_token_id end;
  winner_wallet := case when v_winner_token_id = m.first_token_id then m.first_wallet_address else m.second_wallet_address end;
  loser_wallet := case when p_loser_token_id = m.first_token_id then m.first_wallet_address else m.second_wallet_address end;

  update public.pvp_matches set
    state = p_next_state,
    next_turn_number = m.next_turn_number + 1,
    status = 'completed',
    winner_token_id = v_winner_token_id,
    loser_token_id = p_loser_token_id,
    completed_at = now(),
    action_deadline = null,
    updated_at = now()
  where id = p_match_id;

  insert into public.athlete_battle_records(token_id, discipline)
  values (v_winner_token_id, m.discipline), (p_loser_token_id, m.discipline)
  on conflict (token_id) do nothing;
  select rating, current_streak, best_streak
    into winner_rating, winner_streak, winner_best_streak
    from public.athlete_battle_records where token_id = v_winner_token_id for update;
  select rating into loser_rating
    from public.athlete_battle_records where token_id = p_loser_token_id for update;
  athlete_delta := round(24 * (1 - 1 / (1 + power(10, (loser_rating - winner_rating) / 400))))::integer;
  update public.athlete_battle_records set
    matches_played = matches_played + 1,
    wins = wins + 1,
    current_streak = greatest(1, current_streak + 1),
    best_streak = greatest(best_streak, greatest(1, current_streak + 1)),
    rating = rating + athlete_delta,
    updated_at = now()
  where token_id = v_winner_token_id;
  update public.athlete_battle_records set
    matches_played = matches_played + 1,
    losses = losses + 1,
    current_streak = least(-1, current_streak - 1),
    rating = greatest(0, rating - athlete_delta),
    updated_at = now()
  where token_id = p_loser_token_id;

  insert into public.wallet_battle_records(wallet_address)
  values (winner_wallet), (loser_wallet)
  on conflict (wallet_address) do nothing;
  select rating into winner_wallet_rating
    from public.wallet_battle_records where wallet_address = winner_wallet for update;
  select rating into loser_wallet_rating
    from public.wallet_battle_records where wallet_address = loser_wallet for update;
  wallet_delta := round(20 * (1 - 1 / (1 + power(10, (loser_wallet_rating - winner_wallet_rating) / 400))))::integer;
  update public.wallet_battle_records set
    matches_played = matches_played + 1,
    wins = wins + 1,
    rating = rating + wallet_delta,
    updated_at = now()
  where wallet_address = winner_wallet;
  update public.wallet_battle_records set
    matches_played = matches_played + 1,
    losses = losses + 1,
    rating = greatest(0, rating - wallet_delta),
    updated_at = now()
  where wallet_address = loser_wallet;

  delete from public.pvp_token_locks where match_id = p_match_id;
  update public.game_challenges set status = 'completed', updated_at = now()
    where match_id = p_match_id and status = 'active';
  insert into public.challenge_events(challenge_id, actor_wallet, event_type, event_data)
    select id, loser_wallet, 'completed', jsonb_build_object(
      'matchId', p_match_id,
      'winnerTokenId', v_winner_token_id,
      'loserTokenId', p_loser_token_id,
      'reason', 'three_setter_timeouts'
    ) from public.game_challenges where match_id = p_match_id;

  return jsonb_build_object(
    'matchId', p_match_id,
    'winnerTokenId', v_winner_token_id,
    'loserTokenId', p_loser_token_id,
    'reason', 'three_setter_timeouts'
  );
end;
$$;

revoke all on function public.settle_pvp_timeout_forfeit(uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.settle_pvp_timeout_forfeit(uuid,integer,jsonb) to service_role;

create or replace function public.advance_scheduled_matches()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  c record;
  started_count integer := 0;
  voided_count integer := 0;
  passed_timeout_count integer := 0;
  forfeited_timeout_count integer := 0;
  expired_challenge_count integer := 0;
  timed_out_token_id integer;
  next_setter_token_id integer;
  v_winner_token_id integer;
  timed_out_wallet text;
  timeout_strikes integer;
  next_state jsonb;
  result_payload jsonb;
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
    v_winner_token_id := next_setter_token_id;
    timed_out_wallet := case when timed_out_token_id=m.first_token_id then m.first_wallet_address else m.second_wallet_address end;
    timeout_strikes := coalesce((m.state -> 'timeoutStrikes' ->> timed_out_token_id::text)::integer,0) + 1;
    next_state := jsonb_set(
      jsonb_set(coalesce(m.state,'{}'::jsonb) - 'pendingCall','{setterTokenId}',to_jsonb(next_setter_token_id),true),
      '{previousTrick}','null'::jsonb,true
    );
    next_state := jsonb_set(next_state,'{timeoutStrikes}',coalesce(next_state->'timeoutStrikes','{}'::jsonb),true);
    next_state := jsonb_set(next_state,array['timeoutStrikes',timed_out_token_id::text],to_jsonb(timeout_strikes),true);
    if timeout_strikes >= 3 then
      next_state := jsonb_set(next_state,'{forfeitReason}','"three_setter_timeouts"'::jsonb,true);
    end if;
    result_payload := jsonb_build_object(
      'action','setter_timeout',
      'timedOutTokenId',timed_out_token_id,
      'nextSetterTokenId',next_setter_token_id,
      'timeoutStrike',timeout_strikes,
      'maximumTimeoutStrikes',3,
      'matchForfeit',timeout_strikes >= 3,
      'winnerTokenId',case when timeout_strikes >= 3 then v_winner_token_id else null end
    );

    insert into public.pvp_match_actions(
      match_id,wallet_address,turn_number,idempotency_key,action_type,request_payload,result_payload
    ) values (
      m.id,timed_out_wallet,m.next_turn_number,gen_random_uuid(),'timeout',
      jsonb_build_object('reason','setter_timeout'),result_payload
    );

    if timeout_strikes >= 3 then
      perform public.settle_pvp_timeout_forfeit(m.id,timed_out_token_id,next_state);
      perform public.next_arena_event(m.id,'completed',jsonb_build_object(
        'winnerTokenId',v_winner_token_id,
        'loserTokenId',timed_out_token_id,
        'reason','three_setter_timeouts'
      ));
      forfeited_timeout_count := forfeited_timeout_count + 1;
    else
      update public.pvp_matches set
        state=next_state,
        next_turn_number=m.next_turn_number+1,
        action_deadline=now()+interval '1 minute',
        updated_at=now()
      where id=m.id;
      perform public.next_arena_event(m.id,'setter_timeout',result_payload);
      passed_timeout_count := passed_timeout_count + 1;
    end if;
  end loop;

  update public.match_reschedule_requests set status='expired' where status='proposed' and expires_at<=now();
  return jsonb_build_object(
    'started',started_count,
    'voided',voided_count,
    'passedTimeouts',passed_timeout_count,
    'timeoutForfeits',forfeited_timeout_count,
    'expiredChallenges',expired_challenge_count
  );
end;
$$;

revoke all on function public.advance_scheduled_matches() from public, anon, authenticated;
grant execute on function public.advance_scheduled_matches() to service_role;

comment on function public.advance_scheduled_matches() is
  'Starts scheduled matches, passes the first two setter timeouts, and settles a third timeout by the same Goon as an authoritative forfeit.';
