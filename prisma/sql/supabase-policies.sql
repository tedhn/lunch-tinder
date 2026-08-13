-- Supabase-specific setup that Prisma does not manage: row level security and
-- the Realtime publication. Re-runnable — apply it after every `db:push` or
-- `db:migrate` that creates or recreates these tables.
--
--   bun run db:policies
--
-- If your pooled connection refuses the DDL, paste this file into the Supabase
-- dashboard SQL editor instead; it does the same thing.
--
-- The app's own Prisma connection authenticates as the database owner, which
-- bypasses RLS. These policies therefore constrain exactly one thing: what the
-- browser can see over Realtime with the public anon key.

-- --- Row level security ------------------------------------------------------

alter table public.restaurant enable row level security;
alter table public.room       enable row level security;
alter table public.member     enable row level security;
alter table public.swipe      enable row level security;

-- Room codes are the only secret, and they are meant to be shouted across a
-- desk. Anyone holding one may watch the room's phase and its members' progress.
drop policy if exists "anon reads restaurants" on public.restaurant;
create policy "anon reads restaurants"
  on public.restaurant for select
  to anon, authenticated
  using (true);

drop policy if exists "anon reads rooms" on public.room;
create policy "anon reads rooms"
  on public.room for select
  to anon, authenticated
  using (true);

drop policy if exists "anon reads members" on public.member;
create policy "anon reads members"
  on public.member for select
  to anon, authenticated
  using (true);

-- `swipe` deliberately gets NO policy. RLS enabled with zero policies denies
-- everything, which is the point: individual votes must not be readable while
-- people are still swiping. Results reach clients only through the tRPC
-- `room.state` query, and only once the room's phase is "results".

-- No insert/update/delete policies anywhere either. Every write goes through
-- tRPC, so the browser never needs write access to Postgres.

-- --- Realtime publication -----------------------------------------------------

-- Clients subscribe to these two tables to learn that a round started, someone
-- joined, or somebody's swipe count moved. `swipe` is left out on purpose.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room'
  ) then
    alter publication supabase_realtime add table public.room;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'member'
  ) then
    alter publication supabase_realtime add table public.member;
  end if;
end
$$;
