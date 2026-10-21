// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { handleGetDocument, handleSetVerification, handleUpload } from "../../functions/src/documents";
import { handleSubmit } from "../../functions/src/submitApplication";
import { httpDriveBridge, signBridgeRequest, type DriveBridge } from "../../functions/src/driveBridge";
import { createDraftApplication } from "../../src/lib/application/emptyApplication";
import type { ApplicationSections, DocumentRecord } from "../../src/types/application";
import { createFakeDriveBridge } from "../support/fakeDriveBridge";
import { completeSections, ENTRY_IDS, PDF_BYTES, PNG_BYTES, TEXT_BYTES } from "../support/fixtures";

const PROJECT = "demo-rapid-scholarship";
const ROOT = "test-root-folder";
const SECRET = "integration-bridge-secret-0123456789abcdef";
const DUP_SECRET = "integration-duplicate-secret-0123456789";
const OWNER = { uid: "applicant-1", staff: false };
const OTHER = { uid: "applicant-2", staff: false };
const STAFF = { uid: "staff-1", staff: true };

let app: App;
let db: Firestore;
let bridge: DriveBridge;
let bridgeUrl = "";
const fake = createFakeDriveBridge({ secret: SECRET, allowedRoots: [ROOT] });

const REQUIRED = ["docApplicantId", "docPhoto", "docAdmissionProof", "docFeeVoucher", "docRecommendation", "docGuardianId"] as const;

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
}

async function seedCycle(open = true, deadlineAt: string | null = null) {
  await db.collection("scholarshipCycles").doc("spring-2027").set({ cycleId: "spring-2027", label: "Spring 2027", open, deadlineAt });
}

async function seedApplication(ownerUid: string, sections: ApplicationSections = completeSections()) {
  const draft = createDraftApplication(crypto.randomUUID(), ownerUid);
  draft.sections = sections;
  await db.collection("scholarshipApplications").doc(draft.applicationId).set(draft);
  return draft.applicationId;
}

function upload(applicationId: string, slot: string, bytes: Buffer, extra: object = {}, actor = OWNER) {
  return handleUpload(db, bridge, ROOT, actor, { applicationId, slot, index: 1, dataBase64: bytes.toString("base64"), ...extra });
}

async function uploadRequired(applicationId: string) {
  for (const slot of REQUIRED) await upload(applicationId, slot, slot === "docPhoto" ? PNG_BYTES : PDF_BYTES);
}

async function docRecord(applicationId: string, documentId: string) {
  return (await db.doc(`scholarshipApplications/${applicationId}/documents/${documentId}`).get()).data() as DocumentRecord | undefined;
}

beforeAll(async () => {
  app = initializeApp({ projectId: PROJECT }, "integration");
  db = getFirestore(app);
  bridgeUrl = await fake.listen();
  bridge = httpDriveBridge({ url: bridgeUrl, secret: SECRET });
});

afterAll(async () => {
  await fake.close();
});

beforeEach(async () => {
  await clearFirestore();
  fake.files.length = 0;
  fake.state.failNextUploads = 0;
  await seedCycle();
});

describe("Drive bridge protocol", () => {
  const post = async (body: string) =>
    (await fetch(bridgeUrl, { method: "POST", body, headers: { "Content-Type": "application/json" } })).json();
  const params = { rootFolderId: ROOT, applicationId: "x", fileId: "y" };

  it("rejects requests signed with another key, replays and folders outside the allowed roots", async () => {
    expect(await post(signBridgeRequest("wrong-secret-wrong-secret-wrong-secret", "fetch", params))).toMatchObject({ error: "bad-signature" });
    expect(await post(JSON.stringify({ payload: "{}", sig: "" }))).toMatchObject({ error: "bad-signature" });
    const good = signBridgeRequest(SECRET, "fetch", params);
    expect(await post(good)).toMatchObject({ error: "not-found" });
    expect(await post(good)).toMatchObject({ error: "replayed" });
    expect(await post(signBridgeRequest(SECRET, "fetch", { ...params, rootFolderId: "production-root" }))).toMatchObject({ error: "root-not-allowed" });
    expect(await post(signBridgeRequest(SECRET, "fetch", params, Date.now() - 10 * 60 * 1000))).toMatchObject({ error: "expired" });
  });
});

