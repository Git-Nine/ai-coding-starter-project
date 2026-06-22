-- PROJ-6: activates PROJ-5's delete-reassignment contract (data-integrity half).
--
-- Deleting a plant that is referenced by plan_plants is blocked by the RESTRICT FK.
-- This admin-only function re-points every referencing plan line to the admin-chosen
-- replacement, THEN hard-deletes the plant — atomically, in one transaction — so no
-- user's plan is ever left pointing at a missing plant. The plan lines being
-- re-pointed belong to OTHER users, so this is the ONE place that must legitimately
-- cross owner-only RLS: hence SECURITY DEFINER, gated by an explicit is_admin() check.
-- (The "your plan was updated" in-app notification to affected users is PROJ-7.)
--
-- search_path pinned to '' (advisor 0011); all object refs are schema-qualified.

create or replace function public.reassign_and_delete_plant(
  target_plant_id uuid,
  replacement_plant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Admin gate. is_admin() (SECURITY INVOKER) reads the CALLER's own users row via
  -- auth.uid(), so it correctly authorises the original caller even inside DEFINER.
  if not public.is_admin() then
    raise exception 'Only admins can delete plants' using errcode = '42501';
  end if;

  -- The replacement must be a different, existing plant (mirrors the UI's dialog rules).
  if target_plant_id = replacement_plant_id then
    raise exception 'The replacement must be a different plant' using errcode = '22023';
  end if;
  if not exists (select 1 from public.plants where id = replacement_plant_id) then
    raise exception 'Replacement plant does not exist' using errcode = '23503';
  end if;

  -- Re-point every plan line from the deleted plant to the replacement, then delete.
  -- Quantities are carried over unchanged (a pure swap). Merging duplicate lines that
  -- could result (a plan that already held the replacement) is deferred to PROJ-7;
  -- no (plan_id, plant_id) uniqueness is enforced, so the swap never fails here.
  update public.plan_plants
    set plant_id = replacement_plant_id
    where plant_id = target_plant_id;

  delete from public.plants where id = target_plant_id;
end;
$$;

comment on function public.reassign_and_delete_plant(uuid, uuid) is
  'PROJ-6: admin-only. Re-points plan_plants from a deleted plant to a replacement, then hard-deletes the plant, atomically. Enforces PROJ-5''s no-orphan contract.';

-- Revoke the implicit PUBLIC execute grant (removes the anon path → advisor 0028),
-- then grant only to signed-in users. The in-function is_admin() check is the real
-- gate; advisor 0029 (authenticated can execute) is accepted by design — admins call
-- this via the authenticated browser client and the function self-authorises.
revoke execute on function public.reassign_and_delete_plant(uuid, uuid) from public;
grant execute on function public.reassign_and_delete_plant(uuid, uuid) to authenticated;
