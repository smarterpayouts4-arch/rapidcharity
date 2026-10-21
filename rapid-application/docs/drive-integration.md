# Google Drive integration

Applicant documents are stored in the RAPID Google Drive (rapidcharity@gmail.com). A service account cannot own files in a personal Gmail Drive, so a small Apps Script web app (`drive-bridge/Code.gs`) runs as the RAPID account. The server operations call it, both as Cloud Functions (emulator) and as the Vercel preview function `/api/rpc`; see `functions/src/rpc.ts`.

## Flow

1. The applicant picks a file. The browser checks it, then sends it to the `uploadScholarshipDocument` function.
2. The function checks ownership, draft status, open cycle, type, size and file signature.
3. It reserves the Firestore record (`uploadStatus: "uploading"`), calls the bridge, then marks it `stored` with the Drive file ID.
4. Staff open files through `getScholarshipDocument`, which streams the bytes. No sharing link is ever created.

5. Staff set the scholarship type (IA, RIA or RM) with `setScholarshipType`. Firestore records it first; the bridge `file` action then moves the whole application folder, and `driveFolder` is updated once Drive confirms. If Drive fails, the admin page shows "filing pending" and choosing the type again retries.

Layout under each cycle root:

```
{root}/INTAKE/{applicationId}/   new uploads, and unassigned applications
{root}/IA/{applicationId}/
{root}/RIA/{applicationId}/
{root}/RM/{applicationId}/
        {CODE}-{n}-{key}.{ext}
```

The bridge creates the four folders when first needed. Moving a folder keeps every Drive file id, so Firestore's `driveFileId` values stay valid and nothing is copied. There are no names or CNICs in folder or file names.

Retries are safe: the file name is derived from the application, slot and file hash, so the bridge returns the existing file instead of creating a copy. Replaced files are kept and listed in `replacedDriveFileIds`; nothing is deleted.

## Bridge security

The URL is not treated as a secret. Every request is signed with HMAC-SHA256 using a shared secret, and it carries a timestamp (5-minute window) and a single-use nonce. The bridge only writes inside allowlisted root folders. It can only trash files inside test roots, and it forces private sharing on every file.

## Deploying the bridge (rapidcharity account)

1. Create an Apps Script project and paste `Code.gs` and `appsscript.json`.
2. Script properties:
   - `BRIDGE_SECRET`: the value in `functions/.secret.live.local` (generated locally, git-ignored).
   - `ALLOWED_ROOT_FOLDER_IDS`: the test root now; the production root at cutover.
   - `TEST_ROOT_FOLDER_IDS`: the test root only.
3. Deploy as a web app: execute as me, access anyone. The signature check is what protects it.
4. Server configuration: `DRIVE_BRIDGE_URL`, `DRIVE_BRIDGE_SECRET` (same value as `BRIDGE_SECRET`), `DRIVE_ROOT_FOLDER_ID`, `SCHOLARSHIP_DUPLICATE_HMAC_SECRET`, `STAFF_EMAILS`. For the preview these are Vercel environment variables (see `preview-environment.md`).

Redeploy the web app (Deploy → Manage deployments → edit → New version) whenever `Code.gs` changes; the URL stays the same.

## Folders

- Test root: **RAPID Spring 2027 Test** (`1wEUCIj_AOttFAwu4BxzAYxqPCbsTFH6h`), with `INTAKE`, `IA`, `RIA` and `RM` inside. All preview and test uploads go here.
- Live **Spring 2027** folder (`12j-UuBebdfteNPlCDyTBN8SSTTMuKTCT`) has `IA`, `JIA` and `RM`. It is not used and was not changed. Before it is used as a production root, RAPID must approve renaming `JIA` to `RIA` (or the bridge will create a separate `RIA` folder next to it).
- Production root: to be chosen at cutover.

## Testing

- **Simulated:** the emulator tests use `tests/support/fakeDriveBridge.ts`, which applies the same checks as `Code.gs` and keeps files in memory. This is not Google Drive.
- **Real:** after the bridge is deployed and its URL is added to `functions/.secret.live.local`, run `npm run live:drive`. It calls the real bridge with the Functions code (Firestore in the emulator) and writes `docs/evidence/live-drive-check.json`. Then `npm run live:drive:cleanup` trashes only the files it created.
