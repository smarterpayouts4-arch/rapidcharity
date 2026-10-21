import type { Firestore } from "firebase-admin/firestore";

export class AppError extends Error {
  constructor(
    public code: "invalid-argument" | "permission-denied" | "not-found" | "failed-precondition" | "already-exists" | "unavailable",
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const APPLICATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type Actor = { uid: string; staff: boolean };

export async function assertCycleOpen(db: Firestore, cycleId: string, now: number): Promise<void> {
  const snap = await db.collection("scholarshipCycles").doc(cycleId).get();
  if (!snap.exists) throw new AppError("failed-precondition", "This application round is not set up yet.");
  const cycle = snap.data() as { open?: boolean; deadlineAt?: string | null };
  if (!cycle.open) throw new AppError("failed-precondition", "Applications for this round are closed.");
  if (cycle.deadlineAt && now > Date.parse(cycle.deadlineAt)) {
    throw new AppError("failed-precondition", "The deadline for this round has passed.");
  }
}

export async function audit(
  db: Firestore,
  entry: { action: string; applicationId: string; actorUid: string; at: number; documentId?: string; detail?: string },
): Promise<void> {
  await db.collection("scholarshipAudit").add(entry);
}
