# Implementation status

Last updated: 2026-10-21

**Scope:** application form, Firebase data, Google Drive documents, staff verification. No scoring, rankings, analytics or extra workflow.

## Built and tested locally (emulators + fake Drive bridge)

| Area | What works | Tests |
|------|-----------|-------|
| Sign-in | Email link; email re-entry on another device | E2E 5, 9 |
| Drafts | Owner-only create/read/update while draft; 800 ms autosave; resume on another browser | `rules.test.ts`, E2E 5 |
| Form | All `fields.json` sections and conditionals (12 sections), shared rules on client and server | `tests/unit/rules.test.ts`, E2E 1–3 |
| Catalog | Typeahead for cities, institutions, programmes; "Can't find your institution? Enter it manually." | `search.test.ts`, E2E 3 |
| Results | Multiple term results, Matric/Inter/other prior education, marks → percentage shown, no grade conversion | unit, E2E 1–2 |
| Documents | Server-side upload via Functions → Drive bridge; type/size/magic-byte checks; opaque folder `root/{applicationId}`; retry and duplicate safe | `server.test.ts`, E2E 6 |
| Submit | Server validates the stored draft; CNIC duplicate key in one transaction; idempotent receipt `RAPID-2027-XXXXXXXX` | `server.test.ts`, E2E 10 |
| Admin | Staff claim from allowlist; list, detail, view/verify/reject documents, typed-in answers queue, CSV export, open/deadline | `server.test.ts`, E2E 7–8 |
| Scholarship | Staff classify IA / RIA / RM (or unassigned); Drive folder moves INTAKE ↔ type folder; filter and export by type | `server.test.ts`, `rules.test.ts`, E2E 8, preview tests |
| Export | `.xlsx` (Applications, Academic results, Documents) and CSV, filtered by round and type, formula-safe, no Drive ids | `documents.test.ts`, E2E 8, preview test 5 |

Latest runs: typecheck clean; unit 34/34; emulator integration + rules 27/27; Playwright 10/10.

## Not done yet (needs RAPID access or a decision)

- **RAPID Firebase project:** `rapid-cc35e`, new and separate from the website's project, used as the test project. Web app, Firestore (nam5), email-link Auth and the Firestore rules are set up. On Spark, so the server code runs on the Vercel preview (`preview-environment.md`).
- **Drive bridge deployment:** `drive-bridge/Code.gs` must be deployed by the rapidcharity Google account. See `drive-integration.md`.
- **Real Drive upload through Functions:** not run yet; it depends on the two items above. Drive write access to the test folder was verified separately.
- **Live bridge test:** `npm run live:drive` is ready; it runs once the bridge is deployed.
- **Policy values:** Spring 2027 dates, privacy/consent copy, retention period, staff email list.

## Not deployed

Nothing is deployed. No DNS, production rules, legacy code or legacy data has been changed.
