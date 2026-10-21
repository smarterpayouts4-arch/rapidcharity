# Hosting and custom domain (do not run until cutover approval)

1. Firebase Console → Hosting → add site for `apply-rapidcharity`.
2. Connect custom domain `apply.rapidcharity.org` (DNS records from console).
3. Add domain to Firebase Auth authorized domains.
4. Set Functions secrets and params (see `drive-integration.md`).
5. Deploy: `npm run build` then `firebase deploy --only hosting:apply-rapidcharity,firestore,functions`.
6. Verify HTTPS and a controlled test submission.

Same Firebase project as the charity site; isolated Hosting site only.

Firestore rules apply to the whole project: deploying `firestore.rules` replaces every existing rule. Check what the legacy collections still need before deploying.
