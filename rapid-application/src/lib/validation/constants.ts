export const SCHEMA_VERSION = "1.0.0";
export const FORM_VERSION = "2026-10-21";
export const DEFAULT_CYCLE_ID = "spring-2027";
export const DEFAULT_CATALOG_VERSION = "2026-10-21";

export const SECTION_IDS = [
  "s1_about",
  "s2_contact",
  "s3_family",
  "s4_church",
  "s5_study",
  "s6_terms",
  "s7_prior",
  "s8_fees",
  "s9_essay",
  "s10_refs",
  "s11_docs",
  "s12_submit",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_LABELS: Record<SectionId, string> = {
  s1_about: "About you",
  s2_contact: "Contact",
  s3_family: "Family & income",
  s4_church: "Church",
  s5_study: "Current study",
  s6_terms: "University results",
  s7_prior: "Earlier education",
  s8_fees: "Fees & scholarships",
  s9_essay: "Your goals",
  s10_refs: "References",
  s11_docs: "Documents",
  s12_submit: "Review & submit",
};
