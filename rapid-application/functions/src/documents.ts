import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import {
  DOCUMENT_SLOTS,
  checkFile,
  documentId as makeDocumentId,
  extensionFor,
  parseDocumentId,
  type DocumentSlotKey,
} from "../../src/lib/form/documents";
import type { DocumentRecord, ScholarshipApplication } from "../../src/types/application";
import { APPLICATION_ID, AppError, assertCycleOpen, audit, type Actor } from "./common";
import { DriveBridgeError, type DriveBridge } from "./driveBridge";

export type UploadInput = {
  applicationId?: unknown;
  slot?: unknown;
  index?: unknown;
  entryId?: unknown;
  label?: unknown;
  dataBase64?: unknown;
};

const MAX_BASE64_CHARS = Math.ceil((5 * 1024 * 1024 * 4) / 3) + 8;

function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function resultEntryExists(app: ScholarshipApplication, entryId: string): boolean {
  const terms = app.sections?.s6_terms?.termResults ?? [];
  const prior = app.sections?.s7_prior?.priorEducation ?? [];
  return [...terms, ...prior].some((e) => e.id === entryId);
}

/**
 * Stores one applicant document in the private Drive folder and records its metadata.
 * Safe to retry: the same file for the same slot maps to the same Drive file name, and the
 * bridge returns the existing file instead of creating a second copy.
 */
export async function handleUpload(
  db: Firestore,
  bridge: DriveBridge,
  rootFolderId: string,
  actor: Actor,
  input: UploadInput,
  now = Date.now(),
): Promise<{ documentId: string; uploadStatus: "stored"; alreadyStored: boolean }> {
  const applicationId = typeof input.applicationId === "string" ? input.applicationId : "";
  const slot = typeof input.slot === "string" ? input.slot : "";
  const index = typeof input.index === "number" ? input.index : 1;
  const entryId = typeof input.entryId === "string" ? input.entryId : undefined;
  const label = typeof input.label === "string" ? input.label.trim() : "";
  const data = typeof input.dataBase64 === "string" ? input.dataBase64 : "";

  if (!APPLICATION_ID.test(applicationId)) throw new AppError("invalid-argument", "Unknown application.");
  if (!(slot in DOCUMENT_SLOTS)) throw new AppError("invalid-argument", "Unknown document type.");
  const slotKey = slot as DocumentSlotKey;
  const spec = DOCUMENT_SLOTS[slotKey];
  if (!Number.isInteger(index) || index < 1 || index > spec.maxFiles) throw new AppError("invalid-argument", "Invalid file number.");
  if (label.length > 60) throw new AppError("invalid-argument", "Keep the label under 60 characters.");
  if (slotKey === "docOther" && label.length < 2) throw new AppError("invalid-argument", "Give the extra document a short label.");
  if (!data || data.length > MAX_BASE64_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new AppError("invalid-argument", "The file could not be read or is too large.");
  }

  let docId: string;
  try {
    docId = makeDocumentId(slotKey, index, entryId);
  } catch {
    throw new AppError("invalid-argument", "Unknown result entry.");
  }

  const appRef = db.collection("scholarshipApplications").doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) throw new AppError("not-found", "Application not found.");
  const app = appSnap.data() as ScholarshipApplication;
  if (app.ownerUid !== actor.uid) throw new AppError("permission-denied", "Not allowed.");
  if (app.status !== "draft") throw new AppError("failed-precondition", "This application has already been submitted.");
  await assertCycleOpen(db, app.cycleId, now);
  if (slotKey === "resultDoc" && (!entryId || !resultEntryExists(app, entryId))) {
    throw new AppError("invalid-argument", "Save the result entry before attaching its document.");
  }

  const bytes = Buffer.from(data, "base64");
  const check = checkFile(slotKey, new Uint8Array(bytes));
  if (!check.ok) throw new AppError("invalid-argument", check.message);

  const sha256 = sha256Hex(bytes);
  const uploadKey = sha256Hex(`${applicationId}|${docId}|${sha256}`).slice(0, 16);
  const code = slotKey === "resultDoc" ? `RESULT-${entryId!.slice(0, 8).toUpperCase()}` : spec.code;
  const fileName = `${code}-${index}-${uploadKey}.${extensionFor(check.mime)}`;
  const docRef = appRef.collection("documents").doc(docId);

  const reserved = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const prev = snap.exists ? (snap.data() as DocumentRecord) : null;
    if (prev && prev.uploadKey === uploadKey && prev.uploadStatus === "stored") return { alreadyStored: true };
    const replaced = [...(prev?.replacedDriveFileIds ?? [])];
    if (prev?.driveFileId && prev.uploadKey !== uploadKey) replaced.push(prev.driveFileId);
    const record: DocumentRecord = {
      documentId: docId,
      applicationId,
      slot: slotKey,
      index,
      entryId: entryId ?? null,
      typeCode: spec.code,
      label: slotKey === "docOther" ? label : spec.label,
      contentType: check.mime,
      sizeBytes: bytes.length,
      sha256,
      uploadKey,
      uploadStatus: "uploading",
      driveFileId: prev?.uploadKey === uploadKey ? prev.driveFileId : null,
      replacedDriveFileIds: replaced,
      verificationStatus: "pending",
      verificationNote: "",
      verifiedBy: null,
      verifiedAt: null,
      uploadedAt: now,
    };
    tx.set(docRef, record);
    return { alreadyStored: false };
  });
  if (reserved.alreadyStored) return { documentId: docId, uploadStatus: "stored", alreadyStored: true };

  let stored: { fileId: string; created: boolean };
  try {
    stored = await bridge.upload({
      rootFolderId,
      applicationId,
      fileName,
      mime: check.mime,
      sha256,
      dataBase64: bytes.toString("base64"),
    });
  } catch (err) {
    const code = err instanceof DriveBridgeError ? err.code : "drive-error";
    await audit(db, { action: "document.upload_failed", applicationId, documentId: docId, actorUid: actor.uid, at: now, detail: code });
    throw new AppError("unavailable", "The document could not be saved right now. Please try again.");
  }

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const current = snap.data() as DocumentRecord | undefined;
    if (current?.uploadKey === uploadKey) {
      tx.update(docRef, { uploadStatus: "stored", driveFileId: stored.fileId });
    } else if (current) {
      // A different file was chosen for this slot while this upload was in flight.
      tx.update(docRef, { replacedDriveFileIds: [...current.replacedDriveFileIds, stored.fileId] });
    }
  });
  await audit(db, {
    action: "document.uploaded",
    applicationId,
    documentId: docId,
    actorUid: actor.uid,
    at: now,
    detail: stored.created ? "created" : "existing-drive-file",
  });
  return { documentId: docId, uploadStatus: "stored", alreadyStored: !stored.created };
}

