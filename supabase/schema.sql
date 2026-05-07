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

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  content text,
  image_url text,
  vector_embedding vector(1536),
  location text,
  sentiment text,
  timestamp timestamptz not null default now(),
  search_tsv tsvector generated always as (
    to_tsvector('simple', coalesce(content, '') || ' ' || coalesce(location, '') || ' ' || coalesce(sentiment, ''))
  ) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.preferences (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  category text not null,
  detail_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_profiles_couple_id on public.profiles(couple_id);
create index if not exists idx_memories_couple_id on public.memories(couple_id);
create index if not exists idx_preferences_couple_id on public.preferences(couple_id);
create index if not exists idx_memories_search_tsv on public.memories using gin(search_tsv);
create index if not exists idx_memories_embedding on public.memories
using ivfflat (vector_embedding vector_cosine_ops)
with (lists = 100);

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
    scored.sentiment,
    scored.memory_timestamp,
    (0.78 * scored.vector_score + 0.22 * scored.text_score) as similarity
  from scored
  order by similarity desc
  limit match_count;
$$;

alter table public.couples enable row level security;
alter table public.profiles enable row level security;
alter table public.memories enable row level security;
alter table public.preferences enable row level security;

create policy "members can read their couple"
on public.couples for select
using (
  id in (select couple_id from public.profiles where user_id = auth.uid())
);

create policy "users can read own profile"
on public.profiles for select
using (user_id = auth.uid());

create policy "members can read couple memories"
on public.memories for select
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);

create policy "members can read couple preferences"
on public.preferences for select
using (
  couple_id in (select couple_id from public.profiles where user_id = auth.uid())
);
