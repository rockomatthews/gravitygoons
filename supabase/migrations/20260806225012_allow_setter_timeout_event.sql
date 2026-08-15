alter table public.arena_match_events
  drop constraint arena_match_events_event_type_check;

alter table public.arena_match_events
  add constraint arena_match_events_event_type_check check (event_type in (
    'scheduled','check_in_open','player_checked_in','ready','started',
    'turn_resolved','setter_timeout','completed','cancelled','expired',
    'voided','disputed','rescheduled','market_suspended'
  ));
