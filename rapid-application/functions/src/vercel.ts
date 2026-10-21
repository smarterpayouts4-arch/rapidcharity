import type { IncomingMessage, ServerResponse } from "node:http";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { AppError } from "./common";
import { httpDriveBridge } from "./driveBridge";
import { OPERATIONS, type OperationName, type ServerDeps } from "./rpc";

/**
 * Vercel preview entry point: `POST /api/rpc` with `{ op, data }` and the caller's Firebase ID token
 * as a Bearer token. Runs the same handlers as the Cloud Functions in `index.ts`.
 * Settings come from Vercel environment variables (see docs/preview-environment.md).
 */

const MAX_BODY_BYTES = 4_400_000;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing-env-${name}`);
  return value;
}

function app() {
  if (getApps().length) return getApps()[0]!;
  const account = JSON.parse(Buffer.from(env("FIREBASE_SERVICE_ACCOUNT_BASE64"), "base64").toString("utf8"));
  return initializeApp({ credential: cert(account), projectId: account.project_id });
}

function deps(): ServerDeps {
  const a = app();
  return {
    db: getFirestore(a),
    auth: getAuth(a),
    bridge: () => httpDriveBridge({ url: env("DRIVE_BRIDGE_URL"), secret: env("DRIVE_BRIDGE_SECRET") }),
    driveRootFolderId: () => env("DRIVE_ROOT_FOLDER_ID"),
    duplicateSecret: () => env("SCHOLARSHIP_DUPLICATE_HMAC_SECRET"),
    staffEmails: () => process.env.STAFF_EMAILS ?? "",
  };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function fail(res: ServerResponse, status: number, code: string, message: string, details?: unknown) {
  send(res, status, { error: { code, message, details } });
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new AppError("invalid-argument", "The file is too large.");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const STATUS: Record<AppError["code"], number> = {
  "invalid-argument": 400,
  "permission-denied": 403,
  "not-found": 404,
  "failed-precondition": 412,
  "already-exists": 409,
  unavailable: 503,
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") return fail(res, 405, "invalid-argument", "POST only.");
  try {
    const parsed = JSON.parse((await readBody(req)) || "{}") as { op?: unknown; data?: unknown };
    const op = typeof parsed.op === "string" && parsed.op in OPERATIONS ? (parsed.op as OperationName) : null;
    if (!op) return fail(res, 404, "not-found", "Unknown operation.");

    const header = req.headers.authorization ?? "";
    const idToken = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!idToken) return fail(res, 401, "unauthenticated", "Sign in required.");
    const d = deps();
    let token;
    try {
      token = await d.auth.verifyIdToken(idToken, true);
    } catch {
      return fail(res, 401, "unauthenticated", "Sign in again.");
    }
    const caller = { uid: token.uid, staff: token.staff === true, email: token.email ?? null, emailVerified: token.email_verified === true };
    const data = parsed.data && typeof parsed.data === "object" ? (parsed.data as Record<string, unknown>) : {};
    return send(res, 200, { result: await OPERATIONS[op](d, caller, data) });
  } catch (err) {
    if (err instanceof AppError) return fail(res, STATUS[err.code], err.code, err.message, err.details);
    console.error("Unexpected rpc error", err instanceof Error ? err.message.replace(/[^\w-]/g, " ").slice(0, 80) : "unknown");
    return fail(res, 500, "internal", "Something went wrong. Please try again.");
  }
}
