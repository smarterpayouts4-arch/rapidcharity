import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { handleSetScholarshipType } from "./classify";
import { AppError, type Actor } from "./common";
import { handleGetDocument, handleSetVerification, handleUpload } from "./documents";
import type { DriveBridge } from "./driveBridge";
import { handleSubmit } from "./submitApplication";

export type Caller = Actor & { email: string | null; emailVerified: boolean };

export type ServerDeps = {
  db: Firestore;
  auth: Auth;
  bridge: () => DriveBridge;
  driveRootFolderId: () => string;
  duplicateSecret: () => string;
  staffEmails: () => string;
};

type Data = Record<string, unknown>;

/** Reads bridge settings only when Drive is used, so permission checks run first. */
function lazyBridge(d: ServerDeps): DriveBridge {
  return { upload: (p) => d.bridge().upload(p), fetch: (p) => d.bridge().fetch(p), file: (p) => d.bridge().file(p) };
}

/** Grants the `staff` claim to signed-in, verified emails listed in STAFF_EMAILS. */
async function claimStaffAccess(deps: ServerDeps, caller: Caller) {
  const email = caller.email?.toLowerCase();
  if (!email) throw new AppError("permission-denied", "Sign in required.");
  if (!caller.emailVerified) throw new AppError("permission-denied", "Verify your email first.");
  const allowed = new Set(
    deps
      .staffEmails()
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!allowed.has(email)) throw new AppError("permission-denied", "This account is not RAPID staff.");
  await deps.auth.setCustomUserClaims(caller.uid, { staff: true });
  return { ok: true };
}

/** Every server operation, shared by Cloud Functions (`index.ts`) and the Vercel preview (`api/rpc`). */
export const OPERATIONS = {
  submitScholarshipApplication: (d: ServerDeps, c: Caller, data: Data) => handleSubmit(d.db, c, data, d.duplicateSecret()),
  uploadScholarshipDocument: (d: ServerDeps, c: Caller, data: Data) => handleUpload(d.db, lazyBridge(d), d.driveRootFolderId(), c, data),
  getScholarshipDocument: (d: ServerDeps, c: Caller, data: Data) => handleGetDocument(d.db, lazyBridge(d), d.driveRootFolderId(), c, data),
  setScholarshipDocumentVerification: (d: ServerDeps, c: Caller, data: Data) => handleSetVerification(d.db, c, data),
  setScholarshipType: (d: ServerDeps, c: Caller, data: Data) => handleSetScholarshipType(d.db, lazyBridge(d), d.driveRootFolderId(), c, data),
  claimStaffAccess: (d: ServerDeps, c: Caller) => claimStaffAccess(d, c),
} as const;

export type OperationName = keyof typeof OPERATIONS;
