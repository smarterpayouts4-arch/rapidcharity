# Product / technical decisions

## In scope (Oscar, 2026-10-21)

- Applicant form (12 logical sections from spec)
- Firebase Auth, Firestore application data, documents in the RAPID Google Drive
- Staff **verification** only: open application, review unmatched catalog values, verify/reject documents, export

## Explicitly out of scope

- Scoring engine, rankings, committee decisions
- Analytics dashboards
- Extra workflow automation (notifications, multi-stage approvals beyond verify/export)
- AI catalog matching, migration UI, dual-write

- **CNIC** unique per cycle via HMAC key in `scholarshipDuplicateKeys`; **email not unique** (shared family inboxes).
- **Opaque** application IDs; no CNIC or names in Drive folder/file names, document IDs, or logs. This overrides the spec's `Last-First` stored file name.
- **Documents in Google Drive**, not Firebase Storage, through a signed Apps Script bridge (see `drive-integration.md`). Firestore holds metadata only.
- **Scholarship types are exactly IA, RIA and RM.** Applicants do not choose; staff classify submitted applications (`scholarshipType`, null until then) through a server function. Documents start in `INTAKE` and the application folder is moved to the type folder on classification, so file ids never change. Old JIA references are not used in the new system; historical data is not rewritten.
- **One request per upload, 3 MB per file.** Serverless request bodies are capped at 4.5 MB and files travel base64-encoded. Raising the limit would need chunked uploads; RAPID to confirm 3 MB is acceptable.
- **Vercel preview runs the same server code as Cloud Functions** (`functions/src/rpc.ts`), because `rapid-cc35e` is on Spark, which cannot run Cloud Functions.
- **Form Spec** and `fields.json` are reference; security and applicant clarity override conflicting workbook rules.
- **No AI** catalog matching; typeahead scoring from normalized keys and aliases only.
- **Archives** of historical applicants live outside Git; repo stores metadata only.
- **Legacy** Firestore collections get client deny-write at cutover (see `firestore.rules`).
