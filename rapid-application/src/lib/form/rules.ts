import type { DocumentSlotKey } from "./documents";
import {
  CYCLE_TERM_ID,
  ENROL_NEW,
  GPA_SCALE_MAX,
  MAX_EXAM_YEAR,
  MAX_PRIOR_EDUCATION,
  MAX_TERM_RESULTS,
  MIN_EXAM_YEAR,
  OCC_DECEASED,
  OTHER,
  RESULT_AWAITED,
  RESULT_FORMAT_FIELDS,
  SYS_ANNUAL,
  SYS_SEMESTER,
  YES,
  YNP_PENDING,
  YNP_YES,
  boardApplies,
  gradeSchemeChoices,
  letterGradeBelongs,
  priorInstitutionApplies,
  requiresInter,
  requiresMatric,
  specialisationApplies,
  termSortKey,
  type ResultField,
} from "./options";
import multiCampus from "./multiCampus.generated.json";
import type {
  ApplicationSections,
  CatalogValue,
  FlatSection,
  PriorEducation,
  ResultFields,
  TermResult,
} from "../../types/application";

export type Issue = { section: keyof ApplicationSections; key: string; message: string };

const NAME = /^[A-Za-z' -]{2,40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PK_MOBILE = /^(\+92|0)3\d{2}-?\d{7}$/;
const TWO_DECIMALS = (n: number) => Math.round(n * 100) === n * 100;

const MULTI_CAMPUS = multiCampus as Record<string, string[]>;

export function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function catalogValue(v: unknown): CatalogValue | null {
  if (!v || typeof v !== "object") return null;
  const c = v as CatalogValue;
  if (c.source === "catalog" && typeof c.id === "string" && c.id) return c;
  if (c.source === "other" && str(c.rawText).length >= 2) return c;
  return null;
}

export function campusChoices(institution: unknown): string[] {
  const id = catalogValue(institution)?.id;
  return id ? (MULTI_CAMPUS[id] ?? []) : [];
}

/** Visible-field decisions shared by the form, the review page and the server. */
export function visibility(sections: ApplicationSections) {
  const s1 = sections.s1_about;
  const s3 = sections.s3_family;
  const s5 = sections.s5_study;
  const s8 = sections.s8_fees;
  const program = catalogValue(s5.programId);
  return {
    fatherIncome: str(s3.fatherOccupation) !== OCC_DECEASED,
    motherIncome: str(s3.motherOccupation) !== OCC_DECEASED,
    campus: campusChoices(s5.institutionId).length > 1,
    specialisation: specialisationApplies(str(s5.currentLevel), program?.source === "other"),
    currentSemester: str(s5.studySystem) === SYS_SEMESTER,
    currentYear: str(s5.studySystem) === SYS_ANNUAL,
    termResults: str(s5.enrolmentStatus) !== ENROL_NEW,
    otherScholarshipDetail: [YNP_YES, YNP_PENDING].includes(str(s8.otherScholarship)),
    homeProvinceEditable: catalogValue(sections.s2_contact.homeCity)?.source === "other",
    docDeathCert: str(s3.fatherOccupation) === OCC_DECEASED || str(s3.motherOccupation) === OCC_DECEASED,
    docDisabilityCert: str(s1.specialNeeds) === YES,
  };
}

export function requiredDocumentSlots(sections: ApplicationSections): DocumentSlotKey[] {
  const v = visibility(sections);
  const slots: DocumentSlotKey[] = [
    "docApplicantId",
    "docPhoto",
    "docAdmissionProof",
    "docFeeVoucher",
    "docRecommendation",
    "docGuardianId",
  ];
  if (v.docDeathCert) slots.push("docDeathCert");
  if (v.docDisabilityCert) slots.push("docDisabilityCert");
  return slots;
}

/** Fields shown for a result entry, given its format and (for letter grades) the level and year. */
export function resultFieldsShown(entry: ResultFields, levelId: string, examYear: number | null) {
  const fields = new Set<ResultField | "gradeScheme">(RESULT_FORMAT_FIELDS[entry.resultFormat] ?? []);
  if (fields.has("letterGrade") && gradeSchemeChoices(levelId, examYear).length > 1) fields.add("gradeScheme");
  return fields;
}

export function marksPercent(entry: Pick<ResultFields, "marksObtained" | "marksTotal">): number | null {
  const o = num(entry.marksObtained);
  const t = num(entry.marksTotal);
  if (o === null || t === null || t <= 0) return null;
  return Math.round((10000 * o) / t) / 100;
}

class Check {
  issues: Issue[] = [];
  constructor(
    private section: keyof ApplicationSections,
    private values: Record<string, unknown>,
    private prefix = "",
  ) {}

  fail(key: string, message: string) {
    this.issues.push({ section: this.section, key: `${this.prefix}${key}`, message });
  }

  text(key: string, min: number, max: number, label = "This field") {
    const v = str(this.values[key]);
    if (v.length < min) this.fail(key, min <= 1 ? `${label} is required.` : `${label} needs at least ${min} characters.`);
    else if (v.length > max) this.fail(key, `${label} can be at most ${max} characters.`);
    return v;
  }

  name(key: string) {
    const v = str(this.values[key]);
    if (!NAME.test(v)) this.fail(key, "Use 2-40 letters, spaces, apostrophes or hyphens.");
  }

  select(key: string, prefix: string) {
    const v = str(this.values[key]);
    if (!v) {
      this.fail(key, "Choose an option.");
      return v;
    }
    if (v === OTHER) {
      const other = str(this.values[`${key}Other`]);
      if (other.length < 2 || other.length > 120) this.fail(`${key}Other`, "Type your answer (2-120 characters).");
      return v;
    }
    if (!v.startsWith(prefix)) this.fail(key, "Choose an option from the list.");
    return v;
  }

  catalog(key: string, idPrefix?: string) {
    const v = catalogValue(this.values[key]);
    if (!v) {
      this.fail(key, "Choose from the list or enter it manually.");
      return null;
    }
    if (v.source === "other" && str(v.rawText).length > 120) this.fail(key, "Keep the manual entry under 120 characters.");
    if (v.source === "catalog" && idPrefix && !v.id!.startsWith(idPrefix)) this.fail(key, "Choose from the list.");
    return v;
  }

  integer(key: string, min: number, max: number, required = true) {
    const v = num(this.values[key]);
    if (v === null) {
      if (required) this.fail(key, "Enter a number.");
      return null;
    }
    if (!Number.isInteger(v) || v < min || v > max) this.fail(key, `Enter a whole number from ${min.toLocaleString("en")} to ${max.toLocaleString("en")}.`);
    return v;
  }
}

function checkResult(c: Check, entry: ResultFields, levelId: string, examYear: number | null) {
  const format = c.select("resultFormat", "rf_");
  if (!format) return;
  const shown = resultFieldsShown(entry, levelId, examYear);
  if (shown.has("gpaScale")) {
    const scale = str(entry.gpaScale);
    let max: number | null = GPA_SCALE_MAX[scale] ?? null;
    if (scale === OTHER) {
      max = num(entry.gpaScaleOther);
      if (max === null || max <= 0 || max > 100) c.fail("gpaScaleOther", "Enter the maximum GPA on your card.");
    } else if (max === null) {
      c.fail("gpaScale", "Choose the GPA scale.");
    }
    for (const key of ["sgpa", "cgpa"] as const) {
      if (!shown.has(key)) continue;
      const v = num(entry[key]);
      if (v === null) c.fail(key, "Enter your GPA.");
      else if (v < 0 || !TWO_DECIMALS(v)) c.fail(key, "Enter the GPA with at most 2 decimals.");
      else if (max !== null && v > max) {
        c.fail(key, v > 10 ? "That looks like a percentage. Choose “Percentage” as the format instead." : `GPA cannot be above ${max}.`);
      }
    }
  }
  if (shown.has("percentage")) {
    const v = num(entry.percentage);
    if (v === null) c.fail("percentage", "Enter your percentage.");
    else if (v <= 1) c.fail("percentage", "Type the percentage as a number like 75, not 0.75.");
    else if (v > 100 || !TWO_DECIMALS(v)) c.fail("percentage", "Enter a percentage up to 100 with at most 2 decimals.");
  }
  if (shown.has("marksObtained")) {
    const o = num(entry.marksObtained);
    const t = num(entry.marksTotal);
    if (t === null || t <= 0 || t > 5000) c.fail("marksTotal", "Total marks must be between 1 and 5,000.");
    if (o === null || o < 0) c.fail("marksObtained", "Enter the marks you obtained.");
    else if (t !== null && o > t) c.fail("marksObtained", "Marks obtained cannot be more than total marks.");
  }
  if (shown.has("letterGrade")) {
    const choices = gradeSchemeChoices(levelId, examYear);
    const scheme = choices.length === 1 ? choices[0] : str(entry.gradeScheme);
    if (choices.length > 1 && !choices.includes(scheme)) c.fail("gradeScheme", "Choose which grade list is on your card.");
    const grade = c.select("letterGrade", "grade_");
    if (grade && grade !== OTHER && scheme && !letterGradeBelongs(grade, scheme)) c.fail("letterGrade", "Choose a grade from the selected grade list.");
  }
  if (shown.has("division")) c.select("division", "div_");
  if (shown.has("passFail")) c.select("passFail", "pf_");
}

function validateTerms(sections: ApplicationSections, issues: Issue[]) {
  if (!visibility(sections).termResults) return;
  const entries = sections.s6_terms.termResults ?? [];
  if (entries.length === 0) {
    issues.push({ section: "s6_terms", key: "termResults", message: "Add at least one completed term." });
  }
  if (entries.length > MAX_TERM_RESULTS) {
    issues.push({ section: "s6_terms", key: "termResults", message: `Add at most ${MAX_TERM_RESULTS} terms.` });
  }
  const admission = termSortKey(str(sections.s5_study.admissionTerm));
  const cycle = termSortKey(CYCLE_TERM_ID)!;
  const seen = new Set<string>();
  const level = str(sections.s5_study.currentLevel);
  entries.forEach((entry, i) => {
    const c = new Check("s6_terms", entry, `termResults.${i}.`);
    const term = c.select("term", "term_");
    const key = termSortKey(term);
    if (term && seen.has(term)) c.fail("term", "Each term can only be added once.");
    seen.add(term);
    if (key !== null && key >= cycle) c.fail("term", "Add only terms you have already completed.");
    if (key !== null && admission !== null && key < admission) c.fail("term", "This term is before the term you started.");
    checkResult(c, entry, level, null);
    issues.push(...c.issues);
  });
}

function validatePrior(sections: ApplicationSections, issues: Issue[]) {
  const entries = sections.s7_prior.priorEducation ?? [];
  const current = str(sections.s5_study.currentLevel);
  const levels = entries.map((e) => str(e.level));
  if (requiresMatric(current) && !levels.some((l) => l === "lvl_mat" || l === "lvl_ol")) {
    issues.push({ section: "s7_prior", key: "priorEducation", message: "Add your Matric / O-Level." });
  }
  if (requiresInter(current) && !levels.some((l) => l === "lvl_int" || l === "lvl_al" || l === "lvl_dae")) {
    issues.push({ section: "s7_prior", key: "priorEducation", message: "Add your Intermediate / A-Level (or DAE)." });
  }
  if (entries.length > MAX_PRIOR_EDUCATION) {
    issues.push({ section: "s7_prior", key: "priorEducation", message: `Add at most ${MAX_PRIOR_EDUCATION} entries.` });
  }
  const seen = new Set<string>();
  entries.forEach((entry, i) => {
    const c = new Check("s7_prior", entry, `priorEducation.${i}.`);
    const level = c.select("level", "lvl_");
    if (level && level !== OTHER && seen.has(level)) c.fail("level", "Add each level only once.");
    seen.add(level);
    c.catalog("programId", "prog_");
    if (boardApplies(level)) c.select("board", "board_");
    if (priorInstitutionApplies(level)) c.catalog("institutionId", "inst_");
    const year = c.integer("examYear", MIN_EXAM_YEAR, MAX_EXAM_YEAR);
    const status = c.select("resultStatus", "rs_");
    if (status && status !== RESULT_AWAITED) checkResult(c, entry, level, year);
    issues.push(...c.issues);
  });
  const yearOf = (ids: string[]) => entries.find((e) => ids.includes(e.level))?.examYear ?? null;
  const matric = yearOf(["lvl_mat", "lvl_ol"]);
  const inter = yearOf(["lvl_int", "lvl_al", "lvl_dae"]);
  if (matric !== null && inter !== null && matric >= inter) {
    const i = entries.findIndex((e) => ["lvl_int", "lvl_al", "lvl_dae"].includes(e.level));
    issues.push({ section: "s7_prior", key: `priorEducation.${i}.examYear`, message: "The Intermediate year must be after the Matric year." });
  }
}

export type ValidationContext = {
  /** Programme duration from the catalog, used only for the completion-term warning. */
  programDurationYears?: number | null;
};

export type ValidationResult = { issues: Issue[]; warnings: Issue[] };

export function validateSections(sections: ApplicationSections, ctx: ValidationContext = {}): ValidationResult {
  const issues: Issue[] = [];
  const warnings: Issue[] = [];
  const v = visibility(sections);

  const s1 = new Check("s1_about", sections.s1_about);
  s1.name("firstName");
  s1.name("lastName");
  if (str(sections.s1_about.cnic).replace(/\D/g, "").length !== 13) s1.fail("cnic", "Enter the 13-digit CNIC / B-Form number.");
  s1.select("gender", "gen_");
  s1.select("religion", "relig_");
  s1.select("specialNeeds", "");
  s1.select("previousRapid", "");
  issues.push(...s1.issues);

  const s2 = new Check("s2_contact", sections.s2_contact);
  if (!PK_MOBILE.test(str(sections.s2_contact.mobile).replace(/\s/g, ""))) s2.fail("mobile", "Enter a Pakistan mobile number like 0300-1234567.");
  if (!EMAIL.test(str(sections.s2_contact.email))) s2.fail("email", "Enter a valid email address.");
  s2.text("addressLine", 5, 150, "Address");
  s2.catalog("homeCity", "city_");
  s2.select("homeProvince", "prov_");
  issues.push(...s2.issues);

  const s3 = new Check("s3_family", sections.s3_family);
  s3.text("fatherName", 2, 80, "Name");
  s3.select("fatherOccupation", "occ_");
  if (v.fatherIncome) s3.integer("fatherIncome", 0, 2_000_000);
  s3.text("motherName", 2, 80, "Name");
  s3.select("motherOccupation", "occ_");
  if (v.motherIncome) s3.integer("motherIncome", 0, 2_000_000);
  const siblings = s3.integer("siblingsCount", 0, 20);
  s3.integer("siblingsStudying", 0, siblings ?? 20, false);
  s3.select("employment", "emp_");
  issues.push(...s3.issues);

  const s4 = new Check("s4_church", sections.s4_church);
  s4.text("churchName", 2, 120, "Church name");
  s4.text("pastorName", 2, 80, "Pastor name");
  issues.push(...s4.issues);

  const s5 = new Check("s5_study", sections.s5_study);
  s5.select("currentLevel", "lvl_");
  s5.catalog("institutionId", "inst_");
  if (v.campus) {
    const campus = str(sections.s5_study.campus);
    if (!campus) s5.fail("campus", "Choose your campus.");
    else if (campus === OTHER) s5.text("campusOther", 2, 120, "Campus");
    else if (!campusChoices(sections.s5_study.institutionId).includes(campus)) s5.fail("campus", "Choose a campus from the list.");
  }
  s5.catalog("programId", "prog_");
  if (v.specialisation) s5.text("specialisation", 0, 80, "Specialisation");
  s5.select("studySystem", "sys_");
  const admission = termSortKey(s5.select("admissionTerm", "term_"));
  const completion = termSortKey(s5.select("expectedCompletionTerm", "term_"));
  const cycle = termSortKey(CYCLE_TERM_ID)!;
  if (admission !== null && admission > cycle) s5.fail("admissionTerm", "The start term cannot be after Spring 2027.");
  if (admission !== null && completion !== null && completion <= admission) {
    s5.fail("expectedCompletionTerm", "The finishing term must be after the start term.");
  } else if (admission !== null && completion !== null && ctx.programDurationYears) {
    const years = Math.floor(completion / 10) - Math.floor(admission / 10);
    if (Math.abs(years - ctx.programDurationYears) > 1) {
      warnings.push({
        section: "s5_study",
        key: "expectedCompletionTerm",
        message: `This programme usually takes about ${ctx.programDurationYears} years. Please double-check the finishing term.`,
      });
    }
  }
  if (v.currentSemester) s5.integer("currentSemester", 1, 12);
  if (v.currentYear) s5.select("currentYear", "yr_");
  s5.select("enrolmentStatus", "es_");
  issues.push(...s5.issues);

  validateTerms(sections, issues);
  validatePrior(sections, issues);

  const s8 = new Check("s8_fees", sections.s8_fees);
  s8.integer("feeAmount", 1000, 3_000_000);
  s8.select("feeTerm", "term_");
  s8.select("otherScholarship", "ynp_");
  if (v.otherScholarshipDetail) s8.text("otherScholarshipDetail", 2, 120, "Scholarship details");
  issues.push(...s8.issues);

  const s9 = new Check("s9_essay", sections.s9_essay);
  s9.text("goal", 30, 800, "Your answer");
  s9.text("communitySupport", 30, 800, "Your answer");
  issues.push(...s9.issues);

  const s10 = new Check("s10_refs", sections.s10_refs);
  const faculty = s10.text("facultyRefName", 2, 80, "Name");
  const own = `${str(sections.s1_about.firstName)} ${str(sections.s1_about.lastName)}`.toLowerCase().replace(/\s+/g, " ");
  if (faculty && faculty.toLowerCase().replace(/\s+/g, " ") === own) s10.fail("facultyRefName", "The faculty reference cannot be yourself.");
  s10.text("familyRefName", 2, 80, "Name");
  s10.select("familyRefRelation", "rel_");
  s10.select("howHeard", "hh_");
  issues.push(...s10.issues);

  if (sections.s12_submit.declaration !== true) {
    issues.push({ section: "s12_submit", key: "declaration", message: "Confirm the declaration to submit." });
  }

  return { issues, warnings };
}

export type UploadedDocument = { slot: DocumentSlotKey; index: number; entryId: string | null; uploadStatus: string; label: string };

export function validateDocuments(sections: ApplicationSections, documents: UploadedDocument[]): Issue[] {
  const stored = documents.filter((d) => d.uploadStatus === "stored");
  const issues: Issue[] = [];
  for (const slot of requiredDocumentSlots(sections)) {
    if (!stored.some((d) => d.slot === slot)) issues.push({ section: "s11_docs", key: slot, message: "Upload this document." });
  }
  for (const d of stored) {
    if (d.slot === "docOther" && (str(d.label).length < 2 || str(d.label).length > 60)) {
      issues.push({ section: "s11_docs", key: `docOther_${d.index}`, message: "Give the extra document a short label." });
    }
  }
  return issues;
}

function clearResult<T extends ResultFields>(entry: T, levelId: string, examYear: number | null, keep: boolean): T {
  const shown = keep ? resultFieldsShown(entry, levelId, examYear) : new Set<string>();
  return {
    ...entry,
    resultFormat: keep ? entry.resultFormat : "",
    resultFormatOther: keep && entry.resultFormat === OTHER ? entry.resultFormatOther : "",
    gpaScale: shown.has("gpaScale") ? entry.gpaScale : "",
    gpaScaleOther: shown.has("gpaScale") && entry.gpaScale === OTHER ? entry.gpaScaleOther : null,
    sgpa: shown.has("sgpa") ? entry.sgpa : null,
    cgpa: shown.has("cgpa") ? entry.cgpa : null,
    percentage: shown.has("percentage") ? entry.percentage : null,
    marksObtained: shown.has("marksObtained") ? entry.marksObtained : null,
    marksTotal: shown.has("marksTotal") ? entry.marksTotal : null,
    gradeScheme: shown.has("letterGrade")
      ? (gradeSchemeChoices(levelId, examYear).length === 1 ? gradeSchemeChoices(levelId, examYear)[0] : entry.gradeScheme)
      : "",
    letterGrade: shown.has("letterGrade") ? entry.letterGrade : "",
    letterGradeOther: shown.has("letterGrade") && entry.letterGrade === OTHER ? entry.letterGradeOther : "",
    division: shown.has("division") ? entry.division : "",
    divisionOther: shown.has("division") && entry.division === OTHER ? entry.divisionOther : "",
    passFail: shown.has("passFail") ? entry.passFail : "",
    passFailOther: shown.has("passFail") && entry.passFail === OTHER ? entry.passFailOther : "",
  };
}

function withoutOtherText(section: FlatSection): FlatSection {
  const out: FlatSection = { ...section };
  for (const key of Object.keys(out)) {
    if (key.endsWith("Other") && out[key.slice(0, -"Other".length)] !== OTHER) delete out[key];
  }
  return out;
}

/** Removes answers to questions that are hidden by other answers, so submitted data matches what was shown. */
export function clearHiddenAnswers(sections: ApplicationSections): ApplicationSections {
  const v = visibility(sections);
  const next = structuredClone(sections);
  for (const key of ["s1_about", "s2_contact", "s3_family", "s5_study", "s8_fees", "s10_refs"] as const) {
    next[key] = withoutOtherText(next[key]);
  }
  if (!v.fatherIncome) delete next.s3_family.fatherIncome;
  if (!v.motherIncome) delete next.s3_family.motherIncome;
  if (!v.campus) {
    delete next.s5_study.campus;
    delete next.s5_study.campusOther;
  }
  if (!v.specialisation) delete next.s5_study.specialisation;
  if (!v.currentSemester) delete next.s5_study.currentSemester;
  if (!v.currentYear) delete next.s5_study.currentYear;
  if (!v.otherScholarshipDetail) delete next.s8_fees.otherScholarshipDetail;
  const level = str(next.s5_study.currentLevel);
  next.s6_terms = {
    termResults: v.termResults ? (next.s6_terms.termResults ?? []).map((e: TermResult) => clearResult(e, level, null, true)) : [],
  };
  next.s7_prior = {
    priorEducation: (next.s7_prior.priorEducation ?? []).map((e: PriorEducation) => {
      const cleared = clearResult(e, e.level, e.examYear, e.resultStatus !== RESULT_AWAITED);
      return {
        ...cleared,
        board: boardApplies(e.level) ? e.board : "",
        institutionId: priorInstitutionApplies(e.level) ? e.institutionId : emptyCatalog(),
        resultStatusOther: e.resultStatus === OTHER ? e.resultStatusOther : "",
      };
    }),
  };
  return next;
}

function emptyCatalog(): CatalogValue {
  return { id: null, labelSnapshot: null, rawText: "", source: "other", reviewStatus: "pending" };
}

/** Fields typed in manually ("Other" / "Can't find it") that staff should review. */
export function manualEntries(sections: ApplicationSections): { fieldKey: string; listId: string; rawText: string }[] {
  const out: { fieldKey: string; listId: string; rawText: string }[] = [];
  const add = (fieldKey: string, listId: string, value: unknown) => {
    const c = catalogValue(value);
    if (c?.source === "other") out.push({ fieldKey, listId, rawText: str(c.rawText) });
  };
  add("homeCity", "cities", sections.s2_contact.homeCity);
  add("institutionId", "institutions", sections.s5_study.institutionId);
  add("programId", "programs", sections.s5_study.programId);
  (sections.s7_prior.priorEducation ?? []).forEach((e, i) => {
    add(`priorEducation.${i}.programId`, "programs", e.programId);
    add(`priorEducation.${i}.institutionId`, "institutions", e.institutionId);
  });
  return out;
}
