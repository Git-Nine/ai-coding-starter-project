-- PROJ-5: Plant Database & Admin Interface — the plants table.
-- The shared catalogue the rule engine (PROJ-6) plans from. Unlike scans/users
-- this is NOT owner-scoped: every authenticated user may READ it; only admins
-- (role = 'admin' on public.users) may INSERT/UPDATE/DELETE — the PRD constraint.
-- Attribute vocabularies are kept in lockstep with PROJ-3 (sun), PROJ-4 (soil,
-- whole-number hardiness zone) and PROJ-2 (maintenance) so PROJ-6 can match
-- plant ↔ site directly. The seed script (npm run seed:plants) loads the initial
-- set via the service-role key, which bypasses RLS.

create table public.plants (
  id                 uuid        primary key default gen_random_uuid(),
  common_name        text        not null check (char_length(common_name) between 1 and 100),
  -- Unique → blocks duplicate entries across seeding + admin curation; the seed's idempotency key.
  latin_name         text        not null unique check (char_length(latin_name) between 1 and 120),

  -- Multi-value sets: every element must belong to the allowed bucket, and the set is non-empty.
  -- (PROJ-6 matches the site's single value against the set: site_value = ANY(...).)
  sun_tolerance      text[]      not null check (
                                   array_length(sun_tolerance, 1) >= 1
                                   and sun_tolerance <@ array['full', 'partial', 'shade']
                                 ),
  soil_compatibility text[]      not null check (
                                   array_length(soil_compatibility, 1) >= 1
                                   and soil_compatibility <@ array['sand', 'loam', 'clay', 'silt', 'peat']
                                 ),

  -- Whole-number hardiness zone (aligned to PROJ-4's output). PROJ-6 keeps a plant when
  -- the site's zone is at least this hardy: site_zone >= min_hardiness_zone.
  min_hardiness_zone smallint    not null check (min_hardiness_zone between 1 and 12),

  -- Mature size in centimetres (groundcover → small trees) for PROJ-6 spacing / plant counts.
  mature_height_cm   integer     not null check (mature_height_cm between 1 and 3000),
  mature_spread_cm   integer     not null check (mature_spread_cm between 1 and 3000),

  maintenance_level  text        not null check (maintenance_level in ('low', 'medium', 'high')),
  native             boolean     not null default false,

  image_url          text,       -- optional public URL; format-validated in the app, not here
  care_notes         text        check (care_notes is null or char_length(care_notes) <= 2000),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz
);

comment on table public.plants is
  'PROJ-5: shared plant catalogue. Read by all authenticated users; written only by admins. Seeded once via the service role, curated via /admin/plants. Consumed by PROJ-6 plan generation.';

alter table public.plants enable row level security;

-- Admin check, reused by the three write policies. SECURITY INVOKER: it runs as the
-- calling user and reads only their OWN public.users row (which PROJ-1's "view own
-- profile" policy already permits), so no elevated privilege is needed. STABLE +
-- pinned search_path satisfy the function-search-path advisor; INVOKER avoids the
-- SECURITY DEFINER advisor (0028/0029).
create or replace function public.is_admin()
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Read: any signed-in user (PROJ-6 needs the catalogue; end users never see this table directly).
create policy "Authenticated users can view plants"
  on public.plants for select
  to authenticated
  using (true);

-- Write: admins only. The admin route redirect is UX; THIS is the real boundary.
create policy "Admins can insert plants"
  on public.plants for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update plants"
  on public.plants for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete plants"
  on public.plants for delete
  to authenticated
  using (public.is_admin());

-- Serves the default list ordering (alphabetical by common name). The unique
-- constraint on latin_name already provides its own index for lookups/idempotent seeds.
create index idx_plants_common_name on public.plants (common_name);

-- Keep updated_at fresh on every edit. Reuses the trigger function defined in PROJ-3
-- (public.set_updated_at, search_path-pinned, plain trigger).
create trigger trg_plants_set_updated_at
  before update on public.plants
  for each row execute function public.set_updated_at();
