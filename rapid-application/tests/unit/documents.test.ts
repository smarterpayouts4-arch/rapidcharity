import { describe, expect, it } from "vitest";
import { checkFile, documentId, parseDocumentId, sniffMime } from "@/lib/form/documents";
import { buildCsv, csvCell } from "@/features/admin/csv";
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

describe("CSV export", () => {
  it("neutralises spreadsheet formulas and quotes cells", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell('say "hi"')).toBe(`"say ""hi"""`);
  });
  it("writes one row per application with document statuses", () => {
    const csv = buildCsv(
      [
        {
          applicationId: "a",
          receiptCode: "RAPID-2027-TEST",
          submittedAt: 0,
          needsReview: false,
          sections: {
            s1_about: { firstName: "Test" },
            s2_contact: {},
            s3_family: {},
            s4_church: {},
            s5_study: {},
            s6_terms: { termResults: [] },
            s7_prior: { priorEducation: [] },
            s8_fees: {},
            s9_essay: {},
            s10_refs: {},
            s11_docs: {},
            s12_submit: {},
          },
        } as never,
      ],
      [[{ slot: "docPhoto", uploadStatus: "stored", verificationStatus: "verified" } as never]],
      new Map(),
    );
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"RAPID-2027-TEST"');
    expect(lines[1]).toContain('"verified"');
  });
});
