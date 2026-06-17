# PROJ-1: Supabase Infrastructure Setup

## Status: Planned
**Created:** 2026-06-17
**Last Updated:** 2026-06-17

## Dependencies
- None

## User Stories
- As a **developer**, I want a configured Supabase project with environment variables wired into the app, so that I can build every feature against a working backend.
- As a **developer**, I want a documented RLS convention and a foundational `users` table, so that every later feature enforces per-user data isolation the same way.
- As a **new user**, I want to authenticate via a magic link (no password), so that I can get started with minimal friction. _(Login UI is PROJ-2; PROJ-1 only enables the provider.)_
- As a **user**, I want my photos stored privately in my own namespace, so that no other user can ever access them.
- As the **operator**, I want to designate admin accounts, so that I can manage the plant database later (PROJ-5).

## Out of Scope
- Signup/login/profile **UI and flows** — PROJ-2 (PROJ-1 enables the provider and creates the table; PROJ-2 builds the screens)
- **Capturing** profile values (maintenance preference, experience level) via UI — PROJ-2 (the columns exist here, but are not populated through any UI)
- All **feature-specific tables** — `scans` (PROJ-3), `plants` + admin (PROJ-5), `plans`/`plan_plants` (PROJ-6/PROJ-7), `shopping_lists` (PROJ-8), `progress_logs` (PROJ-9). Each is created by its owning feature following PROJ-1's RLS pattern.
- **Admin / role-management UI** — admins are set manually via SQL for v1
- **External API** config and integration (BGR, DWD, hardiness zones) — PROJ-4
- **Plant data seeding** — PROJ-5
- **Next.js production hosting / deployment** — `/deploy`
- **Custom SMTP / branded magic-link emails** — uses Supabase's default email service for v1 (see Open Questions)
- **Social / OAuth providers** — deferred

## Acceptance Criteria

**Format:** Given [precondition] / When [action] / Then [result]

- [ ] Given the Supabase environment variables are set, when the application starts, then the Supabase client connects successfully without errors.
- [ ] Given the Supabase environment variables are missing or invalid, when the application starts, then startup fails with a clear error message (fail fast) rather than a silent null client.
- [ ] Given a new user authenticates for the first time, when authentication succeeds, then a corresponding record is automatically created in the `users` table with `role = 'user'`.
- [ ] Given magic link is enabled as the auth method, when a sign-in is requested with a valid email address, then Supabase sends a magic-link email to that address.
- [ ] Given RLS is active on the `users` table, when a logged-in user queries data, then they receive only their own record (`user_id = auth.uid()`).
- [ ] Given a logged-in user attempts to read or modify another user's record, when the request executes, then it is denied by RLS.
- [ ] Given a private, user-namespaced storage bucket is configured, when a user uploads a file into their own folder (`/{user_id}/...`), then the upload succeeds.
- [ ] Given a user is logged in, when they attempt to access a file in another user's folder, then access is denied by the storage policy.
- [ ] Given a new user is created, when no role is explicitly set, then the default value is `role = 'user'`.
- [ ] Given a `users` record has `role = 'admin'` (set manually), when the role is queried, then `'admin'` is returned and is available for later admin gates.

## Edge Cases
- **Missing/invalid env vars** — the app fails fast with a clear message, not a silent null client.
- **Repeated first-login / race condition** — profile-row auto-creation must be idempotent (no duplicate `users` rows).
- **Auth user deletion** — what happens to their `users` row and stored files? (cascade / GDPR erasure — see Open Questions).
- **Storage path manipulation** — a user crafting a path outside `/{their_id}/` is denied by the storage policy.
- **Expired or reused magic-link token** — rejected; the user must request a new link.
- **Magic-link email not delivered / rate-limited** — Supabase's default email service has rate limits (UI messaging is handled in PROJ-2, but the limit exists at this layer).

## Technical Requirements (optional)
- **Security:** RLS enabled on every user-data table (PROJ-1 sets the pattern and applies it to `users`); private storage buckets; secrets only in environment variables, never committed.
- All user-data tables follow the `user_id = auth.uid()` ownership rule.
- Auth session handling wired for both server and client (App Router) plus middleware for protected routes.

## Open Questions
- [ ] Magic-link email: stick with Supabase's built-in email service for v1, or configure custom SMTP for deliverability/branding? (Built-in service has rate limits.)
- [ ] On auth-user deletion, should the `users` row **and** the user's storage files cascade-delete (GDPR right-to-erasure)? Assumed yes — confirm.
- [ ] Single hosted Supabase project for v1 (no separate staging environment)? Assumed yes.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Foundation-only schema (not all 7 tables) | Single Responsibility — later features own their tables; avoids speccing tables blind | 2026-06-17 |
| Magic-link (passwordless) auth | Low friction, no password management, fits the calm tone | 2026-06-17 |
| Admins assigned manually via SQL; default `role = 'user'` | Lowest-effort, safe approach for single-operator v1; no admin-role UI in scope | 2026-06-17 |
| Single private storage bucket, user-namespaced (`/{user_id}/...`) for all photos | Simplest model satisfying the isolation requirement; scan and progress photos share it | 2026-06-17 |
| Profile columns (maintenance preference, experience level, role) created in PROJ-1 | Schema foundation belongs here; value-capture UI deferred to PROJ-2 | 2026-06-17 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| _To be added by /architecture_ | | |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
