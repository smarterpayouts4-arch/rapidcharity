# Go-live checklist

## Tested (emulators + fake Drive bridge, fictional data)

- [x] Email-link sign-in, sign-out, resume on another browser
- [x] Owner-only drafts and autosave; other accounts blocked, even with the same email
- [x] All 12 form sections and conditionals; the server re-validates the stored draft
- [x] Catalog typeahead and "Can't find your institution? Enter it manually." with staff review queue
- [x] Uploads: type, size and file-signature checks; retries and repeats do not duplicate files
- [x] Submit: one application per CNIC, same receipt on repeat, siblings may share an email
- [x] Staff: list, detail, view/verify/reject documents, scholarship (JIA/RM/IA) metadata, CSV export, round open/deadline
- [x] Security rules for every collection

## Tested against real Google services

- [x] Drive write access and private sharing in the test folder (direct Drive check, earlier session)
- [ ] Apps Script bridge: signature, replay, allowlist, upload, retry, retrieve, cleanup (`npm run live:drive`)

## Production-ready in the repository (not deployed)

- [x] Code committed in slices; docs current
- [x] Firebase project set to `rapid-cc35e`
- [x] Rules and indexes for the scholarship collections
- [ ] Production web app config (API key, app ID) for the Vite build

## Needs RAPID action

- [ ] Accept Firebase invitation (ofranc1208@gmail.com)
- [ ] Deploy the Apps Script bridge as rapidcharity@gmail.com
- [ ] Upgrade to Blaze and set a budget alert
- [ ] STAFF_EMAILS, cycle dates, consent text, retention period, production Drive folder

## Deployed (only after explicit approval)

- [ ] Functions with secrets
- [ ] Firestore rules and indexes
- [ ] Hosting site and Auth authorized domain
- [ ] DNS for apply.rapidcharity.org
- [ ] Cutover: website `/apply` links to the new app; legacy submissions stopped; encrypted backup taken
