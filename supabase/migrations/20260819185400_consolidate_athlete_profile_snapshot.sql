create or replace function public.get_athlete_profile_snapshot(
  p_token_id integer,
  p_owner_wallet text default null,
  p_contract_address text default null
)
returns jsonb
language sql
stable
security invoker
set statement_timeout = '1500ms'
as $$
  select jsonb_build_object(
    'economy', coalesce(
      (select to_jsonb(e) - 'token_id' - 'updated_at'
       from public.goon_economies e
       where e.token_id = p_token_id),
      jsonb_build_object('grit_balance', 0, 'grit_reserved', 0, 'lifetime_grit_earned', 0, 'xp', 0, 'level', 1)
    ),
    'materials', coalesce(
      (select jsonb_agg(to_jsonb(m) - 'token_id' - 'updated_at' order by m.material_key)
       from public.goon_material_balances m
       where m.token_id = p_token_id), '[]'::jsonb
    ),
    'inventory', coalesce(
      (select jsonb_agg(
         jsonb_build_object(
           'id', i.id,
           'durability', i.durability,
           'crafted_at', i.crafted_at,
           'reserved_activity_type', i.reserved_activity_type,
           'reserved_activity_id', i.reserved_activity_id,
           'item_definition', jsonb_build_object(
             'id', d.id,
             'name', d.name,
             'slot', d.slot,
             'tier', d.tier,
             'competitive_modifier', d.competitive_modifier,
             'max_durability', d.max_durability
           )
         ) order by i.crafted_at desc
       )
       from public.goon_inventory i
       join public.goon_item_definitions d on d.id = i.item_definition_id
       where i.token_id = p_token_id), '[]'::jsonb
    ),
    'loadout', (select to_jsonb(l) from public.goon_loadouts l where l.token_id = p_token_id),
    'trophies', coalesce(
      (select jsonb_agg(to_jsonb(t) - 'id' - 'token_id' order by t.earned_at desc)
       from public.goon_trophies t
       where t.token_id = p_token_id), '[]'::jsonb
    ),
    'activeExpedition', (
      select jsonb_build_object(
        'id', x.id, 'location', x.location, 'risk', x.risk, 'status', x.status,
        'departed_at', x.departed_at, 'resolves_at', x.resolves_at
      )
      from public.goon_expeditions x
      where x.token_id = p_token_id and x.status in ('active', 'ready')
      order by x.departed_at desc
      limit 1
    ),
    'mastery', coalesce(
      (select jsonb_agg(to_jsonb(m) - 'token_id' - 'updated_at' order by m.trick_id)
       from public.goon_trick_mastery m
       where m.token_id = p_token_id), '[]'::jsonb
    ),
    'record', (
      select to_jsonb(r) - 'token_id' - 'discipline'
      from public.discipline_ranks r
      where r.token_id = p_token_id
    ),
    'sponsorProgress', (
      select to_jsonb(s) - 'token_id' - 'catalog_version'
      from public.athlete_sponsor_progress s
      where s.token_id = p_token_id
    ),
    'sponsors', coalesce(
      (select jsonb_agg(
         jsonb_build_object(
           'sponsor_id', s.sponsor_id,
           'milestone_wins', s.milestone_wins,
           'accepted_at_wins', s.accepted_at_wins,
           'accepted_at', s.accepted_at
         ) order by s.accepted_at desc
       )
       from public.athlete_sponsors s
       where s.token_id = p_token_id), '[]'::jsonb
    ),
    'matches', coalesce(
      (select jsonb_agg(to_jsonb(m) order by m.created_at desc)
       from (
         select id, status, first_token_id, second_token_id, winner_token_id,
                loser_token_id, match_word, match_mode, completed_at, created_at, result_hash
         from public.pvp_matches
         where first_token_id = p_token_id or second_token_id = p_token_id
         order by created_at desc
         limit 20
       ) m), '[]'::jsonb
    ),
    'activeLock', (
      select jsonb_build_object('match_id', l.match_id, 'created_at', l.locked_at)
      from public.pvp_token_locks l
      where l.token_id = p_token_id
      limit 1
    ),
    'activeChallenge', (
      select jsonb_build_object(
        'id', c.id, 'status', c.status,
        'challenger_token_id', c.challenger_token_id,
        'challenged_token_id', c.challenged_token_id,
        'proposed_start_at', c.proposed_start_at,
        'expires_at', c.expires_at
      )
      from public.game_challenges c
      where (c.challenger_token_id = p_token_id or c.challenged_token_id = p_token_id)
        and c.status in ('pending', 'accepted')
      order by c.created_at desc
      limit 1
    ),
    'moveMovies', coalesce(
      (select jsonb_object_agg(movie.trick_id::text, jsonb_build_object(
         'videoUrl', movie.video_url,
         'posterUrl', movie.poster_url
       ))
       from (
         select distinct on (p.trick_id)
           p.trick_id, a.video_url, a.poster_url, a.published_at
         from public.move_media_pairs p
         join public.move_media_assets a on a.pair_id = p.id
         where p.chain_id = 8453
           and p_contract_address is not null
           and p.contract_address = lower(p_contract_address)
           and p.token_id = p_token_id
           and a.outcome = 'land'
           and a.status = 'approved'
           and a.owner_decision = 'approved'
           and a.moderation_status = 'passed'
           and a.published_at is not null
         order by p.trick_id, a.published_at desc
       ) movie), '{}'::jsonb
    ),
    'listing', (
      select jsonb_build_object(
        'id', l.id, 'order_hash', l.order_hash, 'token_id', l.token_id,
        'offerer_wallet', l.offerer_wallet, 'currency', l.currency,
        'price_minor', l.price_minor, 'status', l.status, 'expires_at', l.expires_at
      )
      from public.seaport_listings l
      where l.token_id = p_token_id
        and l.status = 'active'
        and l.starts_at <= now()
        and l.expires_at > now()
      order by l.created_at desc
      limit 1
    ),
    'ownerProfile', (
      select jsonb_build_object('username', p.username, 'display_name', p.display_name)
      from public.profile_wallets w
      join public.profiles p on p.id = w.profile_id
      where p_owner_wallet is not null and w.wallet_address = lower(p_owner_wallet)
      limit 1
    )
  );
$$;

revoke execute on function public.get_athlete_profile_snapshot(integer, text, text) from public, anon, authenticated;
grant execute on function public.get_athlete_profile_snapshot(integer, text, text) to service_role;

comment on function public.get_athlete_profile_snapshot(integer, text, text) is
  'Read-only server profile snapshot. Consolidates public NFT career data into one bounded Data API request.';
