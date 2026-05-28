create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  partner_1_id uuid references auth.users(id) on delete set null,
  partner_2_id uuid references auth.users(id) on delete set null,
  anniversary_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  display_name text,
  role text,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_invites (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  code text not null unique,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  content text,
  memory_type text not null default 'memory',
  image_url text,
  vector_embedding vector(1536),
  location text,
  place_name text,
  latitude double precision,
  longitude double precision,
  location_note text,
  sentiment text,
  timestamp timestamptz not null default now(),
  search_tsv tsvector generated always as (
    to_tsvector('simple', coalesce(content, '') || ' ' || coalesce(location, '') || ' ' || coalesce(sentiment, ''))
  ) stored,
  created_at timestamptz not null default now()
);

alter table public.memories add column if not exists memory_type text not null default 'memory';
alter table public.memories add column if not exists place_name text;
alter table public.memories add column if not exists latitude double precision;
alter table public.memories add column if not exists longitude double precision;
alter table public.memories add column if not exists location_note text;

create table if not exists public.preferences (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  category text not null,
  detail_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  target_for_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  category text,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.important_dates (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null,
  date_value date not null,
  date_type text not null default 'anniversary',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_profiles_couple_id on public.profiles(couple_id);
create index if not exists idx_couple_invites_code on public.couple_invites(code);
create index if not exists idx_couple_invites_couple_id on public.couple_invites(couple_id);
create index if not exists idx_memories_couple_id on public.memories(couple_id);
create index if not exists idx_memories_couple_type on public.memories(couple_id, memory_type);
create index if not exists idx_memories_coordinates on public.memories(couple_id, latitude, longitude)
where latitude is not null and longitude is not null;
create index if not exists idx_preferences_couple_id on public.preferences(couple_id);
create index if not exists idx_wishlist_items_couple_id on public.wishlist_items(couple_id);
create index if not exists idx_wishlist_items_status on public.wishlist_items(status);
create index if not exists idx_important_dates_couple_id on public.important_dates(couple_id);
create index if not exists idx_important_dates_date_value on public.important_dates(date_value);
create index if not exists idx_memories_search_tsv on public.memories using gin(search_tsv);
create index if not exists idx_memories_embedding on public.memories
using ivfflat (vector_embedding vector_cosine_ops)
with (lists = 100);

drop function if exists public.match_memories(vector, text, uuid, integer);

create or replace function public.match_memories(
  query_embedding vector(1536),
  query_text text,
  target_couple_id uuid,
  match_count int default 6
)
returns table (
  id uuid,
  content text,
  image_url text,
  location text,
  memory_type text,
  place_name text,
  latitude double precision,
  longitude double precision,
  location_note text,
  sentiment text,
  memory_timestamp timestamptz,
  similarity double precision
)
language sql
stable
as $$
  with scored as (
    select
      m.id,
      m.content,
      m.image_url,
      m.location,
      m.memory_type,
      m.place_name,
      m.latitude,
      m.longitude,
      m.location_note,
      m.sentiment,
      m."timestamp" as memory_timestamp,
      1 - (m.vector_embedding <=> query_embedding) as vector_score,
      ts_rank_cd(m.search_tsv, plainto_tsquery('simple', query_text)) as text_score
    from public.memories m
    where m.couple_id = target_couple_id
      and m.vector_embedding is not null
  )
  select
    scored.id,
    scored.content,
    scored.image_url,
    scored.location,
    scored.memory_type,
    scored.place_name,
    scored.latitude,
    scored.longitude,
    scored.location_note,
    scored.sentiment,
    scored.memory_timestamp,
    (0.78 * scored.vector_score + 0.22 * scored.text_score) as similarity
  from scored
  order by similarity desc
  limit match_count;
$$;

alter table public.couples enable row level security;
alter table public.profiles enable row level security;
alter table public.couple_invites enable row level security;
alter table public.memories enable row level security;
alter table public.preferences enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.important_dates enable row level security;

drop policy if exists "members can read their couple" on public.couples;
create policy "members can read their couple"
on public.couples for select
using (
  id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "users can create their couple" on public.couples;
create policy "users can create their couple"
on public.couples for insert
with check (
  partner_1_id = auth.uid() or partner_2_id = auth.uid()
);

drop policy if exists "members can update their couple" on public.couples;
create policy "members can update their couple"
on public.couples for update
using (
  id in (select couple_id from public.profiles where user_id = auth.uid())
)
with check (
  id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
on public.profiles for select
using (user_id = auth.uid());

drop policy if exists "users can create own profile" on public.profiles;
create policy "users can create own profile"
on public.profiles for insert
with check (user_id = auth.uid());

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "members can create couple invites" on public.couple_invites;
create policy "members can create couple invites"
on public.couple_invites for insert
with check (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can read couple invites" on public.couple_invites;
create policy "members can read couple invites"
on public.couple_invites for select
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
  or accepted_by_user_id = auth.uid()
);

drop policy if exists "members can update couple invites" on public.couple_invites;
create policy "members can update couple invites"
on public.couple_invites for update
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
  or accepted_by_user_id = auth.uid()
)
with check (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
  or accepted_by_user_id = auth.uid()
);

drop policy if exists "members can read couple memories" on public.memories;
create policy "members can read couple memories"
on public.memories for select
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can insert couple memories" on public.memories;
create policy "members can insert couple memories"
on public.memories for insert
with check (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can update couple memories" on public.memories;
create policy "members can update couple memories"
on public.memories for update
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
)
with check (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can delete couple memories" on public.memories;
create policy "members can delete couple memories"
on public.memories for delete
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can read couple preferences" on public.preferences;
create policy "members can read couple preferences"
on public.preferences for select
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can insert couple preferences" on public.preferences;
create policy "members can insert couple preferences"
on public.preferences for insert
with check (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can update couple preferences" on public.preferences;
create policy "members can update couple preferences"
on public.preferences for update
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
)
with check (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can delete couple preferences" on public.preferences;
create policy "members can delete couple preferences"
on public.preferences for delete
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can read couple wishlist" on public.wishlist_items;
create policy "members can read couple wishlist"
on public.wishlist_items for select
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can insert couple wishlist" on public.wishlist_items;
create policy "members can insert couple wishlist"
on public.wishlist_items for insert
with check (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can update couple wishlist" on public.wishlist_items;
create policy "members can update couple wishlist"
on public.wishlist_items for update
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
)
with check (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can delete couple wishlist" on public.wishlist_items;
create policy "members can delete couple wishlist"
on public.wishlist_items for delete
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can read important dates" on public.important_dates;
create policy "members can read important dates"
on public.important_dates for select
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can insert important dates" on public.important_dates;
create policy "members can insert important dates"
on public.important_dates for insert
with check (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can update important dates" on public.important_dates;
create policy "members can update important dates"
on public.important_dates for update
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
)
with check (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

drop policy if exists "members can delete important dates" on public.important_dates;
create policy "members can delete important dates"
on public.important_dates for delete
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);
