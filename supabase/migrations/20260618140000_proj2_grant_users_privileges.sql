-- PROJ-2 QA fix (BUG-7, Critical): the `authenticated` and `service_role` roles
-- have NO table-level privileges on public.users, so every authenticated profile
-- read/write fails at runtime with "42501: permission denied for table users" —
-- independent of RLS. (RLS only narrows access *after* a base GRANT exists.)
--
-- Root cause: Supabase's default privileges (ALTER DEFAULT PRIVILEGES ... GRANT
-- ... TO anon, authenticated) did not apply to this table because it was created
-- via the SQL editor under a role those defaults don't cover. Granting explicitly
-- is the portable fix and should be the convention for every later user-data table.
--
-- Surfaced only now: SMTP went live, enabling the first real authenticated session
-- (a two-account E2E pass). RLS owner-only policies remain the row-level gate.

grant select, insert, update, delete on public.users to authenticated;
grant all on public.users to service_role;
