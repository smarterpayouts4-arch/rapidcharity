import { expect, test, type Page } from "@playwright/test";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { completeSections, PDF_BYTES, PNG_BYTES } from "../support/fixtures";
import type { ApplicationSections } from "../../src/types/application";

// Ten acceptance cases against the local emulators and the fake Drive bridge. Fictional data only.

const PROJECT = "demo-rapid-scholarship";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: PROJECT }));

const run = Date.now().toString(36);
const email = (name: string) => `${name}.${run}@example.test`;
let cnicCounter = Number(run.slice(-4).replace(/\D/g, "1").padEnd(4, "1")) * 10;
const nextCnic = () => {
  cnicCounter += 1;
  return `99999-${String(cnicCounter).padStart(7, "0").slice(-7)}-1`;
};

const REQUIRED_SLOTS = ["docApplicantId", "docPhoto", "docAdmissionProof", "docFeeVoucher", "docRecommendation", "docGuardianId"];

async function signIn(page: Page, address: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(address);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  const res = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/oobCodes`);
  const { oobCodes } = (await res.json()) as { oobCodes: { email: string; oobCode: string; requestType: string }[] };
  const code = oobCodes.filter((c) => c.email === address && c.requestType === "EMAIL_SIGNIN").at(-1);
  expect(code, "sign-in email was sent").toBeTruthy();
  await page.goto(`/sign-in/finish?mode=signIn&oobCode=${code!.oobCode}&apiKey=demo-api-key&lang=en`);
  await expect(page.getByText("Signed in as")).toBeVisible();
}

async function startApplication(page: Page): Promise<string> {
  await page.getByRole("button", { name: /Start (an|another) application/ }).click();
  await page.waitForURL(/\/application\/[0-9a-f-]{36}\/s1_about$/);
  return page.url().split("/application/")[1]!.split("/")[0]!;
}

/** Fills answers directly in the emulator (as the app would after many keystrokes) to keep tests short. */
async function prefill(page: Page, applicationId: string, sections: ApplicationSections) {
  await db.doc(`scholarshipApplications/${applicationId}`).update({ sections, updatedAt: Date.now() });
  await page.goto(`/application/${applicationId}/s11_docs`);
  await expect(page.getByRole("heading", { name: "11. Documents" })).toBeVisible();
}

async function uploadIn(page: Page, slot: string, kind: "pdf" | "png" = "pdf", nth = 0) {
  const box = page.locator(`[data-slot="${slot}"]`).nth(nth);
  await box.locator('input[type="file"]').setInputFiles({
    name: kind === "pdf" ? "fictional.pdf" : "fictional.png",
    mimeType: kind === "pdf" ? "application/pdf" : "image/png",
    buffer: kind === "pdf" ? PDF_BYTES : PNG_BYTES,
  });
  await expect(box.getByRole("status")).toContainText("Saved privately", { timeout: 60_000 });
}

async function uploadRequired(page: Page) {
  for (const slot of REQUIRED_SLOTS) await uploadIn(page, slot, slot === "docPhoto" ? "png" : "pdf");
}

async function submitFromReview(page: Page, applicationId: string): Promise<string> {
  await page.goto(`/application/${applicationId}/s12_submit`);
  await expect(page.getByText("Everything required is filled in.")).toBeVisible();
  await page.getByRole("button", { name: "Submit application" }).click();
  await page.waitForURL(`**/submitted/${applicationId}`);
  const receipt = (await page.getByTestId("receipt").textContent())!.trim();
  expect(receipt).toMatch(/^RAPID-2027-[A-Z2-9]{8}$/);
  return receipt;
}

async function next(page: Page) {
  await page.getByRole("button", { name: "Save and continue" }).click();
}

async function pickFromCatalog(page: Page, id: string, typed: string, option: RegExp) {
  await page.locator(`#${id}`).fill(typed);
  await page.getByRole("listbox").getByRole("option", { name: option }).first().click();
}

type DriveFile = { fileId: string; folder: string; name: string };
async function driveFiles(): Promise<DriveFile[]> {
  return (await fetch("http://127.0.0.1:5199/__files")).json() as Promise<DriveFile[]>;
}

