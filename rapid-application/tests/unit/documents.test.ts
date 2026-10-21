import { describe, expect, it } from "vitest";
import { checkFile, documentId, parseDocumentId, sniffMime } from "@/lib/form/documents";
import { buildExport, safeText, toCsv, toXlsx } from "@/features/admin/export";
import { PDF_BYTES, PNG_BYTES, TEXT_BYTES } from "../support/fixtures";

describe("file checks", () => {
  it("identifies files by content, not by name", () => {
    expect(sniffMime(PDF_BYTES)).toBe("application/pdf");
    expect(sniffMime(PNG_BYTES)).toBe("image/png");
    expect(sniffMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(TEXT_BYTES)).toBeNull();
  });
  it("enforces type and size per document", () => {
    expect(checkFile("docApplicantId", PDF_BYTES)).toEqual({ ok: true, mime: "application/pdf" });
    expect(checkFile("docPhoto", PDF_BYTES).ok).toBe(false);
    expect(checkFile("docPhoto", PNG_BYTES).ok).toBe(true);
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(PNG_BYTES);
    expect(checkFile("docPhoto", big).ok).toBe(false);
    expect(checkFile("docApplicantId", new Uint8Array()).ok).toBe(false);
  });
});

describe("document ids", () => {
  it("round-trips and contains no personal data", () => {
    const entry = "11111111-1111-4111-8111-111111111111";
    expect(parseDocumentId(documentId("resultDoc", 1, entry))).toEqual({ slot: "resultDoc", index: 1, entryId: entry });
    expect(parseDocumentId(documentId("docOther", 3))).toEqual({ slot: "docOther", index: 3 });
    expect(parseDocumentId("docPhoto_2")).toBeNull();
    expect(parseDocumentId("../etc")).toBeNull();
  });
});

function exportApp(over: Record<string, unknown>) {
  return {
    applicationId: "a",
    cycleId: "spring-2027",
    status: "submitted",
    receiptCode: "RAPID-2027-TEST",
    submittedAt: 0,
    needsReview: false,
    scholarshipType: "RIA",
    driveFolder: "RIA",
    sections: {
      s1_about: { firstName: "=cmd|' /C calc'!A0", religion: "other", religionOther: "Typed faith" },
      s2_contact: {},
      s3_family: {},
      s4_church: {},
      s5_study: { institutionId: { id: null, labelSnapshot: null, rawText: "My College", source: "other", reviewStatus: "pending" } },
      s6_terms: { termResults: [{ id: "t1", term: "term_1", resultFormat: "rf_gpa", resultFormatOther: "", gpaScale: "gs_4", gpaScaleOther: null, sgpa: 3.5, cgpa: 3.4, percentage: null, marksObtained: null, marksTotal: null, gradeScheme: "", letterGrade: "", letterGradeOther: "", division: "", divisionOther: "", passFail: "", passFailOther: "" }] },
      s7_prior: { priorEducation: [] },
      s8_fees: {},
      s9_essay: {},
      s10_refs: {},
      s11_docs: {},
      s12_submit: {},
    },
    ...over,
  } as never;
}

describe("spreadsheet export", () => {
  const docs = [[{ label: "Recent photo", index: 1, slot: "docPhoto", uploadStatus: "stored", verificationStatus: "verified", verificationNote: "", uploadedAt: 0, verifiedAt: 0, driveFileId: "SECRET-DRIVE-ID" } as never]];

  it("builds applications, results and documents sheets", () => {
    const [apps, results, documents] = buildExport([exportApp({})], docs, new Map([["term_1", "Term 1"]]));
    expect(apps!.name).toBe("Applications");
    expect(apps!.rows[0]).toContain("RIA");
    expect(results!.rows).toHaveLength(1);
    expect(results!.rows[0]).toContain("Term 1");
    expect(results!.rows[0]).toContain(3.5);
    expect(documents!.rows[0]).toContain("verified");
    expect(JSON.stringify([apps, results, documents])).not.toContain("SECRET-DRIVE-ID");
  });

  it("keeps the standard value and the applicant's own wording", () => {
    const [apps] = buildExport([exportApp({})], docs, new Map());
    const col = (title: string) => apps!.rows[0]![apps!.header.indexOf(title)];
    expect(apps!.header).toContain("Religion (as typed)");
    expect(col("Religion")).toBe("Other");
    expect(col("Religion (as typed)")).toBe("Typed faith");
  });

  it("neutralises spreadsheet formulas", () => {
    expect(safeText("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(safeText("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(safeText("Plain")).toBe("Plain");
    const csv = toCsv(buildExport([exportApp({})], docs, new Map())[0]!);
    expect(csv).toContain(`"'=cmd|' /C calc'!A0"`);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("writes an .xlsx workbook that reads back", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const buffer = await toXlsx(buildExport([exportApp({}), exportApp({ applicationId: "b", scholarshipType: null })], docs, new Map()));
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer);
    expect(book.worksheets.map((w) => w.name)).toEqual(["Applications", "Academic results", "Documents"]);
    const sheet = book.getWorksheet("Applications")!;
    expect(sheet.rowCount).toBe(3);
    const values = JSON.stringify(sheet.getRow(3).values);
    expect(values).toContain("Unassigned");
    expect(sheet.getRow(2).getCell(9).type).not.toBe(ExcelJS.ValueType.Formula);
  });
});
