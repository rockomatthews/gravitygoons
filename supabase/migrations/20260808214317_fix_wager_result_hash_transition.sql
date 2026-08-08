create or replace function public.finalize_authoritative_wager_state()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  computed_hash text;
begin
  if new.status = 'completed' and new.winner_token_id is not null then
    if new.result_hash is null then
      computed_hash := public.authoritative_match_result_hash(new.id);
      update public.pvp_matches set result_hash = computed_hash where id = new.id;
    end if;
    update public.match_wager_references
      set state = case when state = 'locked' then 'settlement_pending' else state end,
          updated_at = now()
      where match_id = new.id;
  elsif new.status = 'voided' and old.status is distinct from new.status then
    update public.match_wager_references
      set state = case when state in ('created','partially_funded','locked') then 'refund_pending' else state end,
          updated_at = now()
      where match_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.finalize_authoritative_wager_state() from public, anon, authenticated;
grant execute on function public.finalize_authoritative_wager_state() to service_role;