describe("document upload", () => {
  it("stores a fictional document privately and records Drive metadata", async () => {
    const id = await seedApplication(OWNER.uid);
    const result = await upload(id, "docApplicantId", PDF_BYTES);
    expect(result).toMatchObject({ documentId: "docApplicantId_1", uploadStatus: "stored", alreadyStored: false });
    const record = await docRecord(id, "docApplicantId_1");
    expect(record).toMatchObject({ applicationId: id, slot: "docApplicantId", uploadStatus: "stored", verificationStatus: "pending", contentType: "application/pdf" });
    expect(record?.driveFileId).toMatch(/^fake_/);
    expect(fake.files).toHaveLength(1);
    expect(fake.files[0]!.folder).toBe(`${ROOT}/${id}`);
    expect(fake.files[0]!.name).toMatch(/^APPLICANT-ID-1-[0-9a-f]{16}\.pdf$/);
    expect(JSON.stringify(record)).not.toMatch(/Ayesha|99999/);
  });

  it("repeating the same upload does not create a second Drive file", async () => {
    const id = await seedApplication(OWNER.uid);
    await upload(id, "docFeeVoucher", PDF_BYTES);
    const again = await upload(id, "docFeeVoucher", PDF_BYTES);
    expect(again.alreadyStored).toBe(true);
    expect(fake.files).toHaveLength(1);
  });

  it("recovers when Drive is down: the failed attempt is recorded and a retry completes it", async () => {
    const id = await seedApplication(OWNER.uid);
    fake.state.failNextUploads = 1;
    await expect(upload(id, "docRecommendation", PDF_BYTES)).rejects.toMatchObject({ code: "unavailable" });
    expect((await docRecord(id, "docRecommendation_1"))?.uploadStatus).toBe("uploading");
    expect(fake.files).toHaveLength(0);
    await upload(id, "docRecommendation", PDF_BYTES);
    expect((await docRecord(id, "docRecommendation_1"))?.uploadStatus).toBe("stored");
    expect(fake.files).toHaveLength(1);
  });

  it("recovers when Drive saved the file but Firestore was not updated", async () => {
    const id = await seedApplication(OWNER.uid);
    fake.state.failNextUploads = 0;
    await upload(id, "docGuardianId", PDF_BYTES);
    const first = await docRecord(id, "docGuardianId_1");
    await db.doc(`scholarshipApplications/${id}/documents/docGuardianId_1`).update({ uploadStatus: "uploading", driveFileId: null });
    const retry = await upload(id, "docGuardianId", PDF_BYTES);
    expect(retry.alreadyStored).toBe(true);
    expect(fake.files).toHaveLength(1);
    expect((await docRecord(id, "docGuardianId_1"))?.driveFileId).toBe(first?.driveFileId);
  });

  it("keeps the previous Drive file id when a document is replaced", async () => {
    const id = await seedApplication(OWNER.uid);
    await upload(id, "docPhoto", PNG_BYTES);
    const before = await docRecord(id, "docPhoto_1");
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("fictional jpeg body")]);
    await upload(id, "docPhoto", jpeg);
    const after = await docRecord(id, "docPhoto_1");
    expect(after?.driveFileId).not.toBe(before?.driveFileId);
    expect(after?.replacedDriveFileIds).toEqual([before?.driveFileId]);
  });

  it("rejects wrong owners, fake file types and wrong types for photos", async () => {
    const id = await seedApplication(OWNER.uid);
    await expect(upload(id, "docApplicantId", PDF_BYTES, {}, OTHER)).rejects.toMatchObject({ code: "permission-denied" });
    await expect(upload(id, "docApplicantId", TEXT_BYTES)).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(upload(id, "docPhoto", PDF_BYTES)).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(upload(id, "docOther", PDF_BYTES)).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(upload(id, "docNotAThing", PDF_BYTES)).rejects.toMatchObject({ code: "invalid-argument" });
    expect(fake.files).toHaveLength(0);
  });

  it("attaches a result document only to an existing result entry", async () => {
    const id = await seedApplication(OWNER.uid);
    await upload(id, "resultDoc", PDF_BYTES, { entryId: ENTRY_IDS.term1 });
    expect((await docRecord(id, `resultDoc_${ENTRY_IDS.term1}`))?.uploadStatus).toBe("stored");
    await expect(upload(id, "resultDoc", PDF_BYTES, { entryId: "99999999-9999-4999-8999-999999999999" })).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("blocks uploads when the round is closed", async () => {
    const id = await seedApplication(OWNER.uid);
    await seedCycle(false);
    await expect(upload(id, "docApplicantId", PDF_BYTES)).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

describe("submit", () => {
  it("rejects an incomplete application and lists what is missing", async () => {
    const sections = completeSections();
    sections.s9_essay.goal = "too short";
    const id = await seedApplication(OWNER.uid, sections);
    const err = await handleSubmit(db, OWNER, { applicationId: id }, DUP_SECRET).catch((e) => e);
    expect(err.code).toBe("failed-precondition");
    const keys = (err.details as { key: string }[]).map((d) => d.key);
    expect(keys).toContain("goal");
    expect(keys).toContain("docApplicantId");
  });

  it("submits once, returns the same receipt on retry, and normalises contact details", async () => {
    const id = await seedApplication(OWNER.uid);
    await uploadRequired(id);
    const first = await handleSubmit(db, OWNER, { applicationId: id }, DUP_SECRET);
    expect(first.receiptCode).toMatch(/^RAPID-2027-[A-Z2-9]{8}$/);
    const again = await handleSubmit(db, OWNER, { applicationId: id }, DUP_SECRET);
    expect(again).toMatchObject({ receiptCode: first.receiptCode, alreadySubmitted: true });
    const stored = (await db.doc(`scholarshipApplications/${id}`).get()).data()!;
    expect(stored.status).toBe("submitted");
    expect(stored.sections.s2_contact.email).toBe("family.test@example.test");
    expect(stored.sections.s2_contact.mobile).toBe("+923000000001");
    expect((await db.collection("scholarshipDuplicateKeys").get()).size).toBe(1);
    await expect(upload(id, "docIncomeProof", PDF_BYTES)).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("blocks a second application with the same CNIC, even from another account", async () => {
    const a = await seedApplication(OWNER.uid);
    await uploadRequired(a);
    await handleSubmit(db, OWNER, { applicationId: a }, DUP_SECRET);
    const b = await seedApplication(OTHER.uid);
    for (const slot of REQUIRED) await upload(b, slot, slot === "docPhoto" ? PNG_BYTES : PDF_BYTES, {}, OTHER);
    await expect(handleSubmit(db, OTHER, { applicationId: b }, DUP_SECRET)).rejects.toMatchObject({ code: "already-exists" });
  });

  it("lets two siblings sharing one email submit separate applications", async () => {
    const first = await seedApplication(OWNER.uid, completeSections({ cnic: "99999-0000001-1", firstName: "Ayesha" }));
    const second = await seedApplication(OWNER.uid, completeSections({ cnic: "99999-0000002-2", firstName: "Bilal" }));
    await uploadRequired(first);
    await uploadRequired(second);
    const r1 = await handleSubmit(db, OWNER, { applicationId: first }, DUP_SECRET);
    const r2 = await handleSubmit(db, OWNER, { applicationId: second }, DUP_SECRET);
    expect(r1.receiptCode).not.toBe(r2.receiptCode);
    expect((await db.collection("scholarshipDuplicateKeys").get()).size).toBe(2);
  });

  it("does not let another account submit someone else's application", async () => {
    const id = await seedApplication(OWNER.uid);
    await expect(handleSubmit(db, OTHER, { applicationId: id }, DUP_SECRET)).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("queues typed-in institutions for staff review exactly once", async () => {
    const sections = completeSections({ enrolment: "es_new" });
    sections.s5_study.institutionId = { id: null, labelSnapshot: null, rawText: "Example Nursing School", source: "other", reviewStatus: "pending" };
    const id = await seedApplication(OWNER.uid, sections);
    await uploadRequired(id);
    await handleSubmit(db, OWNER, { applicationId: id }, DUP_SECRET);
    await handleSubmit(db, OWNER, { applicationId: id }, DUP_SECRET);
    const queue = await db.collection("scholarshipCatalogReview").get();
    expect(queue.docs.map((d) => d.id)).toEqual([`${id}_institutionId`]);
    expect((await db.doc(`scholarshipApplications/${id}`).get()).get("needsReview")).toBe(true);
  });

  it("refuses submissions after the deadline", async () => {
    const id = await seedApplication(OWNER.uid);
    await uploadRequired(id);
    await seedCycle(true, "2026-01-01T00:00:00+05:00");
    await expect(handleSubmit(db, OWNER, { applicationId: id }, DUP_SECRET)).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

describe("staff document review", () => {
  async function submitted() {
    const id = await seedApplication(OWNER.uid);
    await uploadRequired(id);
    await handleSubmit(db, OWNER, { applicationId: id }, DUP_SECRET);
    return id;
  }

  it("lets staff open, verify and reject documents, with an audit trail", async () => {
    const id = await submitted();
    const file = await handleGetDocument(db, bridge, ROOT, STAFF, { applicationId: id, documentId: "docApplicantId_1" });
    expect(Buffer.from(file.dataBase64, "base64").equals(PDF_BYTES)).toBe(true);
    await handleSetVerification(db, STAFF, { applicationId: id, documentId: "docApplicantId_1", decision: "verified" });
    await expect(handleSetVerification(db, STAFF, { applicationId: id, documentId: "docPhoto_1", decision: "rejected" })).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await handleSetVerification(db, STAFF, { applicationId: id, documentId: "docPhoto_1", decision: "rejected", note: "Photo is blurred" });
    expect((await docRecord(id, "docApplicantId_1"))?.verificationStatus).toBe("verified");
    expect(await docRecord(id, "docPhoto_1")).toMatchObject({ verificationStatus: "rejected", verificationNote: "Photo is blurred", verifiedBy: STAFF.uid });
    const actions = (await db.collection("scholarshipAudit").where("applicationId", "==", id).get()).docs.map((d) => d.get("action"));
    expect(actions).toEqual(expect.arrayContaining(["document.viewed", "document.verified", "document.rejected", "application.submitted"]));
  });

  it("does not let applicants open or verify documents through staff functions", async () => {
    const id = await submitted();
    await expect(handleGetDocument(db, bridge, ROOT, OWNER, { applicationId: id, documentId: "docApplicantId_1" })).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(handleSetVerification(db, OWNER, { applicationId: id, documentId: "docApplicantId_1", decision: "verified" })).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
});
