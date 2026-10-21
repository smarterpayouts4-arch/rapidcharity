import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, type CallableOptions, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { AppError } from "./common";
import { httpDriveBridge } from "./driveBridge";
import { OPERATIONS, type Caller, type OperationName, type ServerDeps } from "./rpc";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const duplicateSecret = defineSecret("SCHOLARSHIP_DUPLICATE_HMAC_SECRET");
const bridgeSecret = defineSecret("DRIVE_BRIDGE_SECRET");
const bridgeUrl = defineString("DRIVE_BRIDGE_URL");
const driveRootFolderId = defineString("DRIVE_ROOT_FOLDER_ID");
const staffEmails = defineString("STAFF_EMAILS", { default: "" });

function deps(): ServerDeps {
  return {
    db: getFirestore(),
    auth: getAuth(),
    bridge: () => httpDriveBridge({ url: bridgeUrl.value(), secret: bridgeSecret.value() }),
    driveRootFolderId: () => driveRootFolderId.value(),
    duplicateSecret: () => duplicateSecret.value(),
    staffEmails: () => staffEmails.value(),
  };
}

function callerOf(request: CallableRequest): Caller {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const token = request.auth.token;
  return { uid: request.auth.uid, staff: token.staff === true, email: token.email ?? null, emailVerified: token.email_verified === true };
}

function callable(name: OperationName, options: CallableOptions = {}) {
  return onCall(options, async (request) => {
    try {
      return await OPERATIONS[name](deps(), callerOf(request), (request.data ?? {}) as Record<string, unknown>);
    } catch (err) {
      if (err instanceof AppError) throw new HttpsError(err.code, err.message, err.details);
      if (err instanceof HttpsError) throw err;
      console.error("Unexpected function error", err instanceof Error ? err.name : "unknown");
      throw new HttpsError("internal", "Something went wrong. Please try again.");
    }
  });
}

const drive = { secrets: [bridgeSecret], timeoutSeconds: 120, memory: "512MiB" as const };

export const submitScholarshipApplication = callable("submitScholarshipApplication", { secrets: [duplicateSecret] });
export const uploadScholarshipDocument = callable("uploadScholarshipDocument", drive);
export const getScholarshipDocument = callable("getScholarshipDocument", drive);
export const setScholarshipDocumentVerification = callable("setScholarshipDocumentVerification");
export const setScholarshipType = callable("setScholarshipType", drive);
export const claimStaffAccess = callable("claimStaffAccess");
