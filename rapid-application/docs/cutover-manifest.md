# Cutover manifest (Phase 4 — fill before Phase 5)

## Pre-cutover checklist

- [ ] Phase 2 emulator acceptance tests green
- [ ] Historical archive verified (counts + hashes documented in Git)
- [ ] Oscar approval recorded

## Next.js changes (Phase 5)

- [ ] `NEXT_PUBLIC_SCHOLARSHIP_APP_URL=https://apply.rapidcharity.org`
- [ ] Apply buttons on `/apply` point to SPA
- [ ] `/apply/form` → redirect to SPA `/application`
- [ ] Disable old application API routes

## Firestore

- [ ] Legacy collections deny client writes (rules deployed)
- [ ] New submissions only in `scholarshipApplications`

## Legacy code removal (after live test)

Reachability audit before delete — see plan section 8.

Expected areas: `app/apply/form`, `app/api/applications`, `components/apply`, `lib/application`, admin application panels, apply-only tests.

## Rollback

- Revert Next.js Apply links to legacy (only if archive intact and Oscar approves)
- Do not delete archive
