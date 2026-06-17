-- PROJ-2: User Authentication & Profile — extend the profile row.
-- Adds the two optional fields the profile UI edits. Everything else
-- (email, role, maintenance_preference, experience_level) already exists from PROJ-1.
-- RLS, the owner-only policies, and the role-escalation guard are inherited unchanged.

alter table public.users
  add column if not exists display_name text
    check (display_name is null or char_length(display_name) <= 50),
  add column if not exists avatar_path text;

comment on column public.users.display_name is
  'PROJ-2: optional cosmetic name, <= 50 chars. Falls back to initials/email-prefix in the UI.';
comment on column public.users.avatar_path is
  'PROJ-2: storage path of the user''s avatar in the private photos bucket (fixed at {user_id}/avatar), or null.';
