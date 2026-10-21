import type { DocumentMime, DocumentSlotKey } from "@/lib/form/documents";

export type CatalogValue = {
  id: string | null;
  labelSnapshot: string | null;
  rawText: string;
  source: "catalog" | "other";
  reviewStatus: "verified" | "pending";
};

export type ApplicationStatus = "draft" | "submitted";

/** Result fields shared by university terms (s6) and earlier education (s7). Unused fields stay null. */
export type ResultFields = {
  resultFormat: string;
  resultFormatOther: string;
  gpaScale: string;
  gpaScaleOther: number | null;
  sgpa: number | null;
  cgpa: number | null;
  percentage: number | null;
  marksObtained: number | null;
  marksTotal: number | null;
  gradeScheme: string;
  letterGrade: string;
  letterGradeOther: string;
  division: string;
  divisionOther: string;
  passFail: string;
  passFailOther: string;
};

export type TermResult = ResultFields & {
  id: string;
  term: string;
};

export type PriorEducation = ResultFields & {
  id: string;
  level: string;
  programId: CatalogValue;
  board: string;
  institutionId: CatalogValue;
  examYear: number | null;
  resultStatus: string;
  resultStatusOther: string;
};

export type FlatSection = Record<string, unknown>;

export type ApplicationSections = {
  s1_about: FlatSection;
  s2_contact: FlatSection;
  s3_family: FlatSection;
  s4_church: FlatSection;
  s5_study: FlatSection;
  s6_terms: { termResults: TermResult[] };
  s7_prior: { priorEducation: PriorEducation[] };
  s8_fees: FlatSection;
  s9_essay: FlatSection;
  s10_refs: FlatSection;
  s11_docs: FlatSection;
  s12_submit: FlatSection;
};

export type ScholarshipApplication = {
  applicationId: string;
  cycleId: string;
  schemaVersion: string;
  formVersion: string;
  catalogVersion: string;
  ownerUid: string;
  status: ApplicationStatus;
  receiptCode: string | null;
  needsReview: boolean;
  /** Set by staff after submission. Metadata only: it does not change where documents are filed. */
  scholarshipProgram?: ScholarshipProgram | null;
  sections: ApplicationSections;
  createdAt: number;
  updatedAt: number;
  submittedAt: number | null;
};

export const SCHOLARSHIP_PROGRAMS = ["JIA", "RM", "IA"] as const;
export type ScholarshipProgram = (typeof SCHOLARSHIP_PROGRAMS)[number];

export type VerificationStatus = "pending" | "verified" | "rejected";

/** `scholarshipApplications/{id}/documents/{documentId}`; written only by Cloud Functions. */
export type DocumentRecord = {
  documentId: string;
  applicationId: string;
  slot: DocumentSlotKey;
  index: number;
  entryId: string | null;
  typeCode: string;
  label: string;
  contentType: DocumentMime;
  sizeBytes: number;
  sha256: string;
  uploadKey: string;
  uploadStatus: "uploading" | "stored";
  driveFileId: string | null;
  replacedDriveFileIds: string[];
  verificationStatus: VerificationStatus;
  verificationNote: string;
  verifiedBy: string | null;
  verifiedAt: number | null;
  uploadedAt: number;
};

export type ScholarshipCycle = {
  cycleId: string;
  label: string;
  open: boolean;
  deadlineAt: string | null;
  catalogVersion: string;
  formVersion: string;
  schemaVersion: string;
};
