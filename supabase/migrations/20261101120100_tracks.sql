-- Tracks per user, with a name and a production stage.

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  stage text not null check (stage in ('aranz', 'miks', 'master')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tracks_user_id_idx on public.tracks (user_id);

alter table public.tracks enable row level security;

create policy "tracks_select_own"
  on public.tracks
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "tracks_insert_own"
  on public.tracks
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "tracks_update_own"
  on public.tracks
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.tracks from anon, authenticated;

grant select, insert, update on table public.tracks to authenticated;