test("1. newly admitted student completes the whole form in the browser", async ({ page }) => {
  await signIn(page, email("newstudent"));
  const id = await startApplication(page);

  await page.locator("#firstName").fill("Sana");
  await page.locator("#lastName").fill("Fictional");
  await page.locator("#cnic").fill(nextCnic().replace(/-/g, ""));
  await page.locator("#gender").selectOption("gen_female");
  await page.locator("#religion").selectOption("relig_christian");
  await page.locator("#specialNeeds").selectOption("no");
  await page.locator("#previousRapid").selectOption("no");
  await next(page);

  await page.locator("#mobile").fill("0300-0000123");
  await page.locator("#email").fill(email("newstudent"));
  await page.locator("#addressLine").fill("House 2, Example Road, Test Colony");
  await pickFromCatalog(page, "homeCity", "Lahore", /^Lahore/);
  await expect(page.locator("#homeProvince")).toHaveValue("prov_punjab");
  await next(page);

  await page.locator("#fatherName").fill("Late Fictional Father");
  await page.locator("#fatherOccupation").selectOption("occ_deceased");
  await expect(page.locator("#fatherIncome")).toHaveCount(0);
  await page.locator("#motherName").fill("Fictional Mother");
  await page.locator("#motherOccupation").selectOption("occ_homemaker");
  await page.locator("#motherIncome").fill("0");
  await page.locator("#siblingsCount").fill("2");
  await page.locator("#employment").selectOption("emp_not_employed");
  await next(page);

  await page.locator("#churchName").fill("Example Community Church");
  await page.locator("#pastorName").fill("Pastor Example");
  await next(page);

  await page.locator("#currentLevel").selectOption("lvl_bsng");
  await pickFromCatalog(page, "institutionId", "forman", /Forman Christian College/);
  await pickFromCatalog(page, "programId", "bsn", /BSN Generic/);
  await expect(page.locator("#studySystem")).toHaveValue("sys_semester");
  await page.locator("#admissionTerm").selectOption("term_2027_spring");
  await page.locator("#expectedCompletionTerm").selectOption("term_2030_fall");
  await page.locator("#currentSemester").fill("1");
  await page.locator("#enrolmentStatus").selectOption("es_new");
  await next(page);

  await expect(page.getByText("newly admitted")).toBeVisible();
  await next(page);

  await page.getByRole("button", { name: "Add Matric" }).click();
  const matric = page.locator("fieldset.entry").nth(0);
  await matric.getByRole("combobox", { name: "Group / programme" }).fill("matric sci");
  await page.getByRole("listbox").getByRole("option", { name: /Matric - Science \(Biology\)/ }).click();
  await matric.getByLabel("Board").selectOption("board_bise_lahore");
  await matric.getByLabel("Year passed (or expected)").fill("2021");
  await matric.getByLabel("Result status").selectOption("rs_final");
  await matric.getByLabel("How are your results shown?").selectOption("rf_percentage");
  await matric.getByLabel("Percentage").fill("85");
  await page.getByRole("button", { name: "Add Intermediate" }).click();
  const inter = page.locator("fieldset.entry").nth(1);
  await inter.getByRole("combobox", { name: "Group / programme" }).fill("fsc pre med");
  await page.getByRole("listbox").getByRole("option", { name: /FSc Pre-Medical/ }).click();
  await inter.getByLabel("Board").selectOption("board_bise_lahore");
  await inter.getByLabel("Year passed (or expected)").fill("2023");
  await inter.getByLabel("Result status").selectOption("rs_final");
  await inter.getByLabel("How are your results shown?").selectOption("rf_marks");
  await inter.getByLabel("Marks obtained").fill("900");
  await inter.getByLabel("Total marks").fill("1100");
  await expect(inter.getByText("Percentage (calculated): 81.82%")).toBeVisible();
  await next(page);

  await page.locator("#feeAmount").fill("85000");
  await expect(page.locator("#feeTerm")).toHaveValue("term_2027_spring");
  await page.locator("#otherScholarship").selectOption("ynp_no");
  await next(page);

  await page.locator("#goal").fill("I want to become a nurse and care for families in my town.");
  await page.locator("#communitySupport").fill("I will help at church health camps and teach younger students.");
  await next(page);

  await page.locator("#facultyRefName").fill("Professor Example");
  await page.locator("#familyRefName").fill("Aunt Example");
  await page.locator("#familyRefRelation").selectOption("rel_uncle_aunt");
  await page.locator("#howHeard").selectOption("hh_church_pastor");
  await next(page);

  await uploadRequired(page);
  await expect(page.locator('[data-slot="docDeathCert"]')).toBeVisible();
  await uploadIn(page, "docDeathCert");
  await next(page);

  await page.getByLabel("I confirm the information is true").check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await page.waitForURL(`**/submitted/${id}`);
  await expect(page.getByTestId("receipt")).toHaveText(/^RAPID-2027-[A-Z2-9]{8}$/);

  const stored = (await db.doc(`scholarshipApplications/${id}`).get()).data()!;
  expect(stored.status).toBe("submitted");
  expect(stored.sections.s6_terms.termResults).toEqual([]);
  expect(stored.sections.s3_family.fatherIncome).toBeUndefined();
});

