// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import { createDraftApplication } from "../../src/lib/application/emptyApplication";

let env: RulesTestEnvironment;
const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-rapid-scholarship",
    firestore: { host, port: Number(port), rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8") },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "scholarshipCycles/spring-2027"), { cycleId: "spring-2027", open: true });
  });
});

const owner = () => env.authenticatedContext("owner-uid", { email: "family@example.test" }).firestore();
const stranger = () => env.authenticatedContext("stranger-uid", { email: "family@example.test" }).firestore();
const staff = () => env.authenticatedContext("staff-uid", { staff: true }).firestore();

async function seedDraft() {
  await assertSucceeds(setDoc(doc(owner(), `scholarshipApplications/${APP_ID}`), createDraftApplication(APP_ID, "owner-uid")));
}

describe("scholarshipApplications", () => {
  it("lets a signed-in applicant create only their own draft", async () => {
    await seedDraft();
    const forged = createDraftApplication("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "owner-uid");
    await assertFails(setDoc(doc(stranger(), `scholarshipApplications/${forged.applicationId}`), forged));
    const submitted = { ...createDraftApplication("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "owner-uid"), status: "submitted" };
    await assertFails(setDoc(doc(owner(), `scholarshipApplications/${submitted.applicationId}`), submitted));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), `scholarshipApplications/${APP_ID}x`), forged));
  });

  it("blocks new drafts when the round is closed", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "scholarshipCycles/spring-2027"), { cycleId: "spring-2027", open: false });
    });
    await assertFails(setDoc(doc(owner(), `scholarshipApplications/${APP_ID}`), createDraftApplication(APP_ID, "owner-uid")));
  });

  it("does not let another account read an application, even with the same email", async () => {
    await seedDraft();
    await assertSucceeds(getDoc(doc(owner(), `scholarshipApplications/${APP_ID}`)));
    await assertFails(getDoc(doc(stranger(), `scholarshipApplications/${APP_ID}`)));
    await assertFails(getDocs(query(collection(stranger(), "scholarshipApplications"), where("ownerUid", "==", "owner-uid"))));
    await assertSucceeds(getDoc(doc(staff(), `scholarshipApplications/${APP_ID}`)));
  });

  it("lets owners edit answers but not mark themselves submitted", async () => {
    await seedDraft();
    const ref = doc(owner(), `scholarshipApplications/${APP_ID}`);
    await assertSucceeds(updateDoc(ref, { "sections.s1_about": { firstName: "Test" }, updatedAt: Date.now() }));
    await assertFails(updateDoc(ref, { status: "submitted" }));
    await assertFails(updateDoc(ref, { receiptCode: "RAPID-2027-FAKE" }));
    await assertFails(updateDoc(ref, { ownerUid: "stranger-uid" }));
    await assertFails(updateDoc(doc(stranger(), `scholarshipApplications/${APP_ID}`), { updatedAt: 1 }));
  });

  it("freezes answers after submission", async () => {
    await seedDraft();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), `scholarshipApplications/${APP_ID}`), { status: "submitted" });
    });
    await assertFails(updateDoc(doc(owner(), `scholarshipApplications/${APP_ID}`), { "sections.s9_essay": {}, updatedAt: 2 }));
  });

  it("keeps scholarship type and Drive filing out of browser writes", async () => {
    const preset = { ...createDraftApplication("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "owner-uid"), scholarshipType: "IA" };
    await assertFails(setDoc(doc(owner(), `scholarshipApplications/${preset.applicationId}`), preset));
    await seedDraft();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), `scholarshipApplications/${APP_ID}`), { status: "submitted" });
    });
    for (const db of [owner(), staff()]) {
      const ref = doc(db, `scholarshipApplications/${APP_ID}`);
      await assertFails(updateDoc(ref, { scholarshipType: "RM" }));
      await assertFails(updateDoc(ref, { driveFolder: "RIA" }));
    }
  });
});

describe("documents and server-only collections", () => {
  it("lets owners and staff read document metadata but nobody write it from the browser", async () => {
    await seedDraft();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `scholarshipApplications/${APP_ID}/documents/docPhoto_1`), { uploadStatus: "stored" });
    });
    const path_ = `scholarshipApplications/${APP_ID}/documents/docPhoto_1`;
    await assertSucceeds(getDoc(doc(owner(), path_)));
    await assertSucceeds(getDoc(doc(staff(), path_)));
    await assertFails(getDoc(doc(stranger(), path_)));
    await assertFails(setDoc(doc(owner(), `scholarshipApplications/${APP_ID}/documents/docApplicantId_1`), { uploadStatus: "stored" }));
    await assertFails(updateDoc(doc(staff(), path_), { verificationStatus: "verified" }));
  });

  it("keeps duplicate keys, audit and legacy collections closed", async () => {
    await assertFails(getDoc(doc(owner(), "scholarshipDuplicateKeys/anything")));
    await assertFails(getDoc(doc(staff(), "scholarshipDuplicateKeys/anything")));
    await assertFails(setDoc(doc(owner(), "scholarshipCatalogReview/x"), { rawText: "x" }));
    await assertFails(getDoc(doc(owner(), "scholarshipAudit/x")));
    await assertSucceeds(getDoc(doc(staff(), "scholarshipAudit/x")));
    await assertFails(setDoc(doc(staff(), "scholarshipAudit/x"), { action: "forged" }));
    await assertFails(setDoc(doc(owner(), "applications/legacy"), { a: 1 }));
  });

  it("lets only staff change the application round", async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), "scholarshipCycles/spring-2027")));
    await assertFails(updateDoc(doc(owner(), "scholarshipCycles/spring-2027"), { open: false }));
    await assertSucceeds(updateDoc(doc(staff(), "scholarshipCycles/spring-2027"), { open: false }));
  });
});
