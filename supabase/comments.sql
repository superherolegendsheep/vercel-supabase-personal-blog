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

create policy "comments are readable"
on public.comments
for select
using (true);
