create table public.academia_lesson_progress (
  wallet_address text not null,
  course_id text not null,
  lesson_id text not null,
  quiz_version text not null default 'v1',
  reward_grit integer not null default 1 check (reward_grit between 0 and 3),
  score integer not null default 0 check (score between 0 and 100),
  attempts integer not null default 0 check (attempts >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  claimed_at timestamptz,
  selected_token_id integer check (selected_token_id is null or selected_token_id between 1 and 1000),
  updated_at timestamptz not null default now(),
  primary key (wallet_address, lesson_id),
  check (wallet_address = lower(wallet_address))
);

create table public.academia_token_rewards (
  token_id integer not null check (token_id between 1 and 1000),
  lesson_id text not null,
  wallet_at_claim text not null,
  grit_awarded integer not null check (grit_awarded between 1 and 3),
  claimed_at timestamptz not null default now(),
  primary key (token_id, lesson_id)
);

alter table public.academia_lesson_progress enable row level security;
alter table public.academia_token_rewards enable row level security;
revoke all on public.academia_lesson_progress, public.academia_token_rewards from public, anon, authenticated;
grant all on public.academia_lesson_progress, public.academia_token_rewards to service_role;

create or replace function public.claim_academia_grit(p_wallet text,p_lesson_id text,p_token_id integer)
returns public.goon_economies language plpgsql security invoker set search_path=public as $$
declare progress public.academia_lesson_progress; economy public.goon_economies;
begin
  select * into progress from public.academia_lesson_progress
    where wallet_address=lower(p_wallet) and lesson_id=p_lesson_id for update;
  if progress.completed_at is null then raise exception 'LESSON_NOT_COMPLETED'; end if;
  if progress.claimed_at is not null then raise exception 'ACADEMIA_REWARD_ALREADY_CLAIMED'; end if;
  insert into public.academia_token_rewards(token_id,lesson_id,wallet_at_claim,grit_awarded)
    values(p_token_id,p_lesson_id,lower(p_wallet),progress.reward_grit);
  select * into economy from public.apply_goon_economy_event(
    p_token_id,'academia:'||p_lesson_id||':'||p_token_id,'reward',progress.reward_grit,0,0,null,0,
    'academia',p_lesson_id,lower(p_wallet),jsonb_build_object('courseId',progress.course_id,'score',progress.score));
  update public.academia_lesson_progress set claimed_at=now(),selected_token_id=p_token_id,updated_at=now()
    where wallet_address=lower(p_wallet) and lesson_id=p_lesson_id;
  return economy;
exception when unique_violation then raise exception 'GOON_ALREADY_EARNED_LESSON_REWARD';
end; $$;

revoke all on function public.claim_academia_grit(text,text,integer) from public,anon,authenticated;
grant execute on function public.claim_academia_grit(text,text,integer) to service_role;

comment on table public.academia_lesson_progress is 'Wallet learning progress. Completed rewards remain pending until assigned to a currently owned Goon.';
comment on table public.academia_token_rewards is 'Anti-farming receipt: each Goon can receive each lesson reward only once.';
