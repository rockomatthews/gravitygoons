drop trigger if exists chat_message_broadcast on public.chat_messages;
drop function if exists public.broadcast_chat_message();
drop table if exists public.chat_reports;
drop table if exists public.chat_blocks;
drop table if exists public.chat_thread_reads;
drop table if exists public.chat_messages;
drop table if exists public.chat_threads;

create index chat_room_messages_target_idx on public.chat_room_messages(target_profile_id, created_at desc)
  where target_profile_id is not null;
create index chat_room_reports_message_idx on public.chat_room_reports(message_id);
