-- PROJ-5 grant (same class as PROJ-2 BUG-7 / PROJ-3 / PROJ-4): without a base
-- table-level GRANT, `authenticated` and `service_role` get "42501: permission
-- denied for table plants" at runtime regardless of correct RLS — RLS only
-- narrows access once a GRANT exists. Granting explicitly is the convention for
-- every new table here.
--
-- Note: `authenticated` is granted all four verbs, but the RLS write policies
-- (Admins can insert/update/delete) still restrict insert/update/delete to admins.
-- The GRANT is the coarse gate; RLS is the fine-grained, per-role gate on top.
-- service_role bypasses RLS entirely — used by the seed script.

grant select, insert, update, delete on public.plants to authenticated;
grant all on public.plants to service_role;
