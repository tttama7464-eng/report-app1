-- =============================================================================
-- Sense — database schema
-- "TikTok for decisions": binary image comparisons + aggregated human intuition.
--
-- Run this once against a fresh Supabase project (SQL Editor, or `supabase db push`).
-- Idempotent-ish: safe to re-run on a project created from this same file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type age_group as enum ('10s', '20s', '30s', '40s', '50s', '60s_plus');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gender_type as enum ('male', 'female', 'other', 'prefer_not_to_say');
exception when duplicate_object then null; end $$;

do $$ begin
  create type creative_field as enum (
    'designer', 'artist', 'musician', 'architect',
    'photographer', 'fashion', 'student', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type vote_choice as enum ('left', 'right');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- One row per authenticated user. Created automatically on signup (trigger below).
-- Every demographic field is optional — intuition data should never be gated
-- behind a forced profile.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  avatar_url text,
  country text,
  age_group age_group,
  gender gender_type,
  occupation text,
  creative_field creative_field,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Optional demographic profile, one per auth.users row.';

-- Fixed taxonomy for posts. Seeded below; not user-editable.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order int not null default 0
);

-- A single binary comparison: two images, one question.
-- left_votes/right_votes are denormalized counters maintained exclusively by
-- the cast_vote() RPC below, so feed/explore reads never need to aggregate votes.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 500),
  image_left_url text not null,
  image_right_url text not null,
  left_votes int not null default 0,
  right_votes int not null default 0,
  total_votes int generated always as (left_votes + right_votes) stored,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_category_idx on public.posts (category_id);
create index if not exists posts_total_votes_idx on public.posts (total_votes desc);
create index if not exists posts_user_id_idx on public.posts (user_id);

-- One vote per user per post. Rows are immutable and written only through
-- cast_vote() — never inserted/updated directly by clients (see RLS below).
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  choice vote_choice not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists votes_post_id_idx on public.votes (post_id);
create index if not exists votes_user_id_idx on public.votes (user_id);

-- -----------------------------------------------------------------------------
-- profiles: auto-create on signup
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'name', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.posts enable row level security;
alter table public.votes enable row level security;

-- profiles: readable by anyone (needed for public post attribution + filters),
-- writable only by the owner.
drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- categories: read-only to clients, managed via SQL/admin only.
drop policy if exists "categories are viewable by everyone" on public.categories;
create policy "categories are viewable by everyone"
  on public.categories for select
  using (true);

-- posts: readable by anyone; only the authenticated author may create;
-- only the author may delete their own post.
drop policy if exists "posts are viewable by everyone" on public.posts;
create policy "posts are viewable by everyone"
  on public.posts for select
  using (true);

drop policy if exists "authenticated users can create posts" on public.posts;
create policy "authenticated users can create posts"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "authors can delete own posts" on public.posts;
create policy "authors can delete own posts"
  on public.posts for delete
  to authenticated
  using (auth.uid() = user_id);

