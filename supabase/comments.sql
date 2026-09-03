create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  name text not null,
  quote text default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_post_id_created_at_idx
on public.comments (post_id, created_at desc);

alter table public.comments enable row level security;

drop policy if exists "comments are readable" on public.comments;
drop policy if exists "comments are insertable" on public.comments;

create policy "comments are readable"
on public.comments
for select
using (true);

create policy "comments are insertable"
on public.comments
for insert
with check (true);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  unique (post_id, ip_hash)
);

create index if not exists likes_post_id_idx
on public.likes (post_id);

alter table public.likes enable row level security;

drop policy if exists "likes are readable" on public.likes;
drop policy if exists "likes are insertable" on public.likes;
drop policy if exists "likes are removable" on public.likes;

create policy "likes are readable"
on public.likes
for select
using (true);

create policy "likes are insertable"
on public.likes
for insert
with check (true);

create policy "likes are removable"
on public.likes
for delete
using (true);

alter table public.comments
add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  comment_id uuid not null references public.comments(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, ip_hash)
);

create index if not exists comment_likes_post_id_idx
on public.comment_likes (post_id);

create index if not exists comment_likes_comment_id_idx
on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

drop policy if exists "comment likes are readable" on public.comment_likes;
drop policy if exists "comment likes are insertable" on public.comment_likes;
drop policy if exists "comment likes are removable" on public.comment_likes;

create policy "comment likes are readable"
on public.comment_likes
for select
using (true);

create policy "comment likes are insertable"
on public.comment_likes
for insert
with check (true);

create policy "comment likes are removable"
on public.comment_likes
for delete
using (true);
