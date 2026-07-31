revoke all on function public.broadcast_challenge_change() from public, anon, authenticated;
revoke all on function public.broadcast_match_change() from public, anon, authenticated;
grant execute on function public.broadcast_challenge_change() to service_role;
grant execute on function public.broadcast_match_change() to service_role;

create index if not exists game_challenges_match_idx
  on public.game_challenges (match_id)
  where match_id is not null;

create index if not exists pvp_matches_challenge_idx
  on public.pvp_matches (challenge_id)
  where challenge_id is not null;

create index if not exists pvp_token_locks_match_idx
  on public.pvp_token_locks (match_id);

drop policy if exists "Authenticated wallet can receive its private lobby broadcasts"
  on realtime.messages;

create policy "Authenticated wallet can receive its private lobby broadcasts"
on realtime.messages for select to authenticated
using (
  topic = 'wallet:' || lower(coalesce((select auth.jwt()) ->> 'wallet_address', ''))
  or (
    topic like 'match:%'
    and exists (
      select 1 from public.pvp_matches m
      where m.id::text = substring(topic from 7)
      and lower(coalesce((select auth.jwt()) ->> 'wallet_address', ''))
        in (m.first_wallet_address, m.second_wallet_address)
    )
  )
);