test("2. continuing student adds several results with different formats", async ({ page }) => {
  await signIn(page, email("continuing"));
  const id = await startApplication(page);
  const sections = completeSections({ cnic: nextCnic() });
  sections.s6_terms.termResults = [];
  await prefill(page, id, sections);
  await page.goto(`/application/${id}/s6_terms`);
  await page.getByRole("button", { name: "Add a term" }).click();
  await page.getByRole("button", { name: "Add a term" }).click();
  const [first, second] = [page.locator("fieldset.entry").nth(0), page.locator("fieldset.entry").nth(1)];
  await first.getByLabel("Term").selectOption("term_2025_fall");
  await first.getByLabel("How are your results shown?").selectOption("rf_both");
  await first.getByLabel("Semester GPA (SGPA)").fill("85");
  await next(page);
  await expect(first.getByText(/looks like a percentage/)).toBeVisible();
  await first.getByLabel("Semester GPA (SGPA)").fill("3.4");
  await first.getByLabel("Cumulative GPA (CGPA)").fill("3.4");
  await second.getByLabel("Term").selectOption("term_2026_spring");
  await second.getByLabel("How are your results shown?").selectOption("rf_percentage");
  await second.getByLabel("Percentage").fill("78.5");
  await uploadIn(page, "resultDoc", "pdf", 1);
  await next(page);
  await expect(page).toHaveURL(/s7_prior$/);
  await page.goto(`/application/${id}/s11_docs`);
  await uploadRequired(page);
  await submitFromReview(page, id);
  const stored = (await db.doc(`scholarshipApplications/${id}`).get()).data()!;
  expect(stored.sections.s6_terms.termResults).toHaveLength(2);
  expect(stored.sections.s6_terms.termResults[1].percentage).toBe(78.5);
  expect(stored.sections.s6_terms.termResults[1].sgpa).toBeNull();
});

test("3. institution not in the catalog is typed in and queued for staff", async ({ page }) => {
  await signIn(page, email("manualinst"));
  const id = await startApplication(page);
  await prefill(page, id, completeSections({ cnic: nextCnic() }));
  await page.goto(`/application/${id}/s5_study`);
  await page.locator("#institutionId").fill("zzz example");
  await expect(page.getByText("No match in the list.")).toBeVisible();
  await page.getByRole("button", { name: "Can't find your institution? Enter it manually." }).click();
  await page.locator("#institutionId").fill("Example Nursing School, Testville");
  await expect(page.getByText("RAPID staff will check what you type.")).toBeVisible();
  await next(page);
  await expect(page).toHaveURL(/s6_terms$/);
  await expect(page.getByText("All changes saved.")).toBeVisible();
  await page.goto(`/application/${id}/s11_docs`);
  await uploadRequired(page);
  await submitFromReview(page, id);
  const review = await db.doc(`scholarshipCatalogReview/${id}_institutionId`).get();
  expect(review.get("rawText")).toBe("Example Nursing School, Testville");
  expect((await db.doc(`scholarshipApplications/${id}`).get()).get("needsReview")).toBe(true);
});

test("4. two siblings sharing one email each submit their own application", async ({ page }) => {
  await signIn(page, email("siblings"));
  const first = await startApplication(page);
  await prefill(page, first, completeSections({ cnic: nextCnic(), firstName: "Hina" }));
  await uploadRequired(page);
  await submitFromReview(page, first);
  await page.goto("/");
  const second = await startApplication(page);
  expect(second).not.toBe(first);
  await prefill(page, second, completeSections({ cnic: nextCnic(), firstName: "Imran" }));
  await uploadRequired(page);
  await submitFromReview(page, second);
  await page.goto("/");
  await expect(page.locator(".application-list li")).toHaveCount(2);
  await expect(page.locator(".application-list")).toContainText("Hina");
  await expect(page.locator(".application-list")).toContainText("Imran");
});

test("5. a draft is saved and can be resumed after signing in again", async ({ page, browser }) => {
  const address = email("resume");
  await signIn(page, address);
  const id = await startApplication(page);
  await page.locator("#firstName").fill("Resume");
  await page.locator("#lastName").fill("Tester");
  await expect(page.getByText("All changes saved.")).toBeVisible();
  const other = await browser.newContext();
  const fresh = await other.newPage();
  await signIn(fresh, address);
  await fresh.getByRole("link", { name: "Continue" }).click();
  await expect(fresh).toHaveURL(new RegExp(`/application/${id}/s1_about$`));
  await expect(fresh.locator("#firstName")).toHaveValue("Resume");
  await expect(fresh.locator("#lastName")).toHaveValue("Tester");
  await other.close();
});

test("6. uploads go to the private test folder under an opaque application folder", async ({ page }) => {
  await signIn(page, email("uploads"));
  const id = await startApplication(page);
  await prefill(page, id, completeSections({ cnic: nextCnic(), firstName: "Upload" }));
  await uploadIn(page, "docApplicantId");
  await uploadIn(page, "docApplicantId");
  await page.locator('[data-slot="docPhoto"] input[type="file"]').setInputFiles({ name: "photo.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
  await expect(page.locator('[data-slot="docPhoto"]').getByRole("alert")).toContainText("JPG or PNG");
  const mine = (await driveFiles()).filter((f) => f.folder === `emulator-test-root/INTAKE/${id}`);
  expect(mine).toHaveLength(1);
  expect(mine[0]!.name).toMatch(/^APPLICANT-ID-1-[0-9a-f]{16}\.pdf$/);
  expect(JSON.stringify(mine)).not.toMatch(/Upload|99999/);
  const record = (await db.doc(`scholarshipApplications/${id}/documents/docApplicantId_1`).get()).data()!;
  expect(record).toMatchObject({ uploadStatus: "stored", verificationStatus: "pending" });
  expect(JSON.stringify(record)).not.toMatch(/https?:\/\//);
});

async function submittedApplication(page: Page, who: string) {
  await signIn(page, email(who));
  const id = await startApplication(page);
  await prefill(page, id, completeSections({ cnic: nextCnic(), firstName: "Review" }));
  await uploadRequired(page);
  const receipt = await submitFromReview(page, id);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in to start" })).toBeVisible();
  return { id, receipt };
}

test("7. staff open, verify and reject documents", async ({ page }) => {
  const { receipt } = await submittedApplication(page, "forreview");
  await page.goto("/");
  await signIn(page, "staff@example.test");
  await page.goto("/admin");
  await page.getByRole("button", { name: receipt }).click();
  const id = page.locator('[data-document="docApplicantId_1"]');
  await id.getByRole("button", { name: "View" }).click();
  await expect(id.locator("iframe")).toBeVisible();
  await id.getByRole("button", { name: "Verify" }).click();
  await expect(id.getByTestId("verification")).toHaveText("verified");
  const photo = page.locator('[data-document="docPhoto_1"]');
  await photo.getByRole("button", { name: "View" }).click();
  await expect(photo.locator("img")).toBeVisible();
  await photo.getByRole("button", { name: "Reject" }).click();
  await expect(photo.locator(".error-text")).toContainText("why");
  await photo.getByLabel("Note (required to reject)").fill("Photo is not clear");
  await photo.getByRole("button", { name: "Reject" }).click();
  await expect(photo.getByTestId("verification")).toHaveText("rejected");
});

test("8. staff classify as RIA, documents move in Drive, and export Excel and CSV", async ({ page }) => {
  const { id, receipt } = await submittedApplication(page, "forexport");
  const before = (await driveFiles()).filter((f) => f.folder === `emulator-test-root/INTAKE/${id}`).map((f) => f.fileId).sort();
  expect(before.length).toBeGreaterThan(0);
  await page.goto("/");
  await signIn(page, "staff@example.test");
  await page.goto("/admin");
  await page.getByRole("button", { name: receipt }).click();
  await page.getByLabel("Scholarship type").selectOption("RIA");
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByTestId("filing")).toHaveText("Documents filed in Drive folder RIA.");
  const after = (await driveFiles()).filter((f) => f.folder === `emulator-test-root/RIA/${id}`).map((f) => f.fileId).sort();
  expect(after).toEqual(before);
  await page.getByRole("button", { name: "Back to list" }).click();
  await page.getByLabel("Scholarship type").selectOption("RIA");
  await expect(page.getByRole("row", { name: new RegExp(receipt) })).toContainText("RIA");

  const readDownload = async (button: string) => {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: button }).click();
    const file = await download;
    return Buffer.concat(await (await file.createReadStream()).toArray());
  };
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await readDownload("Export Excel (.xlsx)"));
  expect(book.worksheets.map((w) => w.name)).toEqual(["Applications", "Academic results", "Documents"]);
  const sheet = book.getWorksheet("Applications")!;
  const header = (sheet.getRow(1).values as unknown[]).map(String);
  expect(header).toEqual(expect.arrayContaining(["Scholarship type", "First name"]));
  const rows = Array.from({ length: sheet.rowCount - 1 }, (_, i) => JSON.stringify(sheet.getRow(i + 2).values));
  expect(rows.every((r) => r.includes('"RIA"'))).toBe(true);
  expect(rows.some((r) => r.includes(receipt))).toBe(true);
  expect(book.getWorksheet("Documents")!.rowCount).toBeGreaterThan(1);

  const csv = (await readDownload("Export CSV")).toString("utf8");
  expect(csv.split("\r\n").find((line) => line.includes(receipt))).toContain('"RIA"');
});

