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
  if deadline is not null and deadline <= now() then
    raise exception 'The turn clock expired. This turn can no longer be submitted';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_late_pvp_action() from public, anon, authenticated;

drop trigger if exists pvp_match_actions_reject_late on public.pvp_match_actions;
create trigger pvp_match_actions_reject_late
before insert on public.pvp_match_actions
for each row execute function public.reject_late_pvp_action();

comment on function public.reject_late_pvp_action() is
  'Rejects stale or late ranked match actions inside the same database transaction that records the authoritative turn.';
