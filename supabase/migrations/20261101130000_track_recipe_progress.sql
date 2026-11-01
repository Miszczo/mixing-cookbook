-- One row per track and recipe: checked steps and the manual tool choice.
-- Foreign key checks bypass RLS, so the policies check ownership of the track and the plugin.

create table public.track_recipe_progress (
  track_id uuid not null references public.tracks (id) on delete cascade,
  recipe_id text not null check (char_length(recipe_id) between 1 and 100),
  user_id uuid not null references auth.users (id) on delete cascade,
  completed_steps text[] not null default '{}',
  selected_plugin_id uuid references public.plugins (id) on delete set null,
  use_native boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (track_id, recipe_id),
  check (selected_plugin_id is null or not use_native)
);

create index track_recipe_progress_user_id_idx on public.track_recipe_progress (user_id);
create index track_recipe_progress_selected_plugin_id_idx on public.track_recipe_progress (selected_plugin_id);

alter table public.track_recipe_progress enable row level security;

create policy "track_recipe_progress_select_own"
  on public.track_recipe_progress
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "track_recipe_progress_insert_own"
  on public.track_recipe_progress
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.tracks t
      where t.id = track_id and t.user_id = (select auth.uid())
    )
    and (
      selected_plugin_id is null
      or exists (
        select 1 from public.plugins p
        where p.id = selected_plugin_id and p.user_id = (select auth.uid())
      )
    )
  );

create policy "track_recipe_progress_update_own"
  on public.track_recipe_progress
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.tracks t
      where t.id = track_id and t.user_id = (select auth.uid())
    )
    and (
      selected_plugin_id is null
      or exists (
        select 1 from public.plugins p
        where p.id = selected_plugin_id and p.user_id = (select auth.uid())
      )
    )
  );

revoke all on table public.track_recipe_progress from anon, authenticated;

grant select, insert, update on table public.track_recipe_progress to authenticated;
