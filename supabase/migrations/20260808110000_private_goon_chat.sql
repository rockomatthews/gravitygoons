create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  first_profile_id uuid not null references public.profiles(id) on delete cascade,
  second_profile_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_threads_distinct_profiles check (first_profile_id <> second_profile_id),
  constraint chat_threads_normalized_pair check (first_profile_id::text < second_profile_id::text),
  constraint chat_threads_unique_pair unique (first_profile_id, second_profile_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'match_request', 'system')),
  body text not null check (char_length(body) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb,
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'reported', 'hidden')),
  created_at timestamptz not null default now()
);

create table public.chat_thread_reads (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, profile_id)
);

create table public.chat_blocks (
  blocker_profile_id uuid not null references public.profiles(id) on delete cascade,
  blocked_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_profile_id, blocked_profile_id),
  constraint chat_blocks_distinct_profiles check (blocker_profile_id <> blocked_profile_id)
);

create table public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (reporter_profile_id, message_id)
);

create index chat_threads_first_recent_idx on public.chat_threads(first_profile_id, last_message_at desc);
create index chat_threads_second_recent_idx on public.chat_threads(second_profile_id, last_message_at desc);
create index chat_messages_thread_recent_idx on public.chat_messages(thread_id, created_at desc);
create index chat_messages_sender_rate_idx on public.chat_messages(sender_profile_id, created_at desc);
create index chat_blocks_blocked_idx on public.chat_blocks(blocked_profile_id, blocker_profile_id);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_thread_reads enable row level security;
alter table public.chat_blocks enable row level security;
alter table public.chat_reports enable row level security;

revoke all on public.chat_threads, public.chat_messages, public.chat_thread_reads, public.chat_blocks, public.chat_reports from public, anon, authenticated;
grant all on public.chat_threads, public.chat_messages, public.chat_thread_reads, public.chat_blocks, public.chat_reports to service_role;

create or replace function public.broadcast_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  participant_profile uuid;
  participant_wallet text;
begin
  update public.chat_threads
    set last_message_at = new.created_at, updated_at = now()
    where id = new.thread_id;

  for participant_profile in
    select first_profile_id from public.chat_threads where id = new.thread_id
    union all
    select second_profile_id from public.chat_threads where id = new.thread_id
  loop
    for participant_wallet in
      select lower(wallet_address) from public.profile_wallets where profile_id = participant_profile
    loop
      perform realtime.send(
        jsonb_build_object('thread_id', new.thread_id, 'message_id', new.id, 'kind', new.kind),
        'chat_message',
        'wallet:' || participant_wallet,
        true
      );
    end loop;
  end loop;
  return new;
end;
$$;

revoke all on function public.broadcast_chat_message() from public, anon, authenticated;
grant execute on function public.broadcast_chat_message() to service_role;

create trigger chat_message_broadcast
after insert on public.chat_messages
for each row execute function public.broadcast_chat_message();

comment on table public.chat_threads is 'Private one-to-one profile conversations. Participants are ordered to enforce one thread per pair.';
comment on table public.chat_messages is 'Immutable private chat messages and structured match requests. Access is guarded by wallet-authenticated server APIs.';
comment on table public.chat_blocks is 'Directional chat safety blocks enforced before thread access and message delivery.';
comment on table public.chat_reports is 'Private message reports for operator review; never exposed to chat participants.';
