# PROJ-10: In-App Notifications

## Status: Planned
**Created:** 2026-06-22
**Last Updated:** 2026-06-22

> Split out of PROJ-7 (2026-06-22) to keep plan review focused. PROJ-10 owns the
> in-app notification *system* — stored records + a minimal surface. **v1 scope is
> the single "your plan was updated" case** (an admin plant-deletion re-pointed a
> plant in your plan). The records are structured so a **v2** inbox/bell/push can be
> added with no rework.

## Dependencies
- Requires: **PROJ-6 (Rule-Based Plan Generation)** — the trigger is PROJ-6's **delete-reassignment**: when `reassign_and_delete_plant` re-points a user's `plan_plants` to a replacement, that is the event a notification records. The banner is surfaced on the plan view PROJ-6/PROJ-7 own.
- Requires: **PROJ-5 (Plant Database & Admin Interface)** — an admin deleting a plant is what initiates the reassignment.
- Requires: **PROJ-3 (Photo Upload & Space Scan)** — the "My Spaces" scan list/card is where the unread indicator appears.
- Requires: **PROJ-2 / PROJ-1** — owner-only RLS; the whole surface is behind the auth gate.
- **Related: PROJ-7 (Plan Review & Acceptance)** — the notice banner attaches to the plan view PROJ-7 makes interactive; the duplicate-line *merge* a reassignment can cause is handled in PROJ-7's plan rendering, not here.

## User Stories
- As a **user whose plan was changed because an admin removed a plant**, I want to be clearly told which plant was swapped in, so that my plan never changes silently and I keep trusting it.
- As a **user with several spaces**, I want an at-a-glance indicator on My Spaces showing which plan changed, so that I notice without opening every plan.
- As a **user who has seen a notice**, I want to dismiss it, so that it stops nagging me.
- As the **product**, I want notices stored as first-class records, so that a future inbox/bell/push (v2) can render the same data without a redesign.

## Out of Scope
<!-- What this feature explicitly does NOT cover. Critical for developer handoffs. -->
- **A global notifications inbox / bell / unread list** — **v2**. v1 renders the records minimally (banner + a My Spaces dot). The record shape is the v2 foundation.
- **Any notification type other than "plan updated by reassignment"** — v1 has exactly one type. Other events (welcome, seasonal nudges, etc.) are out (seasonal nudges are a PRD v2 non-goal).
- **Push notifications / email** — v2 non-goal (PRD). v1 is strictly in-app.
- **Live / real-time delivery** — v1 shows the notice on the **next load/refresh** of the plan or My Spaces; Supabase Realtime push is deferred.
- **Plan staleness** (plan no longer matches its scan) — that lives in **PROJ-7**; it is a plan-review concern, not an admin-triggered notification.
- **The duplicate-line merge** a reassignment can cause — handled in **PROJ-7**'s plan rendering.
- **Marking the data-side reassignment happen** — that already exists (PROJ-6's `reassign_and_delete_plant`); PROJ-10 only adds the *record creation* + surface.

## What Gets Built (product level)
- **Notification records** — one per affected plan owner when a reassignment changes their plan. Each carries: the owner, a **type** (`plan_updated`), the affected plan/scan, the **old → new plant** (names), a created timestamp, and a **read/dismissed** state. (Schema/where-created is `/architecture`.)
- **Plan banner** — a dismissible banner on the affected plan view: "A plant in this plan was replaced: *[old]* → *[new]*." Dismissing marks the record read.
- **My Spaces indicator** — a small "updated" dot on a scan's card when it has an unread plan-updated notice; clears when read.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] / Then [result]

- [ ] Given an admin deletes a plant referenced by a user's plan (with a replacement), when the reassignment completes, then a `plan_updated` notification record is created for that plan's owner with the old and new plant.
- [ ] Given an owner has an unread plan-updated notice, when they open the affected plan, then a dismissible banner shows the old → new plant.
- [ ] Given the banner is shown, when the owner dismisses it, then the record is marked read and the banner does not reappear on reload.
- [ ] Given an owner has an unread plan-updated notice, when they view My Spaces, then the affected scan's card shows an "updated" indicator.
- [ ] Given the notice has been read/dismissed, when the owner views My Spaces, then the indicator is gone.
- [ ] Given two users, when A is logged in, then A sees only A's own notifications, never B's (owner-only RLS).
- [ ] Given an unauthenticated visitor, when they attempt to read notifications, then they are denied / redirected to `/login`.
- [ ] Given multiple of a user's plans were changed, when they view My Spaces, then each affected scan card shows its own indicator.

## Edge Cases
- **Reassignment while the owner is viewing the plan** → the banner appears on the next load/refresh (no live push in v1).
- **The same plan is reassigned twice** before the user reads it → the latest notice reflects the current old→new; older unread notices for the same plan may be superseded (collapse to the most recent — `/architecture` detail).
- **A reassignment that merges into a plant already in the plan** → the notice still records old→new; the visible de-duplication of plan lines is PROJ-7's job.
- **User deletes the scan/plan that a notice refers to** → the notice is removed with it (cascade), so no dangling notice.
- **Dismiss is per-record** → dismissing one plan's notice never clears another's indicator.

## Technical Requirements (optional)
- **Security:** notification records are owner-only via RLS (`user_id = auth.uid()`); reads are auth-gated.
- **Record creation from a privileged context:** the inserter is PROJ-6's admin-only `reassign_and_delete_plant` (SECURITY DEFINER), which must create a record for each affected owner — `/architecture` to design (the function already runs with the privilege to write cross-user rows).
- **Forward-compatible shape:** a generic `notifications` table (type + payload + read state) so v2 can add types and an inbox without migration churn.
- **Performance:** the My Spaces indicator is a cheap per-user unread lookup; the plan banner reads the plan's own notice.

## Open Questions
<!-- Unresolved questions from the spec interview. Close them in /refine or /architecture when answered. -->
- [ ] **Notification record schema + creation point** — exact columns and how the SECURITY DEFINER `reassign_and_delete_plant` inserts a row per affected owner. `/architecture`.
- [ ] **Superseding/collapsing repeated notices** for the same plan — keep only the latest unread, or list each. `/architecture`.
- [ ] **Live delivery (Realtime)** — deferred to v2; v1 shows on next load.
- [ ] **v2 inbox/bell shape** — out of scope now; the record design should not preclude it.

## Decision Log
<!-- Record of conscious decisions made and why. Added to by /write-spec and /architecture. -->

### Product Decisions
<!-- Added by /write-spec -->
| Decision | Rationale | Date |
|----------|-----------|------|
| **Split from PROJ-7 into its own feature** | The notification *system* is a cross-cutting concern, not part of plan review; isolating it keeps PROJ-7 focused and lets this ship independently | 2026-06-22 |
| **P1, not P0** | The data-integrity reassignment already works (PROJ-6); the core Scan→Plan→Order journey functions without the *notice*. This is a trust-polish surface for a low-frequency event (admin plant-deletion) | 2026-06-22 |
| **v1 = one notification type** (`plan_updated`), stored as forward-compatible records, rendered minimally (banner + My Spaces dot) | Honours PROJ-5/6's "never silent" contract with the leanest UI, while the record shape lets v2 add an inbox/bell/push with no rework | 2026-06-22 |
| **No push / email / live delivery in v1** | Push/email are PRD v2 non-goals; showing on next load is sufficient for this low-frequency event | 2026-06-22 |
| **Staleness and duplicate-merge stay in PROJ-7** | Both are plan-review/rendering concerns, not admin-triggered notifications | 2026-06-22 |

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
