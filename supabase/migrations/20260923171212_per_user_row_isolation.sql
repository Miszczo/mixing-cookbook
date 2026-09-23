-- Isolation patterns for later product tables:
-- Private tables use user_id uuid not null references auth.users(id) on delete cascade and owner policies.
-- Catalog tables have no user_id, allow authenticated SELECT only, and receive rows from migrations.

create table public.isolation_probes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create table public.isolation_catalog (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  created_at timestamptz not null default now()
);

insert into public.isolation_catalog (label)
values ('starter-visible');

alter table public.isolation_probes enable row level security;
alter table public.isolation_catalog enable row level security;

create policy "isolation_probes_select_own"
  on public.isolation_probes
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "isolation_probes_insert_own"
  on public.isolation_probes
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "isolation_probes_update_own"
  on public.isolation_probes
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "isolation_probes_delete_own"
  on public.isolation_probes
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "isolation_catalog_select_authenticated"
  on public.isolation_catalog
  for select
  to authenticated
  using (true);

revoke all on table public.isolation_probes from anon, authenticated;
revoke all on table public.isolation_catalog from anon, authenticated;

grant select, insert, update, delete on table public.isolation_probes to authenticated;
grant select on table public.isolation_catalog to authenticated;
