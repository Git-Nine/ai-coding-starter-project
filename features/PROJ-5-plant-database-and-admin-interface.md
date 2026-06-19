# PROJ-5: Plant Database & Admin Interface

## Status: Planned
**Created:** 2026-06-19
**Last Updated:** 2026-06-19

## Dependencies
- Requires: **PROJ-1 (Supabase Infrastructure Setup)** — the `role` column on `users`, the owner-only RLS conventions, and the `authenticated`/`service_role` GRANT convention this feature's new `plants` table must follow.
- Requires: **PROJ-2 (User Authentication & Profile)** — admin gating relies on the `role = 'admin'` value and the auth middleware; the `maintenance_preference` vocabulary (`low/medium/high`) the plant `maintenance_level` must mirror.
- **Consumed by: PROJ-6 (Rule-Based Plan Generation)** — the rule engine matches these plants against a scan's enriched conditions. The plant attribute vocabulary in this spec is deliberately aligned with PROJ-3's scan fields and PROJ-4's enrichment output (see Decision Log).

## User Stories
- As the **operator/admin**, I want an initial set of German-relevant plants loaded into the database without entering them by hand, so that the rule engine (PROJ-6) has data to work with from day one.
- As the **operator/admin**, I want to add, edit, and delete plants through a private admin screen, so that I can curate the catalogue over time without touching SQL.
- As the **operator/admin**, I want to search and filter the plant list (by name, maintenance level, sun tolerance), so that I can find a specific plant quickly once the catalogue grows to hundreds of entries.
- As the **operator/admin**, I want every plant to carry the exact attributes the rule engine needs (sun, soil, hardiness, size, maintenance, native), so that plans can be generated reliably and grounded in each user's real conditions.
- As the **operator/admin**, I want to be forced to choose a replacement plant before I can delete any plant, so that no plan can ever be left pointing at a missing entry.
- As an **end user whose plan contained a deleted plant**, I want an in-app notification that my plan was updated, so that the change is transparent and my trust in the plan is preserved.
- As a **non-admin logged-in user**, I want the admin area to be invisible/inaccessible to me, so that the catalogue can only ever be changed by an authorised operator.

## Out of Scope
<!-- What this feature explicitly does NOT cover. Critical for developer handoffs. -->
- **Using plant data to generate plans / matching plants to a scan** — that is **PROJ-6**. PROJ-5 only stores and curates plants; it does not query them against conditions.
- **Showing plants to end users** (plan review, shopping list thumbnails) — **PROJ-6 / PROJ-7 / PROJ-8** consume the data; PROJ-5 has no end-user-facing plant screen.
- **Live integration with FloraWeb/BfN/any plant API** — the seed is a **one-time import** of cleaned reference data, not a live sync. No scheduled refresh.
- **Image upload / Supabase Storage for plant photos** — plants carry an optional **image URL** only. No upload pipeline (contrast with PROJ-2/PROJ-3 which do upload).
- **Admin role-management UI** — admins are still promoted manually via SQL/dashboard (decided in PROJ-1). PROJ-5 only *reads* `role = 'admin'`; it never grants it.
- **Moisture / drainage / pH plant attributes** — dropped for v1: there is no corresponding site value to match against (the scan and PROJ-4 enrichment produce none). Revisit if PROJ-6 proves it needs them — mirrors PROJ-4's deferral of soil moisture.
- **Soft-delete / archive / version history of plants** — deletion is a hard delete (with reassignment, see below). No `is_active` flag, no audit trail of catalogue changes for v1.
- **The replacement-on-delete *reassignment of plan references* and the *in-app notification* to affected users** — *specified* here as the deletion contract, but only *activates* once `plan_plants` exists (PROJ-6/7). In PROJ-5 the mandatory replacement *selector* is built and enforced, but there are no plan references to reassign and no users to notify yet. See "Deletion & Replacement" and the forward note for PROJ-6/7.
- **Push notifications** — the plan-updated notice is strictly **in-app** (a notification surface in the app), not push/email; push remains a v2 non-goal per the PRD.
- **Bulk edit / bulk delete / CSV editing through the UI** — single-record add/edit/delete only for v1. Bulk loading happens via the seed script.
- **Localisation of the admin UI** — German-relevant plant *data*, but the admin screen itself is not translated for v1.

