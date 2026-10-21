import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { AppError, type Actor } from "./common";
import { handleGetDocument, handleSetVerification, handleUpload } from "./documents";
import { httpDriveBridge } from "./driveBridge";
import { handleSubmit } from "./submitApplication";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const duplicateSecret = defineSecret("SCHOLARSHIP_DUPLICATE_HMAC_SECRET");
const bridgeSecret = defineSecret("DRIVE_BRIDGE_SECRET");
const bridgeUrl = defineString("DRIVE_BRIDGE_URL");
const driveRootFolderId = defineString("DRIVE_ROOT_FOLDER_ID");
const staffEmails = defineString("STAFF_EMAILS", { default: "" });

function actorOf(request: CallableRequest): Actor {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  return { uid: request.auth.uid, staff: request.auth.token.staff === true };
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) throw new HttpsError(err.code, err.message, err.details);
    if (err instanceof HttpsError) throw err;
    console.error("Unexpected function error", err instanceof Error ? err.name : "unknown");
    throw new HttpsError("internal", "Something went wrong. Please try again.");
  }
}

function bridge() {
  return httpDriveBridge({ url: bridgeUrl.value(), secret: bridgeSecret.value() });
}

export const submitScholarshipApplication = onCall({ secrets: [duplicateSecret] }, (request) =>
  run(() => handleSubmit(getFirestore(), actorOf(request), request.data ?? {}, duplicateSecret.value())),
);

export const uploadScholarshipDocument = onCall({ secrets: [bridgeSecret], timeoutSeconds: 120, memory: "512MiB" }, (request) =>
  run(() => handleUpload(getFirestore(), bridge(), driveRootFolderId.value(), actorOf(request), request.data ?? {})),
);

export const getScholarshipDocument = onCall({ secrets: [bridgeSecret], timeoutSeconds: 120, memory: "512MiB" }, (request) =>
  run(() => handleGetDocument(getFirestore(), bridge(), driveRootFolderId.value(), actorOf(request), request.data ?? {})),
);

export const setScholarshipDocumentVerification = onCall((request) =>
  run(() => handleSetVerification(getFirestore(), actorOf(request), request.data ?? {})),
);

/** Grants the `staff` claim to signed-in, verified emails listed in STAFF_EMAILS. */
export const claimStaffAccess = onCall(async (request) => {
  const email = request.auth?.token.email?.toLowerCase();
  if (!request.auth || !email) throw new HttpsError("unauthenticated", "Sign in required.");
  if (request.auth.token.email_verified !== true) throw new HttpsError("permission-denied", "Verify your email first.");
  const allowed = new Set(
    staffEmails
      .value()
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!allowed.has(email)) throw new HttpsError("permission-denied", "This account is not RAPID staff.");
  await getAuth().setCustomUserClaims(request.auth.uid, { staff: true });
  return { ok: true };
});
