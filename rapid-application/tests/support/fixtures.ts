import type { ApplicationSections, PriorEducation, TermResult } from "../../src/types/application";

// Fictional applicant data only. CNICs use the 99999 prefix, which no real district issues.

const RESULT_BLANK = {
  resultFormatOther: "",
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

function catalog(id: string, label: string) {
  return { id, labelSnapshot: label, rawText: label, source: "catalog" as const, reviewStatus: "verified" as const };
}

export function term(id: string, termId: string, sgpa: number, cgpa: number): TermResult {
  return { ...RESULT_BLANK, id, term: termId, resultFormat: "rf_both", gpaScale: "gs_4", sgpa, cgpa };
}

export function prior(id: string, level: string, year: number, percentage: number): PriorEducation {
  return {
    ...RESULT_BLANK,
    id,
    level,
    programId: catalog(
      level === "lvl_mat" ? "prog_matric_science_biology" : "prog_fsc_pre_medical",
      level === "lvl_mat" ? "Matric - Science (Biology)" : "FSc Pre-Medical",
    ),
    board: "board_bise_lahore",
    institutionId: { id: null, labelSnapshot: null, rawText: "", source: "other", reviewStatus: "pending" },
    examYear: year,
    resultStatus: "rs_final",
    resultStatusOther: "",
    resultFormat: "rf_percentage",
    gpaScale: "",
    percentage,
  };
}

export const ENTRY_IDS = {
  term1: "a1b2c3d4-1111-4111-8111-111111111111",
  term2: "22222222-2222-4222-8222-222222222222",
  matric: "33333333-3333-4333-8333-333333333333",
  inter: "44444444-4444-4444-8444-444444444444",
};

export function completeSections(opts: { cnic?: string; firstName?: string; enrolment?: "es_continuing" | "es_new" } = {}): ApplicationSections {
  const enrolment = opts.enrolment ?? "es_continuing";
  return {
    s1_about: {
      firstName: opts.firstName ?? "Ayesha",
      lastName: "Testperson",
      cnic: opts.cnic ?? "99999-0000001-1",
      gender: "gen_female",
      religion: "relig_christian",
      specialNeeds: "no",
      previousRapid: "no",
    },
    s2_contact: {
      mobile: "0300-0000001",
      email: "Family.Test@Example.test",
      addressLine: "House 1, Test Street, Example Town",
      homeCity: catalog("city_lahore", "Lahore"),
      homeProvince: "prov_punjab",
    },
    s3_family: {
      fatherName: "Test Father",
      fatherOccupation: "occ_driver",
      fatherIncome: 30000,
      motherName: "Test Mother",
      motherOccupation: "occ_homemaker",
      motherIncome: 0,
      siblingsCount: 3,
      siblingsStudying: 2,
      employment: "emp_not_employed",
    },
    s4_church: { churchName: "Example Community Church", pastorName: "Pastor Example" },
    s5_study: {
      currentLevel: "lvl_bsng",
      institutionId: catalog("inst_forman_christian_college", "Forman Christian College (A Chartered University)"),
      programId: catalog("prog_bsn_generic", "BSN Generic (4-year)"),
      studySystem: "sys_semester",
      admissionTerm: enrolment === "es_new" ? "term_2027_spring" : "term_2025_fall",
      expectedCompletionTerm: enrolment === "es_new" ? "term_2030_fall" : "term_2029_spring",
      currentSemester: enrolment === "es_new" ? 1 : 3,
      enrolmentStatus: enrolment,
    },
    s6_terms: {
      termResults:
        enrolment === "es_new"
          ? []
          : [term(ENTRY_IDS.term1, "term_2025_fall", 3.2, 3.2), term(ENTRY_IDS.term2, "term_2026_spring", 3.5, 3.35)],
    },
    s7_prior: { priorEducation: [prior(ENTRY_IDS.matric, "lvl_mat", 2021, 82), prior(ENTRY_IDS.inter, "lvl_int", 2023, 78)] },
    s8_fees: { feeAmount: 85000, feeTerm: "term_2027_spring", otherScholarship: "ynp_no" },
    s9_essay: {
      goal: "I want to become a nurse and serve families in my community with care.",
      communitySupport: "I will volunteer at the church health camp and tutor younger students.",
    },
    s10_refs: { facultyRefName: "Professor Example", familyRefName: "Uncle Example", familyRefRelation: "rel_uncle_aunt", howHeard: "hh_church_pastor" },
    s11_docs: {},
    s12_submit: { declaration: true },
  };
}

/** Smallest valid files of each type. Content is fictional. */
export const PDF_BYTES = Buffer.from("%PDF-1.4\n% fictional test document\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
export const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5d6f6c60000000049454e44ae426082",
  "hex",
);
export const TEXT_BYTES = Buffer.from("this is not a pdf");
