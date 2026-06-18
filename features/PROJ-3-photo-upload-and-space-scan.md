# PROJ-3: Photo Upload & Space Scan

## Status: Planned
**Created:** 2026-06-18
**Last Updated:** 2026-06-18

## Dependencies
- Requires: **PROJ-1 (Supabase Infrastructure Setup)** — the private, user-namespaced `photos` bucket and the RLS ownership pattern (`user_id = auth.uid()`) this feature's new `scans` table must follow.
- Requires: **PROJ-2 (User Authentication & Profile)** — a scan belongs to a logged-in user; the whole feature lives behind the auth gate.

> **Note for `/architecture`:** PROJ-3 creates the **`scans` table** (deferred to this feature by PROJ-1's Out of Scope). It follows PROJ-1's RLS convention. No new storage bucket — scan photos reuse the existing private `photos` bucket at `{user_id}/scans/{scan_id}`.

## User Stories
- As **Maya (the Guilty Non-Starter)**, I want to snap or upload one photo of my space and answer a few quick questions, so that I can hand the planning over without overthinking it.
- As **Thomas (the Pragmatic Rockery Defender)**, I want to record that my space is currently gravel and describe its conditions accurately, so that any later plan is grounded in my real situation.
- As a **logged-in user with several spaces**, I want to scan more than one area (front garden, balcony) and see them as a list, so that I can plan each independently.
- As a **returning user**, I want to view, correct, and delete my saved scans, so that my spaces stay accurate over time.
- As a **privacy-conscious user**, I want my space photos stored privately under my own account, so that no one else can see my home.
- As a **first-time user with no scans yet**, I want a clear prompt to create my first scan, so that I know exactly how to start the journey.

## Out of Scope
- **Environmental enrichment** (soil via BGR, weather via DWD, hardiness zone) — **PROJ-4**. PROJ-3 captures the user's manual inputs and the location; PROJ-4 augments a saved scan with derived data.
- **Plan generation and the working "Generate plan" action** — **PROJ-6**. PROJ-3 renders the seam only: a visible, disabled "Generate plan" affordance on the scan detail that PROJ-6 wires up. No plan logic here.
- **AI vision auto-population** of the scan fields from the photo — deferred swap-in point (PRD v1 non-goal). The manual form and the photo are designed so a vision model later fills the *same* fields.
- **Multiple / multi-angle photos per scan** — one photo per scan in v1; multi-angle is a later iteration once AI vision lands.
- **Progress photos / re-photographing a space over time** — **PROJ-9**.
- **Photo editing** — cropping, filters, rotation, annotation.
- **Sharing scans, public spaces, or collaboration** — not in v1.
- **Per-scan maintenance preference** — the profile holds the single default (PROJ-2); per-space capture is out of scope.
- **Non-Germany locations** — postcode validation is German PLZ (5 digits) only, per the Germany-first constraint.

## Acceptance Criteria

**Format:** Given [precondition] / When [action] / Then [result]

### Creating a scan
- [ ] Given a logged-in user on the new-scan screen, when they provide a photo and fill the required fields (location, sun exposure, current surface, space type, size) and save, then the scan is stored and they land on its detail view with a "Space saved" confirmation.
- [ ] Given a logged-in user, when they start a new scan, then they can either take a photo with the camera or choose one from their library (mobile), or drag/drop / browse (desktop).
- [ ] Given a selected photo, when it loads, then a preview is shown with an option to retake/replace it before saving.
- [ ] Given a photo with EXIF GPS data, when it is selected, then the coordinates are reverse-geocoded to prefill the postcode field (which the user can still edit/confirm) and retained for later enrichment (PROJ-4); the capture date is also read.
- [ ] Given a photo with no GPS or a geocoding lookup that fails, when it is selected, then the postcode field is left empty for manual entry and no error blocks the scan.

### Photo validation
- [ ] Given a file that is an allowed image type (JPEG/PNG/WebP/HEIC) under 10 MB, when the user adds it, then it is accepted.
- [ ] Given a disallowed file type or a file over 10 MB, when the user adds it, then an error is shown and no upload occurs.
- [ ] Given the user tries to save without a photo, when they submit, then a validation error is shown and nothing is saved.

### Field validation
- [ ] Given an empty or non-German postcode (not exactly 5 digits), when the user saves, then a validation error is shown and nothing is saved.
- [ ] Given any required choice field (sun exposure, current surface, space type) left unselected, when the user saves, then a validation error names the missing field and nothing is saved.
- [ ] Given the approximate area (m²) is empty, zero/negative, non-numeric, or outside the allowed range, when the user saves, then a validation error is shown and nothing is saved.
- [ ] Given an optional space name over its character limit, when the user saves, then a validation error is shown.

### Listing, viewing & editing
- [ ] Given a user with one or more saved scans, when they open "My Spaces", then each scan is listed with its photo thumbnail, name/space type, and a short summary (e.g. sun · surface).
- [ ] Given a user viewing a scan's detail, when the screen loads, then the photo, all captured fields, and a disabled "Generate plan" affordance marked as the next step are shown.
- [ ] Given a user editing a saved scan, when they change fields and/or replace the photo and save, then the changes persist and a confirmation is shown.
- [ ] Given a user with no scans, when they open "My Spaces", then an empty state invites them to create their first scan.

### Deleting a scan
- [ ] Given a user on a scan, when they choose "Delete", then a confirmation dialog appears before anything is removed.
- [ ] Given the confirmation dialog, when they confirm, then the scan record and its stored photo are both deleted and the user returns to the list.
- [ ] Given the confirmation dialog, when they cancel, then nothing is deleted.

### Security (carries PROJ-1's RLS/storage pattern)
- [ ] Given two users, when A is logged in, then A can list, view, edit, and delete only A's own scans, never B's.
- [ ] Given a scan photo, when it is uploaded, then it lives under the owner's namespace (`{user_id}/scans/...`) in the private bucket and is not accessible to other users.
- [ ] Given an unauthenticated visitor, when they navigate to any scan screen, then they are redirected to `/login` (per PROJ-2's middleware gate).

## Edge Cases
- **EXIF GPS stripped, absent, or geocoding fails/times out** (many platforms strip GPS on upload) → silently fall back to manual postcode entry; no error, no blocked scan.
- **EXIF GPS resolves outside Germany** → prefill is discarded (or flagged); user enters a German PLZ manually, consistent with the Germany-first constraint.
- **HEIC preview** — HEIC may not render in all browsers for the in-page preview → handle gracefully (e.g. generic placeholder thumbnail) without blocking the upload/save.
- **Photo uploads but the DB insert fails** → orphaned file; the fixed `{user_id}/scans/{scan_id}` path and/or cleanup keeps storage consistent (mirrors PROJ-2's avatar-orphan handling).
- **Network failure during upload or save** → error shown, the user's form input and selected photo are preserved.
- **User navigates away mid-scan** → unsaved scan is discarded (no draft persistence in v1); a confirm-before-leaving prompt is a nice-to-have.
- **Very large image on a slow mobile connection** → show upload progress; client-side downscale before upload is a possible optimization (architecture decision).
- **Corrupt / unreadable image file** → rejected with a clear error.
- **Concurrent edits to the same scan from two tabs** → last write wins (no locking in v1, consistent with PROJ-2).
- **Two scans of the same space type** (e.g. two balconies) → the optional name and/or created date disambiguate them in the list.
- **Deleting a scan that already has a plan** (future, once PROJ-6 exists) → cascade/cleanup is PROJ-6's concern; flagged for that feature.

## Technical Requirements (optional)
- **Security:** whole feature behind PROJ-2's auth gate; new `scans` table uses PROJ-1's owner-only RLS (`user_id = auth.uid()`); photos stay in the private bucket under the user's namespace, served via short-lived signed URLs.
- **Mobile-first:** primary viewport 390px; camera capture is a first-class path.
- **Geography:** German PLZ (5-digit) postcode validation; location data feeds PROJ-4 (Germany-scoped).
- **AI-ready shape:** the manual fields and stored photo are structured so a future vision model can populate the same fields without schema or UI changes.

## Open Questions
- [x] **Reverse-geocoding EXIF GPS → postcode** — **Resolved (product):** auto-fill the postcode from the photo's GPS, with manual entry/override as the fallback. **Open for `/architecture`:** which free service (e.g. Nominatim/OSM), its rate limits and German-PLZ accuracy, and whether the lookup runs client- or server-side.
- [x] **Size representation** — **Resolved (product):** capture an approximate area in **square meters** (numeric input), not buckets. **For `/architecture`:** sensible min/max + step, and confirm the m² value suits PROJ-6's rule engine.
- [ ] **Client-side image downscaling** before upload to ease mobile data/storage — decide at `/architecture`.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Capture photo + 5 manual fields (location, sun, surface, space type, size) | Enough signal for the PROJ-6 rule engine and gives PROJ-4 the location to enrich; stays short enough for the under-5-minute / low-friction goal (Maya) | 2026-06-18 |
| Size captured as approximate area in square meters (numeric) | More precise input for the rule engine (plant counts/spacing) than coarse buckets; users can estimate m² for a typical garden/balcony | 2026-06-18 |
| Photo required; manual fields required; space name optional | The photo and conditions are the point of a scan; a name is cosmetic and falls back to space type + date | 2026-06-18 |
| Capture *current surface* (incl. gravel/paved) | Directly serves the hardscape-to-garden conversion and grounds plans in reality (Thomas) | 2026-06-18 |
| Multiple scans per user with a history list, each independently editable/deletable | Matches the per-space journey; sets up PROJ-9 progress logging; each scan will get its own plan (PROJ-6) | 2026-06-18 |
| One photo per scan (multi-angle deferred) | Keeps capture fast and storage simple for v1; revisit when AI vision needs more angles | 2026-06-18 |
| Camera-or-library input; JPEG/PNG/WebP/HEIC ≤ 10 MB | Mobile-first capture; 10 MB (vs the 5 MB avatar) suits full-scene phone photos; HEIC is common on iPhone | 2026-06-18 |
| Auto-fill postcode by reverse-geocoding EXIF GPS, with manual entry/override as fallback | Photo-first magic: a GPS-tagged photo prefills location; manual entry still covers stripped/absent GPS and keeps the user in control. GPS also retained for PROJ-4 | 2026-06-18 |
| After save → scan detail with a disabled "Generate plan" CTA | A clean, visible seam for PROJ-6 to wire into; nothing fake shown to the user | 2026-06-18 |
| German PLZ-only location validation | Germany-first constraint; non-DE locations out of scope for v1 | 2026-06-18 |

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
