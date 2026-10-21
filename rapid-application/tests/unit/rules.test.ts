import { describe, expect, it } from "vitest";
import { clearHiddenAnswers, manualEntries, requiredDocumentSlots, validateDocuments, validateSections, visibility } from "@/lib/form/rules";
import { gradeSchemeChoices, letterGradeBelongs } from "@/lib/form/options";
import { completeSections, ENTRY_IDS, prior, term } from "../support/fixtures";

const keys = (s: ReturnType<typeof completeSections>) => validateSections(s).issues.map((i) => `${i.section}:${i.key}`);

describe("validateSections", () => {
  it("accepts a complete continuing student with several results", () => {
    expect(validateSections(completeSections()).issues).toEqual([]);
  });

  it("does not ask newly admitted students for university results", () => {
    const s = completeSections({ enrolment: "es_new" });
    expect(visibility(s).termResults).toBe(false);
    expect(validateSections(s).issues).toEqual([]);
  });

  it("requires at least one term for continuing students", () => {
    const s = completeSections();
    s.s6_terms.termResults = [];
    expect(keys(s)).toContain("s6_terms:termResults");
  });

  it("rejects duplicate terms and terms that are not completed yet", () => {
    const s = completeSections();
    s.s6_terms.termResults = [term(ENTRY_IDS.term1, "term_2025_fall", 3, 3), term(ENTRY_IDS.term2, "term_2025_fall", 3, 3)];
    expect(keys(s)).toContain("s6_terms:termResults.1.term");
    s.s6_terms.termResults = [term(ENTRY_IDS.term1, "term_2027_spring", 3, 3)];
    expect(keys(s)).toContain("s6_terms:termResults.0.term");
  });

  it("flags a percentage typed as a GPA and a fraction typed as a percentage", () => {
    const s = completeSections();
    s.s6_terms.termResults[0]!.sgpa = 85;
    const issue = validateSections(s).issues.find((i) => i.key === "termResults.0.sgpa");
    expect(issue?.message).toMatch(/percentage/i);
    s.s6_terms.termResults[0]!.sgpa = 3;
    s.s7_prior.priorEducation[0]!.percentage = 0.75;
    expect(keys(s)).toContain("s7_prior:priorEducation.0.percentage");
  });

  it("checks marks obtained against total marks", () => {
    const s = completeSections();
    Object.assign(s.s7_prior.priorEducation[0]!, { resultFormat: "rf_marks", percentage: null, marksObtained: 1200, marksTotal: 1100 });
    expect(keys(s)).toContain("s7_prior:priorEducation.0.marksObtained");
  });

  it("requires Matric for everyone and Inter for university levels", () => {
    const s = completeSections();
    s.s7_prior.priorEducation = [prior(ENTRY_IDS.matric, "lvl_mat", 2021, 80)];
    expect(validateSections(s).issues.some((i) => /Intermediate/.test(i.message))).toBe(true);
    s.s5_study.currentLevel = "lvl_int";
    expect(validateSections(s).issues.some((i) => /Intermediate/.test(i.message))).toBe(false);
  });

  it("hides income for a deceased parent and then requires a death certificate", () => {
    const s = completeSections();
    s.s3_family.fatherOccupation = "occ_deceased";
    delete s.s3_family.fatherIncome;
    expect(visibility(s).fatherIncome).toBe(false);
    expect(validateSections(s).issues).toEqual([]);
    expect(requiredDocumentSlots(s)).toContain("docDeathCert");
  });

  it("requires a typed answer when Other is chosen", () => {
    const s = completeSections();
    s.s1_about.religion = "other";
    expect(keys(s)).toContain("s1_about:religionOther");
    s.s1_about.religionOther = "Example faith";
    expect(keys(s)).not.toContain("s1_about:religionOther");
  });

  it("accepts an institution typed in manually and queues it for review", () => {
    const s = completeSections();
    s.s5_study.institutionId = { id: null, labelSnapshot: null, rawText: "Example Nursing School, Testville", source: "other", reviewStatus: "pending" };
    expect(validateSections(s).issues).toEqual([]);
    expect(manualEntries(s).map((m) => m.fieldKey)).toContain("institutionId");
  });

  it("warns, but does not block, when the finishing term does not fit the programme length", () => {
    const s = completeSections();
    s.s5_study.expectedCompletionTerm = "term_2026_fall";
    const result = validateSections(s, { programDurationYears: 4 });
    expect(result.issues).toEqual([]);
    expect(result.warnings.map((w) => w.key)).toEqual(["expectedCompletionTerm"]);
  });

  it("rejects the applicant naming themselves as faculty reference", () => {
    const s = completeSections();
    s.s10_refs.facultyRefName = "ayesha  testperson";
    expect(keys(s)).toContain("s10_refs:facultyRefName");
  });
});

describe("grade schemes", () => {
  it("picks the old BISE scheme automatically up to 2025 and asks from 2026", () => {
    expect(gradeSchemeChoices("lvl_mat", 2024)).toEqual(["gsch_bise_old"]);
    expect(gradeSchemeChoices("lvl_mat", 2026)).toEqual(["gsch_bise_old", "gsch_ibcc_new"]);
    expect(gradeSchemeChoices("lvl_bs4", null)).toEqual(["gsch_hec"]);
  });
  it("keeps HEC and HEC annual grades apart", () => {
    expect(letterGradeBelongs("grade_hec_a", "gsch_hec")).toBe(true);
    expect(letterGradeBelongs("grade_hec_annual_a", "gsch_hec")).toBe(false);
    expect(letterGradeBelongs("grade_cambridge_a", "gsch_hec")).toBe(false);
  });
});

describe("clearHiddenAnswers", () => {
  it("removes answers to questions that are no longer shown", () => {
    const s = completeSections({ enrolment: "es_new" });
    s.s6_terms.termResults = [term(ENTRY_IDS.term1, "term_2025_fall", 3, 3)];
    s.s3_family.fatherOccupation = "occ_deceased";
    s.s1_about.genderOther = "left over";
    const cleaned = clearHiddenAnswers(s);
    expect(cleaned.s6_terms.termResults).toEqual([]);
    expect(cleaned.s3_family.fatherIncome).toBeUndefined();
    expect(cleaned.s1_about.genderOther).toBeUndefined();
    expect(s.s3_family.fatherIncome).toBe(30000);
  });
  it("drops result values that do not belong to the chosen format", () => {
    const s = completeSections();
    Object.assign(s.s6_terms.termResults[0]!, { resultFormat: "rf_percentage", percentage: 80 });
    const cleaned = clearHiddenAnswers(s).s6_terms.termResults[0]!;
    expect(cleaned.sgpa).toBeNull();
    expect(cleaned.gpaScale).toBe("");
    expect(cleaned.percentage).toBe(80);
  });
});

describe("validateDocuments", () => {
  const stored = (slot: string, index = 1, label = "", uploadStatus = "stored") =>
    ({ slot, index, entryId: null, uploadStatus, label }) as never;
  it("lists missing required documents and ignores unfinished uploads", () => {
    const s = completeSections();
    const docs = ["docApplicantId", "docPhoto", "docAdmissionProof", "docFeeVoucher", "docRecommendation"].map((slot) => stored(slot));
    docs.push(stored("docGuardianId", 1, "", "uploading"));
    expect(validateDocuments(s, docs).map((i) => i.key)).toEqual(["docGuardianId"]);
  });
  it("requires a disability certificate in the special-needs category", () => {
    const s = completeSections();
    s.s1_about.specialNeeds = "yes";
    expect(requiredDocumentSlots(s)).toContain("docDisabilityCert");
  });
});
