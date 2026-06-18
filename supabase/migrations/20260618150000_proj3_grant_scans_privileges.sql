-- PROJ-3 fix (same Critical class as PROJ-2's BUG-7): the `authenticated` and
-- `service_role` roles have NO table-level privileges on public.scans, so every
-- authenticated scan read/write fails at runtime with "42501: permission denied
-- for table scans" — independent of RLS (which only narrows access once a base
-- GRANT exists). Supabase's default privileges did not apply to this table
-- (created via the SQL editor under a role those defaults don't cover).
--
-- Found via the PROJ-2 two-account RLS harness, which surfaced the identical gap
-- on public.users. Granting explicitly is the convention for every user-data
-- table. RLS owner-only policies remain the row-level gate.

grant select, insert, update, delete on public.scans to authenticated;
grant all on public.scans to service_role;
