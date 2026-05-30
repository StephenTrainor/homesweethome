-- ---------------------------------------------------------------------
-- chats: A conversation between two users
-- ---------------------------------------------------------------------
create table if not exists public.chats (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists chats_updated_at_idx on public.chats (updated_at desc);

-- Keep updated_at fresh on chats.
drop trigger if exists chats_touch_updated_at on public.chats;
create trigger chats_touch_updated_at
  before update on public.chats
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- chat_participants: Junction table (chat 1 - 2 users)
-- Stores per-user state like last_read_at for unread counts
-- ---------------------------------------------------------------------
create table if not exists public.chat_participants (
  chat_id       uuid not null references public.chats(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create index if not exists chat_participants_user_idx on public.chat_participants (user_id);
create index if not exists chat_participants_chat_idx on public.chat_participants (chat_id);

-- ---------------------------------------------------------------------
-- messages: Individual messages within a chat
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references public.chats(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null check (length(content) > 0 and length(content) <= 5000),
  created_at  timestamptz not null default now()
);

create index if not exists messages_chat_idx on public.messages (chat_id, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender_id);

-- ---------------------------------------------------------------------
-- Function to update chat's updated_at when a new message is sent
-- ---------------------------------------------------------------------
create or replace function public.update_chat_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chats set updated_at = now() where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists message_update_chat on public.messages;
create trigger message_update_chat
  after insert on public.messages
  for each row execute function public.update_chat_on_message();

-- ---------------------------------------------------------------------
-- Function to find or create a chat between two users
-- ---------------------------------------------------------------------
create or replace function public.find_or_create_chat(user1_id uuid, user2_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_chat_id uuid;
  new_chat_id uuid;
begin
  -- Find existing chat where both users are participants
  select cp1.chat_id into existing_chat_id
  from public.chat_participants cp1
  join public.chat_participants cp2 on cp1.chat_id = cp2.chat_id
  where cp1.user_id = user1_id and cp2.user_id = user2_id
  limit 1;

  if existing_chat_id is not null then
    return existing_chat_id;
  end if;

  -- Create new chat
  insert into public.chats default values returning id into new_chat_id;

  -- Add both participants
  insert into public.chat_participants (chat_id, user_id) values
    (new_chat_id, user1_id),
    (new_chat_id, user2_id);

  return new_chat_id;
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.find_or_create_chat(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Helper function to check chat membership (SECURITY DEFINER to bypass RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_chat_participant(p_chat_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.chat_participants
    where chat_id = p_chat_id and user_id = p_user_id
  );
$$;

-- Grant execute to authenticated users
grant execute on function public.is_chat_participant(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.chats             enable row level security;
alter table public.chat_participants enable row level security;
alter table public.messages          enable row level security;

-- chats: Users can only see chats they're participants in
drop policy if exists "chats read own" on public.chats;
create policy "chats read own" on public.chats
  for select using (public.is_chat_participant(id, auth.uid()));

drop policy if exists "chats insert" on public.chats;
create policy "chats insert" on public.chats
  for insert with check (true);

-- chat_participants: Users can see their own rows + other participants in their chats
drop policy if exists "chat_participants read" on public.chat_participants;
create policy "chat_participants read" on public.chat_participants
  for select using (
    user_id = auth.uid() or public.is_chat_participant(chat_id, auth.uid())
  );

drop policy if exists "chat_participants insert" on public.chat_participants;
create policy "chat_participants insert" on public.chat_participants
  for insert with check (true);

drop policy if exists "chat_participants update own" on public.chat_participants;
create policy "chat_participants update own" on public.chat_participants
  for update using (user_id = auth.uid());

-- messages: Users can read/insert messages in their chats
drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages
  for select using (public.is_chat_participant(chat_id, auth.uid()));

drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages
  for insert with check (
    sender_id = auth.uid() and public.is_chat_participant(chat_id, auth.uid())
  );

-- ---------------------------------------------------------------------
-- Enable Supabase Realtime for messages table
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
