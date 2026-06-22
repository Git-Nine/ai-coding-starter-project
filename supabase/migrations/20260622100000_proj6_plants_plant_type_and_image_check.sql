-- PROJ-6: extend the PROJ-5 plants catalogue for layered plan generation.
--
-- 1. plant_type — the structural layer (groundcover/perennial/shrub/tree) the
--    rule engine uses for the ~60/30/10 layered composition. Added nullable,
--    backfilled for the 14 seeded rows (any other pre-existing rows default to
--    'perennial' — the safe, most-common layer), then locked NOT NULL + CHECK.
-- 2. image_url — PROJ-5 BUG-1: the column had no DB-level format constraint
--    (only the client schema validated it). PROJ-6 is the first feature to RENDER
--    the image, so enforce an http(s)-only format at the database (defence to match
--    the tightened client plantSchema — BUG-2).

alter table public.plants add column plant_type text;

-- Backfill the seeded catalogue (mirrors scripts/seed-plants.mjs).
update public.plants set plant_type = 'groundcover' where latin_name = 'Geranium sanguineum';
update public.plants set plant_type = 'shrub'       where latin_name = 'Lavandula angustifolia';
update public.plants set plant_type = 'perennial'   where latin_name in (
  'Salvia nemorosa', 'Achillea millefolium', 'Hylotelephium telephium', 'Digitalis purpurea',
  'Echinacea purpurea', 'Nepeta x faassenii', 'Rudbeckia fulgida', 'Hosta sieboldiana',
  'Helleborus niger', 'Calamagrostis x acutiflora', 'Anemone hupehensis', 'Verbena bonariensis'
);
-- Any row not covered above (e.g. admin-added before this migration) → safe default.
update public.plants set plant_type = 'perennial' where plant_type is null;

alter table public.plants alter column plant_type set not null;
alter table public.plants
  add constraint plants_plant_type_check
  check (plant_type in ('groundcover', 'perennial', 'shrub', 'tree'));

comment on column public.plants.plant_type is
  'PROJ-6: structural layer for the 60/30/10 layered plan composition.';

-- BUG-1: http(s)-only format guard on image_url (null stays allowed — image is optional).
alter table public.plants
  add constraint plants_image_url_http_check
  check (image_url is null or image_url ~ '^https?://');
