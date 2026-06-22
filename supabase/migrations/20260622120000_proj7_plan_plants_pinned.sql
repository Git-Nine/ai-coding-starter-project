-- PROJ-7: Plan Review & Acceptance.
--
-- One column: `pinned` on plan_plants. PROJ-7's editor lets the user hand-set a
-- plant's quantity with the stepper; a pinned line keeps its exact quantity and is
-- excluded from the engine's rebalancing when the set changes. Default false →
-- existing lines (and freshly generated plans, which don't set it) are un-pinned,
-- so the existing row backfills cleanly.
--
-- No RLS / policy / grant changes: owner-only access to plan_plants (joined through
-- plans → scans) and the `authenticated`/`service_role` grants were established in
-- PROJ-6's migrations and already cover this column.

alter table public.plan_plants
  add column pinned boolean not null default false;

comment on column public.plan_plants.pinned is
  'PROJ-7: the user hand-set this quantity → excluded from rebalancing.';
