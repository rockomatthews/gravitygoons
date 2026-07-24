-- Ruleset v3 changes PvP from simultaneous judged rounds to turn-based
-- SKATE/HORSE calls. Legacy fields remain nullable so existing transcripts can
-- still be read while new matches use the explicit setter/responder columns.

alter table public.pvp_matches
  alter column ruleset_version set default 3,
  add column current_setter_token_id integer check (current_setter_token_id between 1 and 1000),
  add column previous_called_trick_id smallint check (previous_called_trick_id between 0 and 63),
  add column first_letter_count smallint not null default 0 check (first_letter_count between 0 and 8),
  add column second_letter_count smallint not null default 0 check (second_letter_count between 0 and 8),
  add constraint pvp_matches_current_setter_participant
    check (current_setter_token_id is null or current_setter_token_id in (first_token_id, second_token_id));

alter table public.pvp_rounds
  alter column first_choice_commit drop not null,
  alter column second_choice_commit drop not null,
  add column setter_token_id integer check (setter_token_id between 1 and 1000),
  add column responder_token_id integer check (responder_token_id between 1 and 1000),
  add column called_trick_id smallint check (called_trick_id between 0 and 63),
  add column previous_called_trick_id smallint check (previous_called_trick_id between 0 and 63),
  add column setter_choice_commit text check (setter_choice_commit is null or setter_choice_commit ~ '^0x[0-9a-fA-F]{64}$'),
  add column responder_ready_commit text check (responder_ready_commit is null or responder_ready_commit ~ '^0x[0-9a-fA-F]{64}$'),
  add column setter_landing_chance smallint check (setter_landing_chance between 0 and 100),
  add column responder_landing_chance smallint check (responder_landing_chance between 0 and 100),
  add column setter_landed boolean,
  add column responder_landed boolean,
  add column responder_in_catalogue boolean,
  add column responder_similarity numeric(4, 3) check (responder_similarity between 0 and 1),
  add column responder_prior_attempts smallint check (responder_prior_attempts >= 0),
  add column responder_learning_bonus smallint check (responder_learning_bonus between 0 and 24),
  add column next_setter_token_id integer check (next_setter_token_id between 1 and 1000),
  add column turn_outcome text check (turn_outcome in ('setter_missed', 'responder_landed', 'responder_missed')),
  add column phase text not null default 'calling'
    check (phase in ('legacy', 'calling', 'setter_resolving', 'answering', 'resolved', 'voided', 'disputed')),
  add constraint pvp_rounds_distinct_roles
    check (setter_token_id is null or responder_token_id is null or setter_token_id <> responder_token_id);

update public.pvp_rounds as round
set phase = 'legacy'
from public.pvp_matches as match
where match.id = round.match_id
  and match.ruleset_version < 3;

comment on column public.pvp_matches.current_setter_token_id is
  'Ruleset v3 athlete that owns the next call.';
comment on column public.pvp_matches.previous_called_trick_id is
  'Ruleset v3 consecutive-repeat guard. The same trick may return after another call.';
comment on column public.pvp_rounds.responder_in_catalogue is
  'False means the responder received a temporary attempt, not a permanent unlock.';
comment on column public.pvp_rounds.responder_prior_attempts is
  'Prior forced responses by this athlete to this trick within the match.';
comment on column public.pvp_rounds.responder_learning_bonus is
  'Versioned per-match practice bonus; ruleset v3 uses +6 per prior response capped at +24.';
comment on table public.pvp_rounds is
  'Server-authoritative, replayable PvP turn evidence. Ruleset v3 records setter, responder, one called trick, learning inputs, attempts, letter, and next setter.';
