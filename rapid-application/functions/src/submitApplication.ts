import { randomBytes } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { clearHiddenAnswers, manualEntries, validateDocuments, validateSections } from "../../src/lib/form/rules";
import type { DocumentRecord, ScholarshipApplication } from "../../src/types/application";
import { APPLICATION_ID, AppError, assertCycleOpen, audit, type Actor } from "./common";
import { duplicateKeyId, normalizeCnicDigits } from "./duplicateKey";

const RECEIPT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function receiptCode(cycleId: string): string {
  const year = cycleId.match(/\d{4}/)?.[0] ?? "0000";
  const bytes = randomBytes(8);
  const opaque = Array.from(bytes, (b) => RECEIPT_ALPHABET[b % RECEIPT_ALPHABET.length]).join("");
  return `RAPID-${year}-${opaque}`;
}

function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("92") ? `+${digits}` : `+92${digits.replace(/^0/, "")}`;
}

/**
 * Validates the stored draft (not a client-sent copy), reserves the CNIC for the cycle and marks the
 * application submitted, all in one transaction. Calling it again after success returns the same receipt.
 */
export async function handleSubmit(
  db: Firestore,
  actor: Actor,
  input: { applicationId?: unknown },
  duplicateSecret: string,
  now = Date.now(),
): Promise<{ receiptCode: string; submittedAt: number; alreadySubmitted: boolean }> {
  const applicationId = typeof input.applicationId === "string" ? input.applicationId : "";
  if (!APPLICATION_ID.test(applicationId)) throw new AppError("invalid-argument", "Unknown application.");
  const appRef = db.collection("scholarshipApplications").doc(applicationId);

  const first = await appRef.get();
  if (!first.exists) throw new AppError("not-found", "Application not found.");
  const app = first.data() as ScholarshipApplication;
  if (app.ownerUid !== actor.uid) throw new AppError("permission-denied", "Not allowed.");
  if (app.status === "submitted" && app.receiptCode) {
    return { receiptCode: app.receiptCode, submittedAt: app.submittedAt!, alreadySubmitted: true };
  }
  await assertCycleOpen(db, app.cycleId, now);

  const sections = clearHiddenAnswers(app.sections);
  sections.s2_contact.email = String(sections.s2_contact.email ?? "").trim().toLowerCase();
  sections.s2_contact.mobile = normalizeMobile(String(sections.s2_contact.mobile ?? ""));
  const documents = (await appRef.collection("documents").get()).docs.map((d) => d.data() as DocumentRecord);
  const issues = [...validateSections(sections).issues, ...validateDocuments(sections, documents)];
  if (issues.length) {
    throw new AppError(
      "failed-precondition",
      "Some answers need attention before you can submit.",
      issues.map(({ section, key, message }) => ({ section, key, message })),
    );
  }

  const cnicDigits = normalizeCnicDigits(String(sections.s1_about.cnic ?? ""));
  const dupRef = db.collection("scholarshipDuplicateKeys").doc(duplicateKeyId(app.cycleId, cnicDigits, duplicateSecret));
  const manual = manualEntries(sections);
  const code = receiptCode(app.cycleId);

  const outcome = await db.runTransaction(async (tx) => {
    const appSnap = await tx.get(appRef);
    const current = appSnap.data() as ScholarshipApplication;
    if (current.status === "submitted" && current.receiptCode) {
      return { receiptCode: current.receiptCode, submittedAt: current.submittedAt!, alreadySubmitted: true };
    }
    if (current.updatedAt !== app.updatedAt) throw new AppError("failed-precondition", "Your answers changed while submitting. Please submit again.");
    const dupSnap = await tx.get(dupRef);
    if (dupSnap.exists && dupSnap.get("applicationId") !== applicationId) {
      throw new AppError("already-exists", "An application with this CNIC / B-Form number has already been submitted for this round.");
    }
    tx.set(dupRef, { applicationId, cycleId: app.cycleId, createdAt: now });
    tx.update(appRef, {
      status: "submitted",
      receiptCode: code,
      submittedAt: now,
      updatedAt: now,
      sections,
      needsReview: manual.length > 0,
    });
    for (const item of manual) {
      tx.set(db.collection("scholarshipCatalogReview").doc(`${applicationId}_${item.fieldKey}`), {
        ...item,
        applicationId,
        cycleId: app.cycleId,
        status: "pending",
        createdAt: now,
      });
    }
    return { receiptCode: code, submittedAt: now, alreadySubmitted: false };
  });

  if (!outcome.alreadySubmitted) {
    await audit(db, { action: "application.submitted", applicationId, actorUid: actor.uid, at: now });
  }
  return outcome;
}
