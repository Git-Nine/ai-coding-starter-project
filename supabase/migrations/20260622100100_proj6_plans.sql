-- PROJ-6: Rule-Based Plan Generation — the plans + plan_plants tables.
--
-- A scan has at most ONE plan (scan_id UNIQUE → 1:1). `plans` stores a SNAPSHOT of
-- the conditions the plan was generated from (so the read-only plan view is
-- self-contained and PROJ-7 can detect staleness). `plan_plants` holds the chosen
-- plants + recommended quantities. Both follow the project's owner-only RLS pattern,
-- reached through the scan: `plans` keys on user_id directly; `plan_plants` joins
-- through `plans` to verify ownership (the PRD constraint).

create table public.plans (
  id                   uuid        primary key default gen_random_uuid(),
  -- One plan per scan; deleting the scan removes its plan (and its lines, via cascade below).
  scan_id              uuid        not null unique references public.scans(id) on delete cascade,
  user_id              uuid        not null references auth.users(id) on delete cascade,

  -- Snapshot of the inputs the plan was generated from (conditions the plan view shows).
  snapshot_sun         text        not null check (snapshot_sun in ('full', 'partial', 'shade')),
  snapshot_area_sqm    integer     not null check (snapshot_area_sqm between 1 and 5000),
  snapshot_surface     text        not null check (snapshot_surface in ('gravel', 'lawn', 'soil', 'paved', 'mixed')),
  snapshot_space_type  text        not null check (snapshot_space_type in ('front_garden', 'back_garden', 'balcony', 'bed')),
  snapshot_soil        text        check (snapshot_soil is null or snapshot_soil in ('sand', 'loam', 'clay', 'silt', 'peat')),
  snapshot_zone        smallint    check (snapshot_zone is null or snapshot_zone between 1 and 12),
  snapshot_maintenance text        check (snapshot_maintenance is null or snapshot_maintenance in ('low', 'medium', 'high')),

  -- Plan-level flags / counts.
  zone_unconfirmed     boolean     not null default false,
  extra_match_count    integer     not null default 0 check (extra_match_count >= 0),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz
);

comment on table public.plans is
  'PROJ-6: one rule-generated plan per scan (1:1). Owner-only RLS; stores the conditions snapshot the plan was based on.';

create table public.plan_plants (
  id         uuid        primary key default gen_random_uuid(),
  plan_id    uuid        not null references public.plans(id) on delete cascade,
  -- RESTRICT, not CASCADE: a plant in use cannot be plainly deleted — this enforces
  -- PROJ-5's no-orphan contract and forces admin deletes through the reassignment
  -- function (see 20260622100300_proj6_reassign_and_delete_plant.sql).
  plant_id   uuid        not null references public.plants(id) on delete restrict,
  quantity   integer     not null check (quantity >= 1),
  sort_order integer     not null default 0,
  -- Whether this plant may not suit the site soil (computed at generation time).
  soil_flag  boolean     not null default false,
  created_at timestamptz not null default now()
);

comment on table public.plan_plants is
  'PROJ-6: the plant lines of a plan (plant + recommended quantity). Ownership verified by joining through plans → scans.';

-- Indexes: list lines for a plan (ordered), and the reassignment / RESTRICT-FK lookup by plant.
create index idx_plans_user_id on public.plans (user_id);
create index idx_plan_plants_plan_id on public.plan_plants (plan_id);
create index idx_plan_plants_plant_id on public.plan_plants (plant_id);

-- Keep plans.updated_at fresh (reuses PROJ-3's set_updated_at trigger function).
create trigger trg_plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- ---- RLS: plans — owner-only (mirrors scans). ----
alter table public.plans enable row level security;

create policy "Users can view own plans"
  on public.plans for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Insert must be the caller's own row AND reference a scan the caller owns.
create policy "Users can insert own plans"
  on public.plans for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.scans s
      where s.id = scan_id and s.user_id = (select auth.uid())
    )
  );

create policy "Users can update own plans"
  on public.plans for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own plans"
  on public.plans for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---- RLS: plan_plants — ownership reached by joining through plans. ----
alter table public.plan_plants enable row level security;

create policy "Users can view own plan lines"
  on public.plan_plants for select
  to authenticated
  using (
    exists (
      select 1 from public.plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );

create policy "Users can insert own plan lines"
  on public.plan_plants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );

create policy "Users can update own plan lines"
  on public.plan_plants for update
  to authenticated
  using (
    exists (
      select 1 from public.plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );

create policy "Users can delete own plan lines"
  on public.plan_plants for delete
  to authenticated
  using (
    exists (
      select 1 from public.plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );
