import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { completeSections, PDF_BYTES, PNG_BYTES } from "../support/fixtures";
import { API_KEY, PROJECT, getDoc, listDocs, patchDoc, signInCode } from "./live";

// Real-service run against the protected Vercel preview, Firebase project rapid-cc35e and the Drive
// test folder. Fictional applicants and placeholder documents only.

const SHARE = process.env.PREVIEW_SHARE_URL;
const STAFF = process.env.PREVIEW_STAFF_EMAIL ?? "preview-staff@example.test";
const run = Date.now().toString(36);
const email = (who: string) => `preview.${who}.${run}@example.test`;
const cnic = () => `99999-${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}-1`;
const REQUIRED = ["docApplicantId", "docPhoto", "docAdmissionProof", "docFeeVoucher", "docRecommendation", "docGuardianId"];
const TYPES = ["IA", "RIA", "RM"] as const;

const evidence: Record<string, unknown> = { run, startedAt: new Date().toISOString(), project: PROJECT, applications: [] as unknown[], checks: [] as string[] };
const note = (check: string) => (evidence.checks as string[]).push(check);

test.describe.configure({ mode: "serial" });
test.skip(!SHARE, "Set PREVIEW_SHARE_URL to a Vercel share link for the preview.");

async function openPreview(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(SHARE!);
  await expect(page.getByText("RAPID test environment")).toBeVisible();
  return page;
}

async function signIn(page: Page, address: string) {
  const origin = new URL(page.url()).origin;
  const code = await signInCode(address, `${origin}/sign-in/finish`);
  await page.goto(`/sign-in/finish?mode=signIn&oobCode=${code}&apiKey=${API_KEY}&lang=en`);
  await page.locator("#email").fill(address);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Signed in as")).toBeVisible();
}

async function idTokenFor(address: string, origin: string): Promise<string> {
  const code = await signInCode(address, `${origin}/sign-in/finish`);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: address, oobCode: code }),
  });
  return ((await res.json()) as { idToken: string }).idToken;
}

async function uploadIn(page: Page, slot: string) {
  const box = page.locator(`[data-slot="${slot}"]`);
  const png = slot === "docPhoto";
  await box.locator('input[type="file"]').setInputFiles({
    name: png ? "placeholder.png" : "placeholder.pdf",
    mimeType: png ? "image/png" : "application/pdf",
    buffer: png ? PNG_BYTES : PDF_BYTES,
  });
  await expect(box.getByRole("status")).toContainText("Saved privately", { timeout: 120_000 });
}

const apps: { type: (typeof TYPES)[number]; id: string; receipt: string; fileIds: string[] }[] = [];

test("0. the round is open in the test project", async () => {
  await patchDoc("scholarshipCycles/spring-2027", { cycleId: "spring-2027", label: "Spring 2027 (test)", open: true, deadlineAt: null });
  note("cycle spring-2027 open in rapid-cc35e");
});

test("1. three fictional applicants complete, upload to Drive and submit", async ({ browser }) => {
  for (const type of TYPES) {
    const page = await openPreview(browser);
    await signIn(page, email(type.toLowerCase()));
    await page.getByRole("button", { name: /Start (an|another) application/ }).click();
    await page.waitForURL(/\/application\/[0-9a-f-]{36}\/s1_about$/);
    const id = page.url().split("/application/")[1]!.split("/")[0]!;
    await page.locator("#firstName").fill(`Preview${type}`);
    await expect(page.getByText("All changes saved.")).toBeVisible();
    await patchDoc(`scholarshipApplications/${id}`, { sections: completeSections({ cnic: cnic(), firstName: `Preview${type}` }), updatedAt: Date.now() });
    await page.goto(`/application/${id}/s11_docs`);
    for (const slot of REQUIRED) await uploadIn(page, slot);

    // Repeating an upload of the same file must not create a second Drive file.
    const before = (await getDoc(`scholarshipApplications/${id}/documents/docFeeVoucher_1`)).driveFileId;
    await uploadIn(page, "docFeeVoucher");
    expect((await getDoc(`scholarshipApplications/${id}/documents/docFeeVoucher_1`)).driveFileId).toBe(before);

    await page.goto(`/application/${id}/s12_submit`);
    await expect(page.getByText("Everything required is filled in.")).toBeVisible();
    await page.getByRole("button", { name: "Submit application" }).click();
    await page.waitForURL(`**/submitted/${id}`);
    const receipt = (await page.getByTestId("receipt").textContent())!.trim();
    expect(receipt).toMatch(/^RAPID-2027-[A-Z2-9]{8}$/);

    const record = await getDoc(`scholarshipApplications/${id}`);
    expect(record).toMatchObject({ status: "submitted", scholarshipType: null, driveFolder: "INTAKE" });
    const docs = await listDocs(`scholarshipApplications/${id}/documents`);
    expect(docs).toHaveLength(REQUIRED.length);
    for (const d of docs) expect(d).toMatchObject({ uploadStatus: "stored", verificationStatus: "pending" });
    const fileIds = docs.map((d) => String(d.driveFileId)).sort();
    expect(new Set(fileIds).size).toBe(REQUIRED.length);
    apps.push({ type, id, receipt, fileIds });
    await page.context().close();
  }
  note("3 applications submitted; 6 documents each stored in Drive via the bridge; repeat upload reused the same Drive file");
});

test("2. staff classify IA, RIA and RM; documents are refiled; Firebase keeps the file ids", async ({ browser }) => {
  const page = await openPreview(browser);
  await signIn(page, STAFF);
  for (const app of apps) {
    await page.goto("/admin");
    await page.getByRole("button", { name: app.receipt }).click();
    await page.getByLabel("Scholarship type").selectOption(app.type);
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 150_000 });
    await expect(page.getByTestId("filing")).toHaveText(`Documents filed in Drive folder ${app.type}.`);
    const record = await getDoc(`scholarshipApplications/${app.id}`);
    expect(record).toMatchObject({ scholarshipType: app.type, driveFolder: app.type });
    const ids = (await listDocs(`scholarshipApplications/${app.id}/documents`)).map((d) => String(d.driveFileId)).sort();
    expect(ids).toEqual(app.fileIds);
  }
  note("IA, RIA and RM applications classified by staff; driveFolder matches; Drive file ids unchanged");
  await page.context().close();
});

test("3. staff open documents from Drive, verify and reject", async ({ browser }) => {
  const page = await openPreview(browser);
  await signIn(page, STAFF);
  const app = apps[0]!;
  await page.goto("/admin");
  await page.getByRole("button", { name: app.receipt }).click();
  const id = page.locator('[data-document="docApplicantId_1"]');
  await id.getByRole("button", { name: "View" }).click();
  await expect(id.locator("iframe")).toBeVisible({ timeout: 120_000 });
  await id.getByRole("button", { name: "Verify" }).click();
  await expect(id.getByTestId("verification")).toHaveText("verified");
  const photo = page.locator('[data-document="docPhoto_1"]');
  await photo.getByRole("button", { name: "View" }).click();
  await expect(photo.locator("img")).toBeVisible({ timeout: 120_000 });
  await photo.getByLabel("Note (required to reject)").fill("Placeholder photo, test only");
  await photo.getByRole("button", { name: "Reject" }).click();
  await expect(photo.getByTestId("verification")).toHaveText("rejected");
  expect(await getDoc(`scholarshipApplications/${app.id}/documents/docApplicantId_1`)).toMatchObject({ verificationStatus: "verified" });
  note("staff viewed a PDF and an image streamed from Drive; verified one, rejected one with a note");
  await page.context().close();
});

test("4. reclassification moves the folder back and forth without losing or duplicating files", async ({ browser }) => {
  const page = await openPreview(browser);
  await signIn(page, STAFF);
  const app = apps[0]!;
  for (const type of ["RM", "", app.type] as const) {
    await page.goto("/admin");
    await page.getByRole("button", { name: app.receipt }).click();
    await page.getByLabel("Scholarship type").selectOption(type);
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 150_000 });
    const folder = type || "INTAKE";
    await expect(page.getByTestId("filing")).toHaveText(`Documents filed in Drive folder ${folder}.`);
    expect(await getDoc(`scholarshipApplications/${app.id}`)).toMatchObject({ scholarshipType: type || null, driveFolder: folder });
  }
  const ids = (await listDocs(`scholarshipApplications/${app.id}/documents`)).map((d) => String(d.driveFileId)).sort();
  expect(ids).toEqual(app.fileIds);
  const id = page.locator('[data-document="docAdmissionProof_1"]');
  await id.getByRole("button", { name: "View" }).click();
  await expect(id.locator("iframe")).toBeVisible({ timeout: 120_000 });
  note(`reclassified ${app.type} -> RM -> unassigned -> ${app.type}; same file ids; document still opens`);
  await page.context().close();
});

test("5. staff export Excel and CSV filtered by type", async ({ browser }) => {
  const page = await openPreview(browser);
  await signIn(page, STAFF);
  await page.goto("/admin");
  await page.getByLabel("Scholarship type").selectOption("RIA");
  const read = async (button: string) => {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: button }).click();
    return Buffer.concat(await (await (await download).createReadStream()).toArray());
  };
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array(await read("Export Excel (.xlsx)")).buffer);
  expect(book.worksheets.map((w) => w.name)).toEqual(["Applications", "Academic results", "Documents"]);
  const sheet = book.getWorksheet("Applications")!;
  const rows = Array.from({ length: sheet.rowCount - 1 }, (_, i) => JSON.stringify(sheet.getRow(i + 2).values));
  const ria = apps.find((a) => a.type === "RIA")!;
  expect(rows.some((r) => r.includes(ria.receipt))).toBe(true);
  expect(rows.every((r) => r.includes('"RIA"'))).toBe(true);
  expect(JSON.stringify(book.getWorksheet("Documents")!.getSheetValues())).not.toContain(ria.fileIds[0]);
  const csv = (await read("Export CSV")).toString("utf8");
  expect(csv).toContain(ria.receipt);
  fs.mkdirSync(path.resolve("test-results/preview"), { recursive: true });
  await book.xlsx.writeFile(path.resolve(`test-results/preview/export-RIA-${run}.xlsx`));
  note("RIA-filtered .xlsx has Applications / Academic results / Documents sheets, no Drive ids; CSV export works");
  await page.context().close();
});

test("6. other users are blocked", async ({ browser }) => {
  const page = await openPreview(browser);
  const origin = new URL(page.url()).origin;
  const app = apps[0]!;
  expect((await page.request.post("/api/rpc", { data: { op: "setScholarshipType", data: { applicationId: app.id, scholarshipType: "RM" } } })).status()).toBe(401);
  const outsider = email("outsider");
  const token = await idTokenFor(outsider, origin);
  const call = (op: string, data: object) => page.request.post("/api/rpc", { headers: { Authorization: `Bearer ${token}` }, data: { op, data } });
  expect((await call("setScholarshipType", { applicationId: app.id, scholarshipType: "RM" })).status()).toBe(403);
  expect((await call("getScholarshipDocument", { applicationId: app.id, documentId: "docApplicantId_1" })).status()).toBe(403);
  expect((await call("setScholarshipDocumentVerification", { applicationId: app.id, documentId: "docApplicantId_1", decision: "verified" })).status()).toBe(403);
  expect((await call("claimStaffAccess", {})).status()).toBe(403);
  expect((await call("uploadScholarshipDocument", { applicationId: app.id, slot: "docOther", index: 1, label: "x1", dataBase64: PDF_BYTES.toString("base64") })).status()).toBe(403);
  const read = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/scholarshipApplications/${app.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(read.status).toBe(403);
  await signIn(page, outsider);
  await page.goto("/admin");
  await expect(page.getByText("This account is not on the RAPID staff list.")).toBeVisible();
  expect((await getDoc(`scholarshipApplications/${app.id}`)).scholarshipType).toBe(app.type);
  note("anonymous and non-staff callers get 401/403 for classify, view, verify, claim staff and upload; Firestore read denied; /admin refused");
  await page.context().close();
});

test.afterAll(() => {
  evidence.finishedAt = new Date().toISOString();
  evidence.applications = apps.map((a) => ({ type: a.type, applicationId: a.id, receipt: a.receipt, driveFileIds: a.fileIds }));
  fs.mkdirSync(path.resolve("docs/evidence"), { recursive: true });
  fs.writeFileSync(path.resolve(`docs/evidence/preview-run-${run}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
});
