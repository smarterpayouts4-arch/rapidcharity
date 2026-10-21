import { httpsCallable } from "firebase/functions";
import { getFirebaseAuth, getFirebaseFunctions } from "./client";

/** Same shape as a Firebase `FunctionsError`, so callers handle both back ends alike. */
export class ServerError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ServerError";
  }
}

const useVercelApi = import.meta.env.VITE_SERVER_API === "vercel";

/**
 * Runs a server operation: Cloud Functions locally (emulator), or `/api/rpc` on the Vercel preview,
 * which runs the same handlers (see functions/src/rpc.ts).
 */
export async function callServer<T>(op: string, data: object, timeoutMs = 70_000): Promise<T> {
  if (!useVercelApi) {
    const { data: result } = await httpsCallable<object, T>(getFirebaseFunctions(), op, { timeout: timeoutMs })(data);
    return result;
  }
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new ServerError("functions/unauthenticated", "Sign in required.");
  let res: Response;
  try {
    res = await fetch("/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify({ op, data }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ServerError("functions/unavailable", "Could not reach the server. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as { result?: T; error?: { code: string; message: string; details?: unknown } };
  if (!res.ok || body.error) {
    const e = body.error ?? { code: "internal", message: "Something went wrong. Please try again." };
    throw new ServerError(`functions/${e.code}`, e.message, e.details);
  }
  return body.result as T;
}
