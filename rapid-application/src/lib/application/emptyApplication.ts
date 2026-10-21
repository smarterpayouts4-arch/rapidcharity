import {
  DEFAULT_CATALOG_VERSION,
  DEFAULT_CYCLE_ID,
  FORM_VERSION,
  SCHEMA_VERSION,
} from "@/lib/validation/constants";
import { CYCLE_TERM_ID } from "@/lib/form/options";
import { emptyCatalogValue } from "@/lib/catalog/catalogValue";
import type {
  ApplicationSections,
  PriorEducation,
  ResultFields,
  ScholarshipApplication,
  TermResult,
} from "@/types/application";

export function emptySections(): ApplicationSections {
  return {
    s1_about: {},
    s2_contact: {},
    s3_family: {},
    s4_church: {},
    s5_study: {},
    s6_terms: { termResults: [] },
    s7_prior: { priorEducation: [] },
    s8_fees: { feeTerm: CYCLE_TERM_ID },
    s9_essay: {},
    s10_refs: {},
    s11_docs: {},
    s12_submit: {},
  };
}

function emptyResult(): ResultFields {
  return {
    resultFormat: "",
    resultFormatOther: "",
    gpaScale: "gs_4",
    gpaScaleOther: null,
    sgpa: null,
    cgpa: null,
    percentage: null,
    marksObtained: null,
    marksTotal: null,
    gradeScheme: "",
    letterGrade: "",
    letterGradeOther: "",
    division: "",
    divisionOther: "",
    passFail: "",
    passFailOther: "",
  };
}

export function newTermResult(): TermResult {
  return { id: crypto.randomUUID(), term: "", ...emptyResult() };
}

export function newPriorEducation(level = ""): PriorEducation {
  return {
    id: crypto.randomUUID(),
    level,
    programId: emptyCatalogValue(),
    board: "",
    institutionId: emptyCatalogValue(),
    examYear: null,
    resultStatus: "",
    resultStatusOther: "",
    ...emptyResult(),
  };
}

export function createDraftApplication(applicationId: string, ownerUid: string): ScholarshipApplication {
  const now = Date.now();
  return {
    applicationId,
    cycleId: DEFAULT_CYCLE_ID,
    schemaVersion: SCHEMA_VERSION,
    formVersion: FORM_VERSION,
    catalogVersion: DEFAULT_CATALOG_VERSION,
    ownerUid,
    status: "draft",
    receiptCode: null,
    needsReview: false,
    scholarshipType: null,
    driveFolder: "INTAKE",
    sections: emptySections(),
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
  };
}
