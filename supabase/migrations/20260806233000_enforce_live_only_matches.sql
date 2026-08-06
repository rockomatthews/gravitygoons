do $$
begin
  if exists (select 1 from public.game_challenges where match_mode <> 'live_ranked')
    or exists (select 1 from public.pvp_matches where match_mode <> 'live_ranked') then
    raise exception 'Cannot enforce live-only matches while asynchronous records remain';
  end if;
end;
$$;

alter table public.game_challenges
  alter column match_mode set default 'live_ranked';

alter table public.game_challenges
  drop constraint if exists game_challenges_match_mode_check,
  drop constraint if exists live_challenge_has_start,
  add constraint game_challenges_match_mode_check check (match_mode = 'live_ranked'),
  add constraint live_challenge_has_start check (proposed_start_at is not null);

alter table public.pvp_matches
  alter column match_mode set default 'live_ranked';

alter table public.pvp_matches
  drop constraint if exists pvp_matches_match_mode_check,
  add constraint pvp_matches_match_mode_check check (match_mode = 'live_ranked');

comment on column public.game_challenges.match_mode is
  'Gravity Goons ranked play is live-only. Both players must schedule and check in.';

comment on column public.pvp_matches.match_mode is
  'Gravity Goons ranked play is live-only. Historical live records remain immutable.';
