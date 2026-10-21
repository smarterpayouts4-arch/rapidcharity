import { execSync } from "node:child_process";

/**
 * Helpers for the preview tests, which run against the deployed Vercel preview and the real
 * Firebase test project. They use the tester's own gcloud login (project owner) to create
 * sign-in links without sending email and to read Firestore for checks. Fictional data only.
 */
export const PROJECT = "rapid-cc35e";
export const API_KEY = "AIzaSyDbwCRMFYfg9FqmloTfgXLlvzYGd9xTchg";

let cached: { token: string; at: number } | null = null;
function token(): string {
  if (!cached || Date.now() - cached.at > 30 * 60 * 1000) {
    cached = { token: execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim(), at: Date.now() };
  }
  return cached.token;
}

async function google<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "x-goog-user-project": PROJECT, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${url.split("?")[0]} -> ${res.status}`);
  return (await res.json()) as T;
}

/** Returns the oobCode of an email sign-in link without sending any email. */
export async function signInCode(email: string, continueUrl: string): Promise<string> {
  const out = await google<{ oobLink: string }>(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:sendOobCode`, {
    method: "POST",
    body: JSON.stringify({ requestType: "EMAIL_SIGNIN", email, continueUrl, returnOobLink: true }),
  });
  return new URL(out.oobLink).searchParams.get("oobCode")!;
}

type Value = Record<string, unknown>;
function toValue(v: unknown): Value {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, toValue(x)])) } };
}
function fromValue(v: Value): unknown {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("arrayValue" in v) return ((v.arrayValue as { values?: Value[] }).values ?? []).map(fromValue);
  if ("mapValue" in v) return fromFields((v.mapValue as { fields?: Record<string, Value> }).fields ?? {});
  return undefined;
}
function fromFields(fields: Record<string, Value>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, x]) => [k, fromValue(x)]));
}

const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

export async function getDoc(path: string): Promise<Record<string, unknown>> {
  const doc = await google<{ fields?: Record<string, Value> }>(`${DOCS}/${path}`);
  return fromFields(doc.fields ?? {});
}

export async function listDocs(path: string): Promise<Record<string, unknown>[]> {
  const out = await google<{ documents?: { fields?: Record<string, Value> }[] }>(`${DOCS}/${path}?pageSize=100`);
  return (out.documents ?? []).map((d) => fromFields(d.fields ?? {}));
}

/** Writes the given top-level fields only (Firestore REST update mask). */
export async function patchDoc(path: string, data: Record<string, unknown>): Promise<void> {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  await google(`${DOCS}/${path}?${mask}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
  });
}
