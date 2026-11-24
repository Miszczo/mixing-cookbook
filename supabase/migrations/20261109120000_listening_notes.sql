-- Listening notes on a track: reference equipment, free-text notes, and the track stage at save time.
-- Notes are immutable (no update policy or grant). Foreign key checks bypass RLS,
-- so the insert policy checks that the track belongs to the caller.

create table public.listening_notes (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  equipment text not null check (char_length(equipment) between 1 and 100),
  body text not null check (char_length(body) between 1 and 2000),
  stage text not null check (stage in ('aranz', 'miks', 'master')),
  created_at timestamptz not null default now()
);

create index listening_notes_track_id_created_at_idx on public.listening_notes (track_id, created_at desc);
create index listening_notes_user_id_idx on public.listening_notes (user_id);

alter table public.listening_notes enable row level security;

create policy "listening_notes_select_own"
  on public.listening_notes
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "listening_notes_insert_own"
  on public.listening_notes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.tracks t
      where t.id = track_id and t.user_id = (select auth.uid())
    )
  );

create policy "listening_notes_delete_own"
  on public.listening_notes
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.listening_notes from anon, authenticated;

grant select, insert, delete on table public.listening_notes to authenticated;
