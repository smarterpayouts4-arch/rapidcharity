# Historical archive procedure (Phase 3)

Applicant exports must **not** be committed to Git.

1. Count documents in legacy collections (`applications`, related keys/meta).
2. Export JSON + CSV to an **encrypted location outside the repository**.
3. Manifest historical upload storage references (Drive/Cloudinary paths).
4. Record collection names, counts, backup date, SHA-256 hashes in this repo (no PII).
5. Verify archive record count matches Firestore.
6. Store restoration steps for Oscar-approved recovery only.

Script: `scripts/archive-legacy/` (operator-run; requires service account credentials locally).
