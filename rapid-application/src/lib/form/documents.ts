export type DocumentMime = "application/pdf" | "image/jpeg" | "image/png";

export type DocumentSlotKey =
  | "docApplicantId"
  | "docPhoto"
  | "docAdmissionProof"
  | "docFeeVoucher"
  | "docRecommendation"
  | "docGuardianId"
  | "docIncomeProof"
  | "docDeathCert"
  | "docDisabilityCert"
  | "docOther"
  | "resultDoc";

type SlotSpec = { code: string; label: string; maxBytes: number; types: DocumentMime[]; maxFiles: number };

const MB = 1024 * 1024;
const ANY: DocumentMime[] = ["application/pdf", "image/jpeg", "image/png"];

export const DOCUMENT_SLOTS: Record<DocumentSlotKey, SlotSpec> = {
  docApplicantId: { code: "APPLICANT-ID", label: "Your CNIC / B-Form (front & back)", maxBytes: 5 * MB, types: ANY, maxFiles: 1 },
  docPhoto: { code: "PHOTO", label: "Recent photo", maxBytes: 2 * MB, types: ["image/jpeg", "image/png"], maxFiles: 1 },
  docAdmissionProof: { code: "ADMISSION-PROOF", label: "Admission letter or student card", maxBytes: 5 * MB, types: ANY, maxFiles: 1 },
  docFeeVoucher: { code: "FEE-VOUCHER", label: "Fee voucher for the term", maxBytes: 5 * MB, types: ANY, maxFiles: 1 },
  docRecommendation: {
    code: "RECOMMENDATION",
    label: "Recommendation letter from your pastor / priest",
    maxBytes: 5 * MB,
    types: ANY,
    maxFiles: 1,
  },
  docGuardianId: { code: "GUARDIAN-ID", label: "Father / mother / guardian CNIC", maxBytes: 5 * MB, types: ANY, maxFiles: 1 },
  docIncomeProof: { code: "INCOME-PROOF", label: "Income proof (salary slip / affidavit)", maxBytes: 5 * MB, types: ANY, maxFiles: 1 },
  docDeathCert: { code: "DEATH-CERT", label: "Death certificate", maxBytes: 5 * MB, types: ANY, maxFiles: 1 },
  docDisabilityCert: { code: "DISABILITY-CERT", label: "Disability certificate", maxBytes: 5 * MB, types: ANY, maxFiles: 1 },
  docOther: { code: "OTHER", label: "Anything else? (optional)", maxBytes: 5 * MB, types: ANY, maxFiles: 3 },
  resultDoc: { code: "RESULT", label: "Result document (optional)", maxBytes: 5 * MB, types: ANY, maxFiles: 1 },
};

export const SECTION_11_SLOTS: DocumentSlotKey[] = [
  "docApplicantId",
  "docPhoto",
  "docAdmissionProof",
  "docFeeVoucher",
  "docRecommendation",
  "docGuardianId",
  "docIncomeProof",
  "docDeathCert",
  "docDisabilityCert",
  "docOther",
];

const ENTRY_ID = /^[0-9a-f-]{36}$/;

/**
 * Firestore document id for an uploaded file. Result documents carry the result entry id;
 * other slots carry a 1-based index. Ids never contain applicant names or CNIC digits.
 */
export function documentId(slot: DocumentSlotKey, index: number, entryId?: string): string {
  if (slot === "resultDoc") {
    if (!entryId || !ENTRY_ID.test(entryId)) throw new Error("invalid-entry");
    return `resultDoc_${entryId}`;
  }
  return `${slot}_${index}`;
}

export function parseDocumentId(id: string): { slot: DocumentSlotKey; index: number; entryId?: string } | null {
  const result = /^resultDoc_([0-9a-f-]{36})$/.exec(id);
  if (result) return { slot: "resultDoc", index: 1, entryId: result[1] };
  const m = /^(doc[A-Za-z]+)_([1-3])$/.exec(id);
  if (!m || !(m[1] in DOCUMENT_SLOTS)) return null;
  const slot = m[1] as DocumentSlotKey;
  const index = Number(m[2]);
  if (index > DOCUMENT_SLOTS[slot].maxFiles) return null;
  return { slot, index };
}

/** Identifies the file type from its first bytes; the browser-reported type is not trusted. */
export function sniffMime(bytes: Uint8Array): DocumentMime | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return "application/pdf";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

export function extensionFor(mime: DocumentMime): string {
  return mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
}

export type FileCheck = { ok: true; mime: DocumentMime } | { ok: false; message: string };

export function checkFile(slot: DocumentSlotKey, bytes: Uint8Array): FileCheck {
  const spec = DOCUMENT_SLOTS[slot];
  if (bytes.length === 0) return { ok: false, message: "The file is empty." };
  if (bytes.length > spec.maxBytes) {
    return { ok: false, message: `The file is larger than ${Math.round(spec.maxBytes / (1024 * 1024))} MB.` };
  }
  const mime = sniffMime(bytes);
  if (!mime) return { ok: false, message: "Upload a PDF, JPG or PNG file." };
  if (!spec.types.includes(mime)) return { ok: false, message: "This document must be a JPG or PNG photo." };
  return { ok: true, mime };
}