test("9. other accounts cannot open an application or the admin area", async ({ page, browser }) => {
  await signIn(page, email("private"));
  const id = await startApplication(page);
  await page.locator("#firstName").fill("Private");
  await expect(page.getByText("All changes saved.")).toBeVisible();
  const other = await browser.newContext();
  const intruder = await other.newPage();
  await signIn(intruder, email("intruder"));
  await intruder.goto(`/application/${id}/s1_about`);
  await expect(intruder.getByText("This application could not be opened.")).toBeVisible();
  await intruder.goto("/admin");
  await expect(intruder.getByText("This account is not on the RAPID staff list.")).toBeVisible();
  await other.close();
});

test("10. the same CNIC cannot be submitted twice", async ({ page, browser }) => {
  const cnic = nextCnic();
  await signIn(page, email("dupfirst"));
  const first = await startApplication(page);
  await prefill(page, first, completeSections({ cnic }));
  await uploadRequired(page);
  await page.goto(`/application/${first}/s12_submit`);
  const submit = page.getByRole("button", { name: "Submit application" });
  await submit.dblclick();
  await page.waitForURL(`**/submitted/${first}`);
  expect((await db.collection("scholarshipDuplicateKeys").where("applicationId", "==", first).get()).size).toBe(1);

  const other = await browser.newContext();
  const second = await other.newPage();
  await signIn(second, email("dupsecond"));
  const dup = await startApplication(second);
  await prefill(second, dup, completeSections({ cnic }));
  await uploadRequired(second);
  await second.goto(`/application/${dup}/s12_submit`);
  await second.getByRole("button", { name: "Submit application" }).click();
  await expect(second.getByRole("alert").last()).toContainText("already been submitted");
  expect((await db.doc(`scholarshipApplications/${dup}`).get()).get("status")).toBe("draft");
  await other.close();
});
