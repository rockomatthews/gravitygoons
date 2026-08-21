-- Rejected movie workflows remain immutable payment and generation history.
-- A new workflow may be commissioned for the same Goon and trick after rejection.
do $$
declare
  workflow_constraint_name text;
begin
  select c.conname
  into workflow_constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'move_media_pairs'
    and c.contype = 'u'
    and pg_get_constraintdef(c.oid) = 'UNIQUE (chain_id, contract_address, token_id, catalog_version, trick_id)'
  limit 1;

  if workflow_constraint_name is not null then
    execute format('alter table public.move_media_pairs drop constraint %I', workflow_constraint_name);
  end if;
end $$;

create unique index move_media_pairs_one_current_workflow_idx
  on public.move_media_pairs (chain_id, contract_address, token_id, catalog_version, trick_id)
  where status not in ('rejected', 'refunded');

create index move_media_pairs_move_history_idx
  on public.move_media_pairs (chain_id, contract_address, token_id, catalog_version, trick_id, created_at desc);
