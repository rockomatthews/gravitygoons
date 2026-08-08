create table public.chat_room_messages (
  id uuid primary key default gen_random_uuid(),
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'match_request', 'system')),
  body text not null check (char_length(body) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb,
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'reported', 'hidden')),
  created_at timestamptz not null default now()
);

create table public.chat_room_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.chat_room_messages(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (reporter_profile_id, message_id)
);

create index chat_room_messages_recent_idx on public.chat_room_messages(created_at desc);
create index chat_room_messages_sender_rate_idx on public.chat_room_messages(sender_profile_id, created_at desc);

alter table public.chat_room_messages enable row level security;
alter table public.chat_room_reports enable row level security;
revoke all on public.chat_room_messages, public.chat_room_reports from public, anon, authenticated;
grant all on public.chat_room_messages, public.chat_room_reports to service_role;

create or replace function public.broadcast_chat_room_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('message_id', new.id, 'kind', new.kind),
    'chat_room_message',
    'chat:room',
    false
  );
  return new;
end;
$$;

revoke all on function public.broadcast_chat_room_message() from public, anon, authenticated;
grant execute on function public.broadcast_chat_room_message() to service_role;
create trigger chat_room_message_broadcast after insert on public.chat_room_messages
for each row execute function public.broadcast_chat_room_message();

comment on table public.chat_room_messages is 'Shared public Goon chat room. Public reads are sanitized by the site API; posting requires a wallet-authenticated profile.';
comment on table public.chat_room_reports is 'Private moderation reports for shared-room messages.';
