import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Local stand-in for `drive-bridge/Code.gs` with the same request checks and folder layout
 * (`root/{INTAKE|IA|RIA|RM}/{applicationId}`), used by integration and end-to-end tests.
 * Files live in memory; nothing reaches Google Drive.
 */
export type FakeFile = { fileId: string; folder: string; name: string; mime: string; bytes: Buffer };

const FOLDERS = ["INTAKE", "IA", "RIA", "RM"];

export function createFakeDriveBridge(opts: { secret: string; allowedRoots: string[] }) {
  const files: FakeFile[] = [];
  /** `${root}/${applicationId}` → bucket, mirroring where the application folder sits. */
  const placement = new Map<string, string>();
  const nonces = new Set<string>();
  const state = { failNextUploads: 0, requests: 0 };

  function handle(raw: string): Record<string, unknown> {
    const envelope = JSON.parse(raw || "{}") as { payload?: string; sig?: string };
    if (typeof envelope.payload !== "string" || typeof envelope.sig !== "string") return { ok: false, error: "bad-request" };
    const expected = createHmac("sha256", opts.secret).update(envelope.payload, "utf8").digest();
    const given = Buffer.from(envelope.sig, "hex");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, error: "bad-signature" };
    const req = JSON.parse(envelope.payload) as Record<string, string> & { ts: number };
    if (Math.abs(Date.now() - req.ts) > 5 * 60 * 1000) return { ok: false, error: "expired" };
    if (nonces.has(req.nonce)) return { ok: false, error: "replayed" };
    nonces.add(req.nonce);
    if (req.action === "ping") return { ok: true };
    if (!opts.allowedRoots.includes(req.rootFolderId)) return { ok: false, error: "root-not-allowed" };
    const key = `${req.rootFolderId}/${req.applicationId}`;
    const folderOf = (bucket: string) => `${req.rootFolderId}/${bucket}/${req.applicationId}`;
    const current = placement.get(key);

    if (req.action === "upload") {
      if (state.failNextUploads > 0) {
        state.failNextUploads -= 1;
        return { ok: false, error: "simulated-drive-outage" };
      }
      if (!/^[A-Z0-9-]{2,48}-[1-3]-[0-9a-f]{16}\.(pdf|jpg|png)$/.test(req.fileName)) return { ok: false, error: "bad-name" };
      const bucket = current ?? req.folder ?? "INTAKE";
      if (!FOLDERS.includes(bucket)) return { ok: false, error: "bad-folder" };
      const bytes = Buffer.from(req.dataBase64, "base64");
      if (createHash("sha256").update(bytes).digest("hex") !== req.sha256) return { ok: false, error: "checksum-mismatch" };
      placement.set(key, bucket);
      const existing = files.find((f) => f.folder === folderOf(bucket) && f.name === req.fileName);
      if (existing) return { ok: true, fileId: existing.fileId, created: false };
      const file = { fileId: `fake_${randomUUID().replace(/-/g, "")}`, folder: folderOf(bucket), name: req.fileName, mime: req.mime, bytes };
      files.push(file);
      return { ok: true, fileId: file.fileId, created: true };
    }
    if (req.action === "fetch") {
      const file = current ? files.find((f) => f.fileId === req.fileId && f.folder === folderOf(current)) : undefined;
      if (!file) return { ok: false, error: "not-found" };
      return { ok: true, mime: file.mime, dataBase64: file.bytes.toString("base64") };
    }
    if (req.action === "file") {
      if (!FOLDERS.includes(req.folder)) return { ok: false, error: "bad-folder" };
      if (!current || current === req.folder) return { ok: true, folder: req.folder, moved: false };
      for (const f of files) if (f.folder === folderOf(current)) f.folder = folderOf(req.folder);
      placement.set(key, req.folder);
      return { ok: true, folder: req.folder, moved: true };
    }
    return { ok: false, error: "unknown-action" };
  }

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/__files") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(files.map((f) => ({ fileId: f.fileId, folder: f.folder, name: f.name, size: f.bytes.length }))));
      return;
    }
    if (req.method === "GET" && req.url === "/__health") {
      res.writeHead(200);
      res.end("ok");
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      state.requests += 1;
      let out: Record<string, unknown>;
      try {
        out = handle(body);
      } catch {
        out = { ok: false, error: "bad-request" };
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(out));
    });
  });

  return {
    files,
    placement,
    state,
    async listen(port = 0): Promise<string> {
      await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
      return `http://127.0.0.1:${(server.address() as AddressInfo).port}/exec`;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
