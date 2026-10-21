# RAPID scholarship application: technical handoff

Last updated: 2026-10-21

## Accounts and project

| Item | Value |
|------|-------|
| Firebase project | `rapid-cc35e` (created 2026-10-21 under rapidcharity@gmail.com) |
| Plan | Spark (free). Blaze is required before Cloud Functions can be deployed. |
| Owner | rapidcharity@gmail.com |
| Developer access | ofranc1208@gmail.com invited as Owner (invitation pending acceptance) |
| Google Drive | rapidcharity@gmail.com |
| Test folder | RAPID Spring 2027 Test (`1wEUCIj_AOttFAwu4BxzAYxqPCbsTFH6h`) |
| Planned URL | `https://apply.rapidcharity.org` (DNS not changed) |

`rapid-cc35e` is a new, empty project. The existing website (Next.js) uses its own, separate Firebase project for the admin login and CMS. Nothing deployed to `rapid-cc35e`, including Firestore rules, can affect the website.

## Architecture

```
Applicant browser (Vite SPA, apply.rapidcharity.org)
  ├─ Firebase Auth: email link sign-in
  ├─ Firestore: drafts (owner-only), submitted applications, document metadata,
  │             cycles, typed-in answers queue, audit log
  └─ Cloud Functions (us-central1)
        uploadScholarshipDocument / getScholarshipDocument /
        setScholarshipDocumentVerification / submitScholarshipApplication / claimStaffAccess
          └─ Apps Script Drive bridge (runs as rapidcharity@gmail.com, HMAC-signed requests)
                └─ Drive: {cycle root}/{applicationId}/{CODE}-{n}-{key}.{pdf|jpg|png}
Staff browser → same SPA at /admin (staff claim from STAFF_EMAILS allowlist)
```

- Validation rules live once in `src/lib/form/` and run in the browser and in Functions.
- Files are never shared by link. Staff view them through a function that streams the bytes.
- Folder and file names contain only the opaque application ID, never names or CNICs.
- Scholarship type (JIA / RM / IA) is metadata set by staff on a submitted application (`scholarshipProgram`), included in the CSV export. It does not change where files are stored.

## Test evidence

| Kind | Environment | Result |
|------|-------------|--------|
| Unit | Node | 34/34 |
| Server and security rules | Auth + Firestore emulators, in-memory fake Drive bridge | 27/27 |
| Browser end-to-end (10 acceptance cases) | Emulators + fake Drive bridge, fictional data | 10/10 |
| Live Drive bridge | Real Apps Script + real test folder, Firestore emulator | **Not run yet** (bridge not deployed) |

The fake bridge applies the same checks as `Code.gs`, but it is not Google Drive. Only `npm run live:drive` counts as a real Drive test; its output goes to `docs/evidence/live-drive-check.json`.

## Deployment requirements

1. `rapid-cc35e` on **Blaze**, with a budget alert.
2. Apps Script bridge deployed as rapidcharity@gmail.com (`docs/drive-integration.md`).
3. Functions secrets: `DRIVE_BRIDGE_SECRET`, `SCHOLARSHIP_DUPLICATE_HMAC_SECRET`. Params: `DRIVE_BRIDGE_URL`, `DRIVE_ROOT_FOLDER_ID`, `STAFF_EMAILS`.
4. Firebase web app registered in the project; its config goes into the Vite build (`.env.example`).
5. Auth: enable Email link sign-in; add `apply.rapidcharity.org` to authorized domains.
6. Hosting site `rapid-cc35e-apply` (target `apply-rapidcharity` in `.firebaserc`).
7. Spring 2027 cycle document created (open flag, deadline) through the admin "Application round" tab.

## Operating costs and limits (approximate)

| Service | Free allowance on Blaze | Expected use |
|---------|-------------------------|--------------|
| Cloud Functions | 2M invocations/month | A few thousand per cycle |
| Firestore | 50k reads, 20k writes per day; 1 GiB stored | Well below |
| Hosting | 10 GB stored, ~360 MB/day transfer | Small static app |
| Auth (email link) | Sign-in emails have a daily sending quota | Check Authentication → Usage at peak |
| Apps Script (consumer account) | 6 min per execution, 30 simultaneous executions | One upload per call; uploads up to 5 MB |
| Drive storage | 15 GB shared across the rapidcharity Gmail account | About 6 files of up to 5 MB per applicant |

Expected cost at RAPID's volume is near zero, but Blaze has no hard cap; set a budget alert. Drive storage is the limit most likely to matter over several cycles.

## Rollback

Nothing is deployed, so there is nothing to roll back yet. After go-live:

1. Remove the custom domain from the apply Hosting site (the website is unaffected).
2. Close the cycle in the admin tab, which stops new drafts, uploads and submissions immediately.
3. If needed, redeploy the previous Firestore rules from Console → Firestore → Rules history.
4. Keep Drive files and Firestore records; deleting applicant data needs a retention decision.
5. The legacy website application stays in place until cutover is approved, so it remains the fallback.

## Remaining blockers

1. Accept the Firebase invitation as ofranc1208@gmail.com.
2. Deploy the Apps Script bridge (about 10 minutes as rapidcharity@gmail.com), then run `npm run live:drive`.
3. Upgrade `rapid-cc35e` to Blaze.
4. Decide: STAFF_EMAILS, Spring 2027 open date and deadline, consent/privacy text, retention period, production Drive root folder.
5. Approve deploy, then DNS, then cutover (each separately).
