create index match_wager_references_escrow_version_idx
  on public.match_wager_references(escrow_version)
  where escrow_version is not null;

comment on index public.match_wager_references_escrow_version_idx is
  'Supports draining and auditing every wager assigned to an escrow deployment.';
