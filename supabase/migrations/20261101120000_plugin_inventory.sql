-- Owned plugins per user. Matching reads the type and the favorite flag.

create table public.plugins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  plugin_type text not null check (
    plugin_type in ('compressor', 'eq', 'reverb', 'delay', 'saturation', 'other')
  ),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plugins_user_id_idx on public.plugins (user_id);

alter table public.plugins enable row level security;

create policy "plugins_select_own"
  on public.plugins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "plugins_insert_own"
  on public.plugins
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "plugins_update_own"
  on public.plugins
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "plugins_delete_own"
  on public.plugins
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.plugins from anon, authenticated;

grant select, insert, update, delete on table public.plugins to authenticated;
