create or replace function public.commit_pvp_match_action(
  p_match_id uuid,
  p_wallet_address text,
  p_turn_number integer,
  p_idempotency_key uuid,
  p_action_type text,
  p_request_payload jsonb,
  p_result_payload jsonb,
  p_next_state jsonb,
  p_winner_token_id integer default null,
  p_loser_token_id integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.pvp_matches%rowtype;
  prior_action public.pvp_match_actions%rowtype;
  expected_wallet text;
  setter_token_id integer;
  terminal boolean;
  winner_rating numeric;
  loser_rating numeric;
  winner_streak integer;
  winner_best_streak integer;
  athlete_delta integer;
  winner_wallet text;
  loser_wallet text;
  winner_wallet_rating numeric;
  loser_wallet_rating numeric;
  wallet_delta integer;
begin
  if p_action_type not in ('call_trick', 'answer_trick') then
    raise exception 'Unsupported match action';
  end if;
  if jsonb_typeof(p_request_payload) <> 'object'
    or jsonb_typeof(p_result_payload) <> 'object'
    or jsonb_typeof(p_next_state) <> 'object' then
    raise exception 'Match payloads must be JSON objects';
  end if;

  select * into m from public.pvp_matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;

  select * into prior_action
  from public.pvp_match_actions
  where match_id = p_match_id and idempotency_key = p_idempotency_key;
  if found then
    if prior_action.wallet_address <> lower(p_wallet_address) then
      raise exception 'Idempotency key belongs to a different wallet';
    end if;
    return prior_action.result_payload;
  end if;

  if m.status <> 'matched' then raise exception 'Match is not accepting actions'; end if;
  if m.next_turn_number <> p_turn_number then
    raise exception 'Stale turn. Expected %', m.next_turn_number;
  end if;

  setter_token_id := (m.state ->> 'setterTokenId')::integer;
  if setter_token_id not in (m.first_token_id, m.second_token_id) then
    raise exception 'Invalid setter state';
  end if;
  if p_action_type = 'call_trick' then
    expected_wallet := case when setter_token_id = m.first_token_id
      then m.first_wallet_address else m.second_wallet_address end;
  else
    expected_wallet := case when setter_token_id = m.first_token_id
      then m.second_wallet_address else m.first_wallet_address end;
  end if;
  if lower(p_wallet_address) <> expected_wallet then raise exception 'It is not your turn'; end if;

  terminal := coalesce((p_next_state ->> 'firstLosses')::integer, 0) >= length(m.match_word)
    or coalesce((p_next_state ->> 'secondLosses')::integer, 0) >= length(m.match_word);
  if terminal <> (p_winner_token_id is not null and p_loser_token_id is not null) then
    raise exception 'Terminal result does not match the next state';
  end if;
  if terminal then
    if p_winner_token_id not in (m.first_token_id, m.second_token_id)
      or p_loser_token_id not in (m.first_token_id, m.second_token_id)
      or p_winner_token_id = p_loser_token_id then
      raise exception 'Invalid match winner or loser';
    end if;
    if (coalesce((p_next_state ->> 'firstLosses')::integer, 0) >= length(m.match_word)
        and p_loser_token_id <> m.first_token_id)
      or (coalesce((p_next_state ->> 'secondLosses')::integer, 0) >= length(m.match_word)
        and p_loser_token_id <> m.second_token_id) then
      raise exception 'Winner does not match the terminal score';
    end if;
  end if;

  insert into public.pvp_match_actions(
    match_id, wallet_address, turn_number, idempotency_key,
    action_type, request_payload, result_payload
  ) values (
    p_match_id, lower(p_wallet_address), p_turn_number, p_idempotency_key,
    p_action_type, p_request_payload, p_result_payload
  );

  if not terminal then
    update public.pvp_matches set
      state = p_next_state,
      next_turn_number = p_turn_number + 1,
      action_deadline = now() + interval '24 hours',
      updated_at = now()
    where id = p_match_id;
    return p_result_payload;
  end if;

  update public.pvp_matches set
    state = p_next_state,
    next_turn_number = p_turn_number + 1,
    status = 'completed',
    winner_token_id = p_winner_token_id,
    loser_token_id = p_loser_token_id,
    completed_at = now(),
    action_deadline = null,
    updated_at = now()
  where id = p_match_id;

  insert into public.athlete_battle_records(token_id, discipline)
  values (p_winner_token_id, m.discipline), (p_loser_token_id, m.discipline)
  on conflict (token_id) do nothing;
  select rating, current_streak, best_streak
    into winner_rating, winner_streak, winner_best_streak
    from public.athlete_battle_records where token_id = p_winner_token_id for update;
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
  where token_id = p_winner_token_id;
  update public.athlete_battle_records set
    matches_played = matches_played + 1,
    losses = losses + 1,
    current_streak = least(-1, current_streak - 1),
    rating = greatest(0, rating - athlete_delta),
    updated_at = now()
  where token_id = p_loser_token_id;

  winner_wallet := case when p_winner_token_id = m.first_token_id
    then m.first_wallet_address else m.second_wallet_address end;
  loser_wallet := case when winner_wallet = m.first_wallet_address
    then m.second_wallet_address else m.first_wallet_address end;
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
    select id, lower(p_wallet_address), 'completed',
      jsonb_build_object('matchId', p_match_id, 'winnerTokenId', p_winner_token_id, 'loserTokenId', p_loser_token_id)
    from public.game_challenges where match_id = p_match_id;

  return p_result_payload;
end;
$$;

revoke all on function public.commit_pvp_match_action(uuid,text,integer,uuid,text,jsonb,jsonb,jsonb,integer,integer)
  from public, anon, authenticated;
grant execute on function public.commit_pvp_match_action(uuid,text,integer,uuid,text,jsonb,jsonb,jsonb,integer,integer)
  to service_role;

comment on function public.commit_pvp_match_action(uuid,text,integer,uuid,text,jsonb,jsonb,jsonb,integer,integer)
  is 'Atomically commits one authoritative turn and, when terminal, settles ratings and unlocks both Goons exactly once.';
