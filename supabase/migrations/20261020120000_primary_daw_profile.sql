-- One primary DAW id per user. Later native-tool maps rely on these five ids.

create table public.daw_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daw_id text not null check (
    daw_id in (
      'ableton-live',
      'fl-studio',
      'logic-pro',
      'bitwig-studio',
      'reaper'
    )
  ),
  updated_at timestamptz not null default now()
);

alter table public.daw_profiles enable row level security;

create policy "daw_profiles_select_own"
  on public.daw_profiles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "daw_profiles_insert_own"
  on public.daw_profiles
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "daw_profiles_update_own"
  on public.daw_profiles
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.daw_profiles from anon, authenticated;

grant select, insert, update on table public.daw_profiles to authenticated;
