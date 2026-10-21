# Preview test environment

**Milestone (current):** a protected Vercel preview where RAPID staff fill in fictional applications and check the whole path: application form, Firebase, Google Drive, admin verification, spreadsheet export. This is **not** the production launch. Not allowed in this milestone: the live scholarship domain, the old application, DNS changes, or the cutover.

## What is where

| Part | Preview setting |
|---|---|
| URL | https://rapid-scholarship-test.vercel.app (stable alias of the latest preview deployment) |
| **Not this app** | `https://rapidcharity.vercel.app/apply/form` is the **original website** mock/demo apply form (Next.js). It does **not** use Firebase `rapid-cc35e` or the Drive bridge. |
| Vercel project | `rapid-scholarship-preview` (separate from the website; no Git connection, so pushes do not deploy it) |
| Protection | Vercel Authentication on every deployment. Visitors without access are sent to the Vercel login |
| Firebase | Test project `rapid-cc35e`: web app "RAPID Scholarship Application (preview)", Firestore `(default)` in nam5, email-link sign-in only |
| Server code | One Vercel function, `/api/rpc`, running `functions/src/rpc.ts` (the same handlers the Cloud Functions use) |
| Server identity | Service account `rapid-preview-server@rapid-cc35e.iam.gserviceaccount.com`, roles Firestore user and Firebase Auth admin only |
| Drive | Apps Script bridge as rapidcharity@gmail.com, allowed root = **RAPID Spring 2027 Test** (`1wEUCIj_AOttFAwu4BxzAYxqPCbsTFH6h`) only |
| Staff | `STAFF_EMAILS` = rapidcharity@gmail.com, ofranc1208@gmail.com, preview-staff@example.test (fictional, used by the automated tests) |
| File limit | 3 MB per document |

Vercel environment variables (Preview only, encrypted): `FIREBASE_SERVICE_ACCOUNT_BASE64`, `DRIVE_BRIDGE_URL`, `DRIVE_BRIDGE_SECRET`, `DRIVE_ROOT_FOLDER_ID`, `SCHOLARSHIP_DUPLICATE_HMAC_SECRET`, `STAFF_EMAILS`. Browser settings are in `.env.vercel-preview` (public by design).

## Giving staff access

Vercel Authentication lets in only people signed in to the Vercel account. For other RAPID staff, open the deployment in the Vercel dashboard, click **Share**, and send the link. It works for 23 hours; make a new one when it expires. Anyone holding a share link can open the preview, so send it only to RAPID testers.

## Testing by hand (fictional data only)

1. Open the share link. The red banner says this is the test environment.
2. **Applicant:** sign in with an email you can read (a `+test` alias such as `rapidcharity+applicant1@gmail.com` works). Fill in every section with made-up details. Upload placeholder files: blank PDFs or simple images, never real CNICs or results. Submit and note the receipt.
3. **Staff:** sign in as rapidcharity@gmail.com or ofranc1208@gmail.com and open **Staff** (`/admin`).
   - Open the application and set **Scholarship type** to IA, RIA or RM. The page should say "Documents filed in Drive folder RIA." (or IA / RM).
   - In Drive, under **RAPID Spring 2027 Test**, the application folder (an opaque id, no name) has moved from `INTAKE` to that folder.
   - Click **View** on documents, then **Verify**, or **Reject** with a note.
   - Change the type again: the folder moves, and the documents still open.
4. **Export:** on the list, pick the round and type, then click **Export Excel (.xlsx)**. You get the sheets Applications, Academic results and Documents. **Export CSV** gives the same as three CSV files, which open in Excel or Google Sheets (File → Import).
5. **Blocked:** an applicant account opening `/admin` sees "This account is not on the RAPID staff list."

## Automated run against the preview

Prerequisites: a gcloud login with owner access to `rapid-cc35e` (used to create sign-in links without sending email, and to read Firestore for checks), and a fresh share link.

```
$env:PREVIEW_SHARE_URL = "<share link from Vercel>"
npm run test:preview
```

This creates three fictional applicants, one per type, uploads six placeholder documents each through the real bridge, then has staff classify, view, verify, reject, reclassify and export. It also checks that anonymous and non-staff calls are refused. Results go to `docs/evidence/preview-run-<id>.json`.

## Redeploying

```
npm run deploy:preview
npx vercel alias set <new deployment url> rapid-scholarship-test.vercel.app
```

Never use `--prod`. A production deployment of this project is not covered by the Vercel Authentication setting it currently uses, and the server secrets exist only for Preview.

## Status checklist

| Area | State |
|---|---|
| Separate protected Vercel project and stable preview URL | Done |
| Firebase test project: web app, Firestore, email-link Auth, rules deployed | Done |
| Server functions on Vercel with a least-privilege service account | Done |
| IA / RIA / RM classification with Drive refiling (emulator and fake bridge: unit, integration, E2E) | Done |
| Excel and CSV export | Done |
| Apps Script bridge deployed as rapidcharity@gmail.com, URL in Vercel | **Waiting on RAPID** |
| Real Drive run on the preview (`npm run test:preview`) | **Blocked until the bridge is deployed** |
| Staff share link | **RAPID to create in the Vercel dashboard** |
| 3 MB file limit acceptable | **RAPID to confirm** |
| Live Spring 2027 `JIA` folder renamed to `RIA` | Not needed for preview; decide before production |
| Production: Blaze, production root, final staff list, deploy, DNS, cutover | Out of scope for this milestone |