## Plant Data Model (product-level — `/architecture` owns the schema)
Each plant record holds:

**Required (the rule engine cannot match a plant without these):**
- **Common name** — text (German common name).
- **Latin name** — text, **unique** (prevents duplicate entries across seeding + curation).
- **Sun tolerance** — one or more of `full` / `partial` / `shade`. The set of light conditions the plant tolerates; PROJ-6 matches the scan's single sun value against this set.
- **Soil compatibility** — one or more of `sand` / `loam` / `clay` / `silt` / `peat`. Aligned exactly with PROJ-4's five soil buckets.
- **Min hardiness zone** — the coldest zone the plant survives (e.g. `6a`). PROJ-6 keeps the plant if the site's zone (e.g. `7b`) is at least this hardy.
- **Mature height** — for spacing/plan layout (PROJ-6).
- **Mature spread** — for plant counts/spacing against the scan's area (m²).
- **Maintenance level** — `low` / `medium` / `high`. Mirrors PROJ-2's `maintenance_preference` vocabulary so PROJ-6 can match plant ↔ user preference directly.
- **Native to Germany** — boolean, defaults to `false`. Supports the PRD's "natives beat gravel" framing for Thomas.

**Optional:**
- **Image URL** — a public URL; validated as a well-formed URL if provided. No upload.
- **Short description / care notes** — free text for plan review (PROJ-7) context.

## Deletion & Replacement
- **Mandatory replacement (always, built in PROJ-5):** an admin can **only** delete a plant by selecting a **different existing plant from the list as its replacement**. The confirmation dialog cannot be confirmed without a replacement selected. On confirm, the plant is **hard-deleted** (row permanently removed). This rule is unconditional — it applies whether or not the plant is currently used in any plan — so the catalogue can never lose a plant without a designated successor.
- **No auto-suggestion:** the admin chooses the replacement manually. There is no system "best guess" for v1.
- **Reassignment of plan references (activates when `plan_plants` exists — PROJ-6/7):** on delete, all `plan_plants` rows referencing the deleted plant are **reassigned to the chosen replacement**, *then* the plant is hard-deleted. Every affected plan then legitimately contains the replacement; **no user-facing plan ever shows a missing entry or an error**.
- **In-app notification (activates with PROJ-6/7):** each end user whose plan was changed by a reassignment receives an **in-app notification** that their plan was updated. This applies even to *accepted* plans — the change is transparent, never silent.
- In PROJ-5 in isolation there are no plan references to reassign and no users to notify; only the mandatory-replacement dialog + hard delete is reachable and testable now.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] / Then [result]

### Seeding
- [ ] Given an empty `plants` table, when the seed script is run, then an initial set of German-relevant plants is loaded, each with all required attributes populated.
- [ ] Given the seed script is run a second time, when it executes, then it does not create duplicate plants (idempotent on the unique Latin name).