async function loadStoredDocument(db: Firestore, applicationId: unknown, documentId: unknown) {
  if (typeof applicationId !== "string" || !APPLICATION_ID.test(applicationId)) throw new AppError("invalid-argument", "Unknown application.");
  if (typeof documentId !== "string" || !parseDocumentId(documentId)) throw new AppError("invalid-argument", "Unknown document.");
  const ref = db.collection("scholarshipApplications").doc(applicationId).collection("documents").doc(documentId);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("not-found", "Document not found.");
  const record = snap.data() as DocumentRecord;
  if (record.uploadStatus !== "stored" || !record.driveFileId) throw new AppError("failed-precondition", "This document was not stored.");
  return { ref, record, applicationId, documentId };
}

/** Staff-only: streams a private Drive file through the function. No sharing link is ever created. */
export async function handleGetDocument(
  db: Firestore,
  bridge: DriveBridge,
  rootFolderId: string,
  actor: Actor,
  input: { applicationId?: unknown; documentId?: unknown },
  now = Date.now(),
): Promise<{ contentType: string; dataBase64: string; label: string }> {
  if (!actor.staff) throw new AppError("permission-denied", "Staff only.");
  const { record, applicationId, documentId } = await loadStoredDocument(db, input.applicationId, input.documentId);
  let file: { mime: string; dataBase64: string };
  try {
    file = await bridge.fetch({ rootFolderId, applicationId, fileId: record.driveFileId! });
  } catch {
    throw new AppError("unavailable", "Google Drive did not return the file. Try again.");
  }
  await audit(db, { action: "document.viewed", applicationId, documentId, actorUid: actor.uid, at: now });
  return { contentType: file.mime, dataBase64: file.dataBase64, label: record.label };
}

export async function handleSetVerification(
  db: Firestore,
  actor: Actor,
  input: { applicationId?: unknown; documentId?: unknown; decision?: unknown; note?: unknown },
  now = Date.now(),
): Promise<{ verificationStatus: "verified" | "rejected" }> {
  if (!actor.staff) throw new AppError("permission-denied", "Staff only.");
  const decision = input.decision;
  if (decision !== "verified" && decision !== "rejected") throw new AppError("invalid-argument", "Choose verify or reject.");
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 300) throw new AppError("invalid-argument", "Keep the note under 300 characters.");
  if (decision === "rejected" && note.length < 3) throw new AppError("invalid-argument", "Say why the document is rejected.");
  const { ref, applicationId, documentId } = await loadStoredDocument(db, input.applicationId, input.documentId);
  const app = (await db.collection("scholarshipApplications").doc(applicationId).get()).data() as ScholarshipApplication;
  if (app.status !== "submitted") throw new AppError("failed-precondition", "Only submitted applications can be verified.");
  await ref.update({ verificationStatus: decision, verificationNote: note, verifiedBy: actor.uid, verifiedAt: now });
  await audit(db, { action: `document.${decision}`, applicationId, documentId, actorUid: actor.uid, at: now });
  return { verificationStatus: decision };
}
