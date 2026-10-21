import { createHmac } from "node:crypto";

export function normalizeCnicDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 13);
}

/** Opaque per-cycle key so the CNIC itself is never used as a document id. */
export function duplicateKeyId(cycleId: string, cnicDigits: string, secret: string): string {
  if (secret.length < 16) throw new Error("duplicate-secret-missing");
  const h = createHmac("sha256", secret).update(`${cycleId}:${cnicDigits}`).digest("hex");
  return h.slice(0, 40);
}
