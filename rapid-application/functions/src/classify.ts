import type { Firestore } from "firebase-admin/firestore";
import { SCHOLARSHIP_TYPES, type DriveFolder, type ScholarshipApplication, type ScholarshipType } from "../../src/types/application";
import { APPLICATION_ID, AppError, audit, type Actor } from "./common";
import type { DriveBridge } from "./driveBridge";

/**
 * Staff-only: records the scholarship type (IA, RIA, RM, or null for unassigned) and files the
 * application's Drive folder under the matching folder. Firestore is written first and is
 * authoritative; `driveFolder` only changes once Drive confirms the move, so a failed move shows
 * as "filing pending" and choosing the type again retries it.
 */
export async function handleSetScholarshipType(
  db: Firestore,
  bridge: DriveBridge,
  rootFolderId: string,
  actor: Actor,
  input: { applicationId?: unknown; scholarshipType?: unknown },
  now = Date.now(),
): Promise<{ scholarshipType: ScholarshipType | null; driveFolder: DriveFolder }> {
  if (!actor.staff) throw new AppError("permission-denied", "Staff only.");
  const applicationId = typeof input.applicationId === "string" ? input.applicationId : "";
  if (!APPLICATION_ID.test(applicationId)) throw new AppError("invalid-argument", "Unknown application.");
  const type = input.scholarshipType ?? null;
  if (type !== null && !SCHOLARSHIP_TYPES.includes(type as ScholarshipType)) {
    throw new AppError("invalid-argument", "Choose IA, RIA or RM.");
  }
  const scholarshipType = type as ScholarshipType | null;
  const target: DriveFolder = scholarshipType ?? "INTAKE";

  const ref = db.collection("scholarshipApplications").doc(applicationId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("not-found", "Application not found.");
    const app = snap.data() as ScholarshipApplication;
    if (app.status !== "submitted") throw new AppError("failed-precondition", "Only submitted applications can be classified.");
    tx.update(ref, { scholarshipType, classifiedBy: actor.uid, classifiedAt: now });
  });
  await audit(db, { action: "application.classified", applicationId, actorUid: actor.uid, at: now, detail: scholarshipType ?? "unassigned" });

  try {
    await bridge.file({ rootFolderId, applicationId, folder: target });
  } catch {
    throw new AppError("unavailable", "Saved, but Google Drive did not move the documents yet. Choose the type again to retry.");
  }

  return db.runTransaction(async (tx) => {
    const app = (await tx.get(ref)).data() as ScholarshipApplication;
    // Another staff member may have changed the type meanwhile; only record what Drive now holds.
    if ((app.scholarshipType ?? null) === scholarshipType) tx.update(ref, { driveFolder: target });
    return { scholarshipType: app.scholarshipType ?? null, driveFolder: (app.scholarshipType ?? null) === scholarshipType ? target : app.driveFolder };
  });
}
