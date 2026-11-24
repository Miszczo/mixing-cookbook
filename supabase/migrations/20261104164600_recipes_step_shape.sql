-- Own-recipe steps must match the form: 1–20 objects with a short id and text.
-- A check constraint cannot contain a subquery, so the rule lives in an immutable function.
-- The delete trigger stays security definer, but the API roles cannot call it.

create function public.recipe_steps_valid(steps jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(steps) = 'array'
    and pg_catalog.jsonb_array_length(steps) between 1 and 20
    and coalesce((
      select pg_catalog.bool_and(
        pg_catalog.jsonb_typeof(step) = 'object'
        and pg_catalog.jsonb_typeof(step -> 'id') = 'string'
        and pg_catalog.jsonb_typeof(step -> 'text') = 'string'
        and pg_catalog.char_length(step ->> 'id') between 1 and 20
        and pg_catalog.char_length(step ->> 'text') between 1 and 200
      )
      from pg_catalog.jsonb_array_elements(steps) as step
    ), false);
$$;

revoke all on function public.recipe_steps_valid(jsonb) from public, anon, authenticated;
grant execute on function public.recipe_steps_valid(jsonb) to authenticated;

alter table public.recipes drop constraint recipes_steps_check;

alter table public.recipes
  add constraint recipes_steps_check
  check (public.recipe_steps_valid(steps));

revoke all on function public.recipes_delete_progress() from public, anon, authenticated;