-- votes: a user may read their own votes (to know what they've already voted on).
-- No direct insert/update/delete policy is granted — all writes go through the
-- cast_vote() SECURITY DEFINER RPC so counters and vote rows stay consistent
-- and "no duplicate voting" is enforced in one place.
drop policy if exists "users can view own votes" on public.votes;
create policy "users can view own votes"
  on public.votes for select
  to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RPC: cast_vote — the only way a vote gets written.
-- Atomically inserts the vote and bumps the post's counters; relies on the
-- unique(post_id, user_id) constraint to reject duplicate votes.
-- -----------------------------------------------------------------------------
create or replace function public.cast_vote(p_post_id uuid, p_choice vote_choice)
returns table (left_votes int, right_votes int, user_choice vote_choice)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.votes (post_id, user_id, choice)
  values (p_post_id, v_user_id, p_choice);

  update public.posts p
  set
    left_votes = p.left_votes + (case when p_choice = 'left' then 1 else 0 end),
    right_votes = p.right_votes + (case when p_choice = 'right' then 1 else 0 end)
  where p.id = p_post_id;

  return query
    select p.left_votes, p.right_votes, p_choice
    from public.posts p
    where p.id = p_post_id;
exception
  when unique_violation then
    raise exception 'already_voted' using errcode = '23505';
end;
$$;

grant execute on function public.cast_vote(uuid, vote_choice) to authenticated;

-- -----------------------------------------------------------------------------
-- RPC: get_feed_posts — infinite-scroll feed of posts the current user
-- has not yet voted on, newest first, keyset-paginated by created_at.
-- -----------------------------------------------------------------------------
create or replace function public.get_feed_posts(p_limit int default 10, p_cursor timestamptz default null)
returns table (
  id uuid,
  title text,
  description text,
  image_left_url text,
  image_right_url text,
  left_votes int,
  right_votes int,
  total_votes int,
  created_at timestamptz,
  user_id uuid,
  username text,
  avatar_url text,
  category_id uuid,
  category_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.title, p.description, p.image_left_url, p.image_right_url,
    p.left_votes, p.right_votes, p.total_votes, p.created_at,
    p.user_id, pr.username, pr.avatar_url,
    p.category_id, c.name as category_name
  from public.posts p
  join public.profiles pr on pr.id = p.user_id
  left join public.categories c on c.id = p.category_id
  where (p_cursor is null or p.created_at < p_cursor)
    and (
      auth.uid() is null
      or not exists (
        select 1 from public.votes v
        where v.post_id = p.id and v.user_id = auth.uid()
      )
    )
  order by p.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_feed_posts(int, timestamptz) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- RPC: get_post_results — aggregated left/right split, optionally filtered
-- by any combination of voter demographics. Returns only aggregate counts,
-- never raw vote rows, regardless of the caller's RLS access to `votes`.
-- -----------------------------------------------------------------------------
create or replace function public.get_post_results(
  p_post_id uuid,
  p_country text default null,
  p_age_group age_group default null,
  p_gender gender_type default null,
  p_occupation text default null,
  p_creative_field creative_field default null
)
returns table (
  left_count bigint,
  right_count bigint,
  total bigint,
  left_pct numeric,
  right_pct numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (where v.choice = 'left') as left_count,
    count(*) filter (where v.choice = 'right') as right_count,
    count(*) as total,
    case when count(*) = 0 then 0
      else round(100.0 * count(*) filter (where v.choice = 'left') / count(*), 1)
    end as left_pct,
    case when count(*) = 0 then 0
      else round(100.0 * count(*) filter (where v.choice = 'right') / count(*), 1)
    end as right_pct
  from public.votes v
  join public.profiles pr on pr.id = v.user_id
  where v.post_id = p_post_id
    and (p_country is null or pr.country = p_country)
    and (p_age_group is null or pr.age_group = p_age_group)
    and (p_gender is null or pr.gender = p_gender)
    and (p_occupation is null or pr.occupation = p_occupation)
    and (p_creative_field is null or pr.creative_field = p_creative_field);
$$;

grant execute on function public.get_post_results(uuid, text, age_group, gender_type, text, creative_field)
  to authenticated, anon;

-- -----------------------------------------------------------------------------
-- RPC: get_profile_stats — total votes received + most popular post, for a
-- user's profile page. Computed on demand rather than denormalized.
-- -----------------------------------------------------------------------------
create or replace function public.get_profile_stats(p_user_id uuid)
returns table (
  post_count bigint,
  total_votes_received bigint,
  most_popular_post_id uuid
)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) as post_count,
    coalesce(sum(p.total_votes), 0) as total_votes_received,
    (
      select p2.id from public.posts p2
      where p2.user_id = p_user_id
      order by p2.total_votes desc, p2.created_at desc
      limit 1
    ) as most_popular_post_id
  from public.posts p
  where p.user_id = p_user_id;
$$;

grant execute on function public.get_profile_stats(uuid) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- Seed categories
-- -----------------------------------------------------------------------------
insert into public.categories (name, slug, sort_order) values
  ('Fashion', 'fashion', 1),
  ('Art', 'art', 2),
  ('Logo', 'logo', 3),
  ('Photography', 'photography', 4),
  ('Interior', 'interior', 5),
  ('Food', 'food', 6),
  ('Architecture', 'architecture', 7),
  ('Other', 'other', 8)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Storage: public bucket for the two comparison images per post.
-- Path convention enforced by policy: {user_id}/{post-scoped filename}
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

drop policy if exists "post images are publicly readable" on storage.objects;
create policy "post images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'post-images');

drop policy if exists "users can upload post images to own folder" on storage.objects;
create policy "users can upload post images to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users can delete own post images" on storage.objects;
create policy "users can delete own post images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
