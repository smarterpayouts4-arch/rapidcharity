# Google Drive integration

Applicant documents are stored in the RAPID Google Drive (rapidcharity@gmail.com). A service account cannot own files in a personal Gmail Drive, so a small Apps Script web app (`drive-bridge/Code.gs`) runs as the RAPID account and Cloud Functions call it.

## Flow

1. The applicant picks a file. The browser checks it, then sends it to the `uploadScholarshipDocument` function.
2. The function checks ownership, draft status, open cycle, type, size and file signature.
3. It reserves the Firestore record (`uploadStatus: "uploading"`), calls the bridge, then marks it `stored` with the Drive file ID.
4. Staff open files through `getScholarshipDocument`, which streams the bytes. No sharing link is ever created.

Files go to `{root}/{applicationId}/{CODE}-{n}-{key}.{ext}`. There are no names or CNICs in folder or file names.

Retries are safe: the file name is derived from the application, slot and file hash, so the bridge returns the existing file instead of creating a copy. Replaced files are kept and listed in `replacedDriveFileIds`; nothing is deleted.

## Bridge security

The URL is not treated as a secret. Every request is signed with HMAC-SHA256 using a shared secret, and it carries a timestamp (5-minute window) and a single-use nonce. The bridge only writes inside allowlisted root folders. It can only trash files inside test roots, and it forces private sharing on every file.

## Deploying the bridge (rapidcharity account)

1. Create an Apps Script project and paste `Code.gs` and `appsscript.json`.
2. Script properties:
   - `BRIDGE_SECRET`: random, at least 32 characters.
   - `ALLOWED_ROOT_FOLDER_IDS`: the test root now; the production root at cutover.
   - `TEST_ROOT_FOLDER_IDS`: the test root only.
3. Deploy as a web app: execute as me, access anyone. The signature check is what protects it.
4. Set the Functions configuration:
   - Secrets: `DRIVE_BRIDGE_SECRET` (same value as `BRIDGE_SECRET`) and `SCHOLARSHIP_DUPLICATE_HMAC_SECRET` (at least 16 characters).
   - Params: `DRIVE_BRIDGE_URL`, `DRIVE_ROOT_FOLDER_ID`, `STAFF_EMAILS`.

## Folders

- Test root: **RAPID Spring 2027 Test** (`1wEUCIj_AOttFAwu4BxzAYxqPCbsTFH6h`). All demo and test uploads go here.
- Its JIA, RM and IA subfolders are not used, because the form has no scholarship-type field. They can be removed with approval.
- Production root: to be chosen at cutover.

## Local testing

The emulator stack uses `tests/support/fakeDriveBridge.ts`. It applies the same checks as `Code.gs` and keeps files in memory.
