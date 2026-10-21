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
- **No JIA / RM / IA routing:** the form has no scholarship-type field; all uploads go to one root per cycle.
- **Form Spec** and `fields.json` are reference; security and applicant clarity override conflicting workbook rules.
- **No AI** catalog matching; typeahead scoring from normalized keys and aliases only.
- **Archives** of historical applicants live outside Git; repo stores metadata only.
- **Legacy** Firestore collections get client deny-write at cutover (see `firestore.rules`).