### Access control
- [ ] Given a logged-in user with `role = 'admin'`, when they navigate to `/admin/plants`, then the plant management screen loads.
- [ ] Given a logged-in user with `role = 'user'`, when they navigate to `/admin/plants`, then they are redirected to `/scans` (the admin area is not revealed to them).
- [ ] Given an unauthenticated visitor, when they navigate to `/admin/plants`, then they are redirected to `/login` (PROJ-2's gate).
- [ ] Given a non-admin user, when they send a crafted insert/update/delete request directly to the `plants` table, then it is rejected by RLS at the database (server-side enforcement, not just UI).

### List, search & filter
- [ ] Given seeded plants, when an admin opens `/admin/plants`, then plants are listed in a table with at least name, sun tolerance, maintenance level, and native flag visible.
- [ ] Given a populated list, when the admin types into search, then the list filters to plants whose common or Latin name matches.
- [ ] Given a populated list, when the admin filters by maintenance level and/or sun tolerance, then only matching plants are shown.
- [ ] Given no plants exist (e.g. before seeding), when an admin opens `/admin/plants`, then an empty state invites them to add the first plant.

### Add / edit
- [ ] Given an admin on the add-plant form, when they submit with all required fields valid, then the plant is created and appears in the list.
- [ ] Given an admin on the add/edit form, when any required field is missing or invalid, then a validation error names each offending field and nothing is saved.
- [ ] Given an admin enters a Latin name that already exists, when they submit, then a clear "this plant already exists" error is shown and no duplicate is created.
- [ ] Given an admin provides an image URL, when it is not a well-formed URL, then a validation error is shown; when it is empty, then the plant saves without an image.
- [ ] Given an existing plant, when an admin edits its fields and saves, then the changes persist and are reflected in the list.

### Delete (PROJ-5 scope)
- [ ] Given an existing plant, when an admin clicks Delete, then a confirmation dialog appears requiring a replacement plant to be selected before anything is removed.
- [ ] Given the delete dialog with no replacement selected, when the admin tries to confirm, then deletion is blocked and the replacement selection is requested.
- [ ] Given the delete dialog, when the admin selects a different plant as replacement and confirms, then the plant is hard-deleted and removed from the list; when they cancel, then nothing changes.
- [ ] Given only one plant exists in the catalogue, when an admin tries to delete it, then deletion is not possible because no replacement can be selected.

### Delete reassignment & notification (forward contract — activates with PROJ-6/7, not testable in PROJ-5 alone)
- [ ] Given a plant referenced by one or more plans, when an admin deletes it with a chosen replacement, then all referencing plan entries are reassigned to the replacement and the original plant is hard-deleted, with no plan left referencing a missing plant.
- [ ] Given a user's plan (including an accepted plan) had a plant reassigned, when the reassignment completes, then that user receives an in-app notification that their plan was updated.

## Edge Cases
- **Duplicate Latin name on add or edit** → rejected by the unique constraint; the form shows a friendly "already exists" message rather than a raw database error.
- **Image URL points at a dead/unreachable image** → PROJ-5 only validates URL *format*, not reachability; PROJ-6/7/8 render with a graceful fallback (broken-image handling is the consumer's concern, noted for them).
- **Admin deletes the *last* plant in the catalogue** → **not possible**: deletion requires selecting a different plant as replacement, and none exists. The catalogue can shrink to one plant but not to zero via the UI.
- **Admin selects the plant being deleted as its own replacement** → blocked: the replacement must be a *different* plant.
- **Two admins edit the same plant concurrently** → last write wins for v1 (single-operator assumption); no optimistic-locking UI. Noted as acceptable given one operator.
- **Seed script run against a partially-populated table** → must not clobber admin edits to existing plants nor create duplicates (idempotent insert on Latin name; does not overwrite).
- **Required attribute genuinely unknown for a seeded plant** (BfN data gap) → the seed must still satisfy required fields; the curator fills/fixes via the admin UI. The data model has no "unknown" sentinel for required fields.

## Technical Requirements (optional)
- **Security:** `plants` table — all `authenticated` users may **read**; only `role = 'admin'` may **insert/update/delete**, enforced by RLS at the database (per PRD constraint). Explicit `GRANT ... TO authenticated` per PROJ-2's BUG-7 convention. Admin route redirect is UX only; the DB is the real boundary.
- **Performance:** the list/search/filter must stay responsive at a few hundred plants (the expected v1 catalogue size).
- **Data alignment:** plant attribute vocabularies must remain in lockstep with PROJ-3 (sun) and PROJ-4 (soil, hardiness zone) — any change to those buckets is a breaking change for PROJ-6 matching.

## Open Questions
<!-- Unresolved questions from the spec interview. Close them in /refine when answered. -->
- [ ] **In-app notification surface** — no in-app notification mechanism exists yet. Where do plan-updated notices live (a bell/inbox, a banner on the plan, a badge on "My Plans")? Owned by PROJ-7 (plan review/acceptance); confirm there.
- [ ] **Reassignment of *accepted* plans** — resolved in principle (the plan changes and the user is notified, never silent), but the exact UX of surfacing the change on an accepted plan is a PROJ-7 detail.
- [ ] **Seed source & licensing** — confirm the exact FloraWeb/BfN dataset, its licence for redistribution, and the cleaning steps before import.
- [ ] **Hardiness zone storage** — store a single min zone label (e.g. `6a`) and compare ordinally against the site zone; confirm the ordering/lookup with PROJ-4's zone format at `/architecture`.

## Decision Log
<!-- Record of conscious decisions made and why. Added to by /write-spec and /architecture. -->

### Product Decisions
<!-- Added by /write-spec -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Seed script + admin UI for curation (not manual-only, not live API) | BfN/FloraWeb is reference data, not a live API; one-time clean import gives PROJ-6 data immediately; admin UI handles ongoing curation | 2026-06-19 |
| Plant attribute vocabulary aligned to scan (sun) + enrichment (soil, zone) + profile (maintenance) | The rule engine (PROJ-6) can only match if plant and site share vocabularies; alignment is the whole point of the data model | 2026-06-19 |
| Added `maintenance_level` (low/medium/high) | Directly maps to Maya's and Thomas's decision criteria and to PROJ-2's `maintenance_preference`; lets PROJ-6 personalise | 2026-06-19 |
| Dropped `moisture` for v1 | No site moisture value is captured (scan or enrichment) to match against; would be an orphan attribute. Same reasoning as PROJ-4 deferring soil moisture | 2026-06-19 |
| Latin name is unique | Prevents duplicate plant entries across seeding and admin curation; gives the seed an idempotency key | 2026-06-19 |
| Optional image URL field (no upload) | Seed photos come as public URLs; keeps PROJ-5 free of a storage/upload pipeline; thumbnails still available to PROJ-6/7/8 | 2026-06-19 |
| Sun tolerance & soil compatibility are multi-value sets | A plant tolerates a *range* of conditions; matching = site's single value ∈ plant's set | 2026-06-19 |
| Required vs optional split (matching fields required; image/notes optional) | PROJ-6 cannot match without the matching fields; cosmetic fields shouldn't block creating a usable plant | 2026-06-19 |
| Non-admins redirected to `/scans` (not a 403 page) | Don't reveal the admin route exists; RLS is the real security boundary, the redirect is UX | 2026-06-19 |
| Hard delete, with a **mandatory** replacement (admin must pick a different existing plant to delete any plant) | Guarantees the catalogue never loses a plant without a successor; keeps PROJ-5 simple (no soft-delete filtering tax); reassignment means no user ever sees a missing plant | 2026-06-19 |
| Admin picks the replacement manually — no auto-suggestion for v1 | Simpler and gives the operator full control; a rule-engine "best guess" can be added later (reuses PROJ-6 matching) | 2026-06-19 |
| Affected users get an **in-app** notification when a reassignment changes their plan (incl. accepted plans) | Transparency preserves trust — a plan must never change silently; in-app (not push, which is a v2 non-goal) | 2026-06-19 |
| Reassignment + notification specified here but activated in PROJ-6/7 | No `plan_plants` table or notification surface exists yet; the mandatory-replacement selector is built now, the rest activates when plans exist. Capturing the contract prevents an undocumented landmine | 2026-06-19 |

### Technical Decisions
<!-- Added by /architecture -->
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
