# RAPID Scholarship Application (SPA)

Vite + React + Firebase application for `https://apply.rapidcharity.org`. Documents are stored in the RAPID Google Drive; see `docs/drive-integration.md`.

## Local development

```bash
cd rapid-application
npm install
npm --prefix functions install
npm run catalog:build
npm run emulators   # terminal 1: Auth, Firestore, Functions
npm run dev         # terminal 2: http://localhost:5173
```

Copy `.env.example` to `.env.local` for emulator defaults. The emulators need Java 17+ (firebase-tools 14 is pinned in the scripts).

## Commands

| Command | Purpose |
|--------|---------|
| `npm run dev` | Applicant SPA |
| `npm run emulators` | Firebase Emulator Suite |
| `npm run catalog:build` | Build the searchable catalog bundle |
| `npm run typecheck` | TypeScript (app and functions) |
| `npm test` | Unit tests |
| `npm run test:emulator` | Server and Firestore rules tests on the emulators |
| `npm run test:e2e` | Playwright: the ten acceptance cases on emulators + fake Drive bridge |
| `npm run build` | Production bundle to `dist/` |

On Windows the emulators sometimes leave a Java process on port 8080; stop it before the next run.

## Firebase

Uses the **existing RAPID Firebase project** with a **second Hosting site** target `apply-rapidcharity` (see `.firebaserc`). Do not deploy until cutover approval.

Historical applicant archives belong **outside** this repository (encrypted storage). Git tracks counts, hashes, and restore instructions only.
