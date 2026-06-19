-- PROJ-4 fix (same class as PROJ-3's grant migration): `authenticated` and
-- `service_role` have no table-level privileges on public.scan_enrichment, so
-- every enrichment read/write fails at runtime with "42501: permission denied"
-- even though RLS policies are correct. RLS only narrows access once a base
-- GRANT exists — without it, no access at all.
--
-- Found by the PROJ-4 RLS harness (service_role insert returned 42501).
-- Mirrors the scans grant exactly (20260618150000_proj3_grant_scans_privileges.sql).

grant select, insert, update, delete on public.scan_enrichment to authenticated;
grant all on public.scan_enrichment to service_role;
