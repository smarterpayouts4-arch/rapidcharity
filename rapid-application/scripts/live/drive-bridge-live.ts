/**
 * Live check of the real Apps Script Drive bridge, using the same server code as Cloud Functions.
 * Firestore runs in the emulator; files go to the real RAPID Spring 2027 Test folder.
 *
 *   npm run live:drive           upload, retry, retrieve and authorization checks (keeps the files)
 *   npm run live:drive:cleanup   trash the files (and their empty folder) created by the last run
 *
 * Reads BRIDGE_SECRET and DRIVE_BRIDGE_URL from functions/.secret.live.local (git-ignored).
 * Never prints the secret or the bridge URL. Fictional data only.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { handleSetScholarshipType } from "../../functions/src/classify";
import { handleGetDocument, handleUpload } from "../../functions/src/documents";
import { httpDriveBridge, signBridgeRequest } from "../../functions/src/driveBridge";
import { handleSubmit } from "../../functions/src/submitApplication";
import { createDraftApplication } from "../../src/lib/application/emptyApplication";
import type { DocumentRecord } from "../../src/types/application";
import { completeSections, PDF_BYTES, PNG_BYTES, TEXT_BYTES } from "../../tests/support/fixtures";

const TEST_ROOT = "1wEUCIj_AOttFAwu4BxzAYxqPCbsTFH6h";
const EVIDENCE = "docs/evidence/live-drive-check.json";
const DUP_SECRET = process.env.SCHOLARSHIP_DUPLICATE_HMAC_SECRET ?? "live-drive-duplicate-secret-local-only";

const settings = Object.fromEntries(
  readFileSync("functions/.secret.live.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const secret = settings.BRIDGE_SECRET ?? "";
const url = settings.DRIVE_BRIDGE_URL ?? "";
if (secret.length < 32 || !url.startsWith("https://script.google.com/")) {
  console.error("functions/.secret.live.local needs BRIDGE_SECRET (32+ chars) and the deployed DRIVE_BRIDGE_URL.");
  process.exit(2);
}
const bridge = httpDriveBridge({ url, secret });

type Result = { check: string; ok: boolean; detail?: string };
const results: Result[] = [];
function record(check: string, ok: boolean, detail?: string) {
  results.push({ check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${check}${detail ? ` (${detail})` : ""}`);
}
async function raw(body: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(url, { method: "POST", body, headers: { "Content-Type": "application/json" }, redirect: "follow" });
  return (await res.json()) as { ok?: boolean; error?: string };
}
async function expectError(check: string, promise: Promise<unknown>, code: string) {
  try {
    await promise;
    record(check, false, "no error");
  } catch (err) {
    const got = (err as { code?: string }).code ?? (err as Error).message;
    record(check, got === code, got);
  }
}
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

async function cleanup() {
  const evidence = JSON.parse(readFileSync(EVIDENCE, "utf8")) as { applicationId: string; driveFileIds: string[] };
  for (const fileId of evidence.driveFileIds) {
    const res = await raw(signBridgeRequest(secret, "trash", { rootFolderId: TEST_ROOT, applicationId: evidence.applicationId, fileId }));
    console.log(`${res.ok ? "trashed" : `could not trash (${res.error})`} ${fileId}`);
  }
}

async function main() {
  if (process.argv.includes("cleanup")) return cleanup();

  const ping = await raw(signBridgeRequest(secret, "ping", {}));
  record("bridge answers a correctly signed request", ping.ok === true, ping.error);
  const probe = { rootFolderId: TEST_ROOT, applicationId: randomUUID(), fileId: "x".repeat(20) };
  record("wrong signing key is rejected", (await raw(signBridgeRequest("w".repeat(40), "fetch", probe))).error === "bad-signature");
  record("unsigned request is rejected", (await raw(JSON.stringify({ payload: "{}", sig: "" }))).error === "bad-signature");
  record("expired request is rejected", (await raw(signBridgeRequest(secret, "fetch", probe, Date.now() - 10 * 60 * 1000))).error === "expired");
  const once = signBridgeRequest(secret, "fetch", probe);
  await raw(once);
  record("replayed request is rejected", (await raw(once)).error === "replayed");
  record(
    "folder outside the allowlist is rejected",
    (await raw(signBridgeRequest(secret, "fetch", { ...probe, rootFolderId: "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }))).error === "root-not-allowed",
  );

  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  const db = getFirestore(initializeApp({ projectId: "demo-rapid-scholarship" }, "live"));
  await db.collection("scholarshipCycles").doc("spring-2027").set({ cycleId: "spring-2027", label: "Spring 2027", open: true, deadlineAt: null });
  const owner = { uid: `live-owner-${randomUUID()}`, staff: false };
  const other = { uid: `live-other-${randomUUID()}`, staff: false };
  const staff = { uid: `live-staff-${randomUUID()}`, staff: true };
  const draft = createDraftApplication(randomUUID(), owner.uid);
  draft.sections = completeSections();
  await db.collection("scholarshipApplications").doc(draft.applicationId).set(draft);
  const appId = draft.applicationId;
  const upload = (slot: string, bytes: Buffer, actor = owner) =>
    handleUpload(db, bridge, TEST_ROOT, actor, { applicationId: appId, slot, index: 1, dataBase64: bytes.toString("base64") });
  const docRef = (id: string) => db.doc(`scholarshipApplications/${appId}/documents/${id}`);

  const first = await upload("docApplicantId", PDF_BYTES);
  const pdfRecord = (await docRef("docApplicantId_1").get()).data() as DocumentRecord;
  record("PDF upload stored in Drive", first.uploadStatus === "stored" && !!pdfRecord.driveFileId, pdfRecord.driveFileId ?? "");
  const again = await upload("docApplicantId", PDF_BYTES);
  const againRecord = (await docRef("docApplicantId_1").get()).data() as DocumentRecord;
  record("repeating the same upload does not create a second file", again.alreadyStored && againRecord.driveFileId === pdfRecord.driveFileId);

  await upload("docPhoto", PNG_BYTES);
  const pngRecord = (await docRef("docPhoto_1").get()).data() as DocumentRecord;
  await docRef("docPhoto_1").update({ uploadStatus: "uploading" });
  const retry = await upload("docPhoto", PNG_BYTES);
  const retried = (await docRef("docPhoto_1").get()).data() as DocumentRecord;
  record(
    "Drive succeeded but Firestore did not finish: retry reuses the same Drive file",
    retry.uploadStatus === "stored" && retried.uploadStatus === "stored" && retried.driveFileId === pngRecord.driveFileId,
  );

  await expectError("text file disguised as a document is rejected before Drive", upload("docFeeVoucher", TEXT_BYTES), "invalid-argument");
  await expectError("another applicant cannot upload to this application", upload("docFeeVoucher", PDF_BYTES, other), "permission-denied");

  const fetched = await handleGetDocument(db, bridge, TEST_ROOT, staff, { applicationId: appId, documentId: "docApplicantId_1" });
  const fetchedBytes = Buffer.from(fetched.dataBase64, "base64");
  record("staff retrieve returns the identical file", sha(fetchedBytes) === pdfRecord.sha256 && fetched.contentType === "application/pdf");
  record("Firestore metadata matches the Drive file", pdfRecord.sizeBytes === fetchedBytes.length && pdfRecord.contentType === fetched.contentType);
  await expectError(
    "non-staff cannot retrieve documents",
    handleGetDocument(db, bridge, TEST_ROOT, owner, { applicationId: appId, documentId: "docApplicantId_1" }),
    "permission-denied",
  );
  const foreign = await raw(
    signBridgeRequest(secret, "fetch", { rootFolderId: TEST_ROOT, applicationId: randomUUID(), fileId: pdfRecord.driveFileId }),
  );
  record("a file cannot be fetched through another application's folder", foreign.error === "not-found", foreign.error);

  for (const slot of ["docAdmissionProof", "docFeeVoucher", "docRecommendation", "docGuardianId"] as const) {
    await upload(slot, PDF_BYTES);
  }
  await handleSubmit(db, owner, { applicationId: appId }, DUP_SECRET);
  const submitted = (await db.collection("scholarshipApplications").doc(appId).get()).data()!;
  record("application submitted before classification", submitted.status === "submitted", String(submitted.status));

  const idsBefore = [pdfRecord.driveFileId, pngRecord.driveFileId].sort();
  for (const type of ["IA", "RIA", "RM"] as const) {
    const out = await handleSetScholarshipType(db, bridge, TEST_ROOT, staff, { applicationId: appId, scholarshipType: type });
    record(`staff classify as ${type} updates Firestore and Drive`, out.scholarshipType === type && out.driveFolder === type);
    const meta = (await db.collection("scholarshipApplications").doc(appId).get()).data()!;
    record(`Firestore driveFolder is ${type} after classify`, meta.driveFolder === type);
    const moved = await bridge.file({ rootFolderId: TEST_ROOT, applicationId: appId, folder: type });
    record(`classify ${type} is idempotent on Drive`, moved.moved === false);
    const afterFetch = await handleGetDocument(db, bridge, TEST_ROOT, staff, { applicationId: appId, documentId: "docApplicantId_1" });
    record(`documents still retrievable after filing in ${type}`, sha(Buffer.from(afterFetch.dataBase64, "base64")) === pdfRecord.sha256);
  }
  const idsAfter = (
    await Promise.all(
      ["docApplicantId_1", "docPhoto_1"].map(async (id) => ((await docRef(id).get()).data() as DocumentRecord).driveFileId),
    )
  ).sort();
  record("classification does not change Drive file ids", JSON.stringify(idsBefore) === JSON.stringify(idsAfter));

  await handleSetScholarshipType(db, bridge, TEST_ROOT, staff, { applicationId: appId, scholarshipType: null });
  const back = (await db.collection("scholarshipApplications").doc(appId).get()).data()!;
  record("unassign moves folder back to INTAKE", back.scholarshipType === null && back.driveFolder === "INTAKE");

  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync(
    EVIDENCE,
    `${JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        environment: "real Apps Script bridge + real Drive test folder; Firestore emulator",
        testRootFolder: "RAPID Spring 2027 Test",
        applicationId: appId,
        driveFileIds: idsAfter,
        results,
      },
      null,
      2,
    )}\n`,
  );
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed. Evidence: ${EVIDENCE}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error("Live check stopped:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
