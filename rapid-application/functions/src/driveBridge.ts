import { createHmac, randomUUID } from "node:crypto";

export type BridgeUpload = {
  rootFolderId: string;
  applicationId: string;
  fileName: string;
  mime: string;
  sha256: string;
  dataBase64: string;
  /** Folder for a new application folder; an existing one stays where it is. */
  folder: string;
};

export type BridgeFetch = { rootFolderId: string; applicationId: string; fileId: string };
export type BridgeFile = { rootFolderId: string; applicationId: string; folder: string };

export type DriveBridge = {
  upload(p: BridgeUpload): Promise<{ fileId: string; created: boolean }>;
  fetch(p: BridgeFetch): Promise<{ mime: string; dataBase64: string }>;
  /** Moves the application folder to INTAKE, IA, RIA or RM. File ids are unchanged. */
  file(p: BridgeFile): Promise<{ folder: string; moved: boolean }>;
};

export class DriveBridgeError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "DriveBridgeError";
  }
}

export type BridgeConfig = { url: string; secret: string };

/** Signs a request body for the Apps Script bridge (see `drive-bridge/Code.gs`). */
export function signBridgeRequest(secret: string, action: string, params: object, now = Date.now()) {
  const payload = JSON.stringify({ action, ts: now, nonce: randomUUID(), ...params });
  const sig = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return JSON.stringify({ payload, sig });
}

async function call<T>(cfg: BridgeConfig, action: string, params: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: signBridgeRequest(cfg.secret, action, params),
      redirect: "follow",
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new DriveBridgeError("drive-unreachable");
  }
  if (!res.ok) throw new DriveBridgeError(`drive-http-${res.status}`);
  let body: { ok?: boolean; error?: string } & T;
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new DriveBridgeError("drive-bad-response");
  }
  if (!body.ok) throw new DriveBridgeError(body.error ?? "drive-error");
  return body;
}

export function httpDriveBridge(cfg: BridgeConfig): DriveBridge {
  return {
    upload: (p) => call(cfg, "upload", p),
    fetch: (p) => call(cfg, "fetch", p),
    file: (p) => call(cfg, "file", p),
  };
}
