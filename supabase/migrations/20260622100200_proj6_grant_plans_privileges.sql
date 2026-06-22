-- PROJ-6 grants (same class as PROJ-2 BUG-7 / PROJ-3 / PROJ-4 / PROJ-5): without a
-- base table-level GRANT, `authenticated`/`service_role` hit "42501: permission
-- denied" at runtime regardless of correct RLS. RLS only narrows access once a
-- GRANT exists. The owner-only RLS policies above are the fine-grained gate on top.

grant select, insert, update, delete on public.plans to authenticated;
grant all on public.plans to service_role;

grant select, insert, update, delete on public.plan_plants to authenticated;
grant all on public.plan_plants to service_role;
