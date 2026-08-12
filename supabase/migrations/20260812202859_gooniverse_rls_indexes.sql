-- Explicit deny policies document the server-only boundary and keep the
-- database linter from treating these protected tables as accidental gaps.
create policy "server only economy events" on public.goon_economy_events for all using (false) with check (false);
create policy "server only assignment completions" on public.goon_assignment_completions for all using (false) with check (false);
create policy "server only expeditions" on public.goon_expeditions for all using (false) with check (false);
create policy "server only trick line sessions" on public.trick_line_sessions for all using (false) with check (false);
create policy "server only trick line actions" on public.trick_line_actions for all using (false) with check (false);
create policy "server only competitive reservations" on public.competitive_loadout_reservations for all using (false) with check (false);

create index goon_assignment_definitions_season_idx on public.goon_assignment_definitions(season_id);
create index goon_community_objectives_season_idx on public.goon_community_objectives(season_id);
create index goon_inventory_definition_idx on public.goon_inventory(item_definition_id);
create index goon_item_definitions_season_idx on public.goon_item_definitions(season_id);
create index goon_loadouts_performance_idx on public.goon_loadouts(performance_item_id);
create index goon_loadouts_protective_idx on public.goon_loadouts(protective_item_id);
create index goon_loadouts_cosmetic_idx on public.goon_loadouts(cosmetic_item_id);
create index goon_loadouts_celebration_idx on public.goon_loadouts(celebration_item_id);
create index goon_quest_progress_season_idx on public.goon_quest_progress(season_id);
create index goon_trophies_season_idx on public.goon_trophies(season_id);
