-- Own recipes, private to the owner, with the screenshot stored on the row.
-- Deleting a recipe also removes that user's saved progress for it.

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  intent text not null check (char_length(intent) between 1 and 100),
  required_type text not null check (required_type in ('compressor', 'eq', 'reverb', 'delay', 'saturation', 'other')),
  steps jsonb not null check (
    jsonb_typeof(steps) = 'array'
    and jsonb_array_length(steps) between 1 and 20
  ),
  image_data text not null check (char_length(image_data) <= 1400000),
  image_mime text not null check (image_mime in ('image/png', 'image/jpeg', 'image/webp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_user_id_idx on public.recipes (user_id);

alter table public.recipes enable row level security;

create policy "recipes_select_own"
  on public.recipes
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "recipes_insert_own"
  on public.recipes
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "recipes_delete_own"
  on public.recipes
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.recipes from anon, authenticated;

grant select, insert, delete on table public.recipes to authenticated;

create function public.recipes_delete_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.track_recipe_progress
  where recipe_id = old.id::text
    and user_id = old.user_id;
  return old;
end;
$$;

create trigger recipes_delete_progress
  after delete on public.recipes
  for each row
  execute function public.recipes_delete_progress();
