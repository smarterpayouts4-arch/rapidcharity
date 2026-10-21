// List ids from `form References/spec/lists/*.json` that drive conditional rules.
export const OTHER = "other";
export const YES = "yes";
export const OCC_DECEASED = "occ_deceased";
export const ENROL_NEW = "es_new";
export const SYS_SEMESTER = "sys_semester";
export const SYS_ANNUAL = "sys_annual";
export const RESULT_AWAITED = "rs_awaited";
export const YNP_YES = "ynp_yes";
export const YNP_PENDING = "ynp_pending";

export const CYCLE_TERM_ID = "term_2027_spring";
export const MIN_EXAM_YEAR = 1990;
export const MAX_EXAM_YEAR = 2027;
export const MAX_TERM_RESULTS = 14;
export const MAX_PRIOR_EDUCATION = 8;
export const MAX_OTHER_DOCUMENTS = 3;

export type ResultField =
  | "gpaScale"
  | "sgpa"
  | "cgpa"
  | "percentage"
  | "marksObtained"
  | "marksTotal"
  | "letterGrade"
  | "division"
  | "passFail";

export const RESULT_FORMAT_FIELDS: Record<string, ResultField[]> = {
  rf_sgpa: ["gpaScale", "sgpa"],
  rf_cgpa: ["gpaScale", "cgpa"],
  rf_both: ["gpaScale", "sgpa", "cgpa"],
  rf_percentage: ["percentage"],
  rf_marks: ["marksObtained", "marksTotal"],
  rf_letter: ["letterGrade"],
  rf_division: ["division"],
  rf_passfail: ["passFail"],
  other: [],
};

export const GPA_SCALE_MAX: Record<string, number> = { gs_4: 4, gs_5: 5, gs_10: 10 };

/** Level code as used by programmes, grade schemes and institutions (`lvl_bsng` → `BSNG`). */
export function levelCode(levelId: string): string {
  return levelId.startsWith("lvl_") ? levelId.slice(4).toUpperCase() : "";
}

const SCHOOL_LEVELS = new Set(["lvl_mat", "lvl_ol"]);
const PRE_UNIVERSITY_LEVELS = new Set(["lvl_int", "lvl_al", "lvl_dae", "lvl_ndip"]);
const BOARD_LEVELS = new Set(["lvl_mat", "lvl_int", "lvl_dae"]);
const SPECIALISATION_LEVELS = new Set(["BA2", "MA2", "MBA", "MS", "NDIP"]);

export function isSchoolLevel(levelId: string): boolean {
  return SCHOOL_LEVELS.has(levelId);
}

/** Matric/O-Level is required for everyone except applicants currently studying at that level. */
export function requiresMatric(currentLevel: string): boolean {
  return !SCHOOL_LEVELS.has(currentLevel);
}

/** Inter/A-Level is required when the current level is above pre-university. */
export function requiresInter(currentLevel: string): boolean {
  return Boolean(currentLevel) && currentLevel !== OTHER && !SCHOOL_LEVELS.has(currentLevel) && !PRE_UNIVERSITY_LEVELS.has(currentLevel);
}

export function boardApplies(levelId: string): boolean {
  return BOARD_LEVELS.has(levelId);
}

export function priorInstitutionApplies(levelId: string): boolean {
  return Boolean(levelId) && !BOARD_LEVELS.has(levelId) && levelId !== "lvl_ndip";
}

export function specialisationApplies(currentLevel: string, programIsOther: boolean): boolean {
  return programIsOther || SPECIALISATION_LEVELS.has(levelCode(currentLevel));
}

const MATRIC_INTER = new Set(["MAT", "INT"]);
const GRADE_SCHEMES: { id: string; levels: string[] }[] = [
  { id: "gsch_bise_old", levels: ["MAT", "INT"] },
  { id: "gsch_ibcc_new", levels: ["MAT", "INT"] },
  {
    id: "gsch_hec",
    levels: "ADP BS4 BSNG BSNP BSM MS MPHIL MSN MPH MBA PHD PHARMD DPT DVM LLB BARCH BEMS".split(" "),
  },
  { id: "gsch_hec_annual", levels: ["BA2", "MA2"] },
  { id: "gsch_cambridge", levels: ["OL", "AL"] },
  { id: "gsch_gcse_91", levels: ["OL"] },
];
const ALL_SCHEMES = [...GRADE_SCHEMES.map((s) => s.id), OTHER];

/** Grade schemes the applicant may choose from; a single entry means it is set automatically. */
export function gradeSchemeChoices(levelId: string, examYear: number | null): string[] {
  const code = levelCode(levelId);
  if (MATRIC_INTER.has(code) && examYear !== null && examYear <= 2025) return ["gsch_bise_old"];
  const fits = GRADE_SCHEMES.filter((s) => s.levels.includes(code)).map((s) => s.id);
  return fits.length ? fits : ALL_SCHEMES;
}

export function letterGradeBelongs(letterGradeId: string, schemeId: string): boolean {
  if (schemeId === OTHER || letterGradeId === OTHER) return true;
  const prefix = `grade_${schemeId.slice("gsch_".length)}_`;
  if (!letterGradeId.startsWith(prefix)) return false;
  return !(schemeId === "gsch_hec" && letterGradeId.startsWith("grade_hec_annual_"));
}

/** `term_2027_spring` → 20271; null when the id is not a term. */
export function termSortKey(termId: string): number | null {
  const m = /^term_(\d{4})_(spring|summer|fall)$/.exec(termId);
  if (!m) return null;
  return Number(m[1]) * 10 + { spring: 1, summer: 2, fall: 3 }[m[2] as "spring" | "summer" | "fall"];
}
