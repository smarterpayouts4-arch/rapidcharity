/**
 * Starts the local test stack: Firebase emulators (auth, firestore, functions) plus the fake Drive
 * bridge on port 5199. The bridge's /__health answers only after the emulators are ready and the
 * Spring 2027 round is seeded, so Playwright can wait on it.
 */
import { randomBytes } from "node:crypto";
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createFakeDriveBridge } from "../../tests/support/fakeDriveBridge";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROJECT = "demo-rapid-scholarship";
const secretFile = path.join(root, "functions", ".secret.local");

function emulatorSecrets(): string {
  if (!fs.existsSync(secretFile)) {
    const value = () => randomBytes(32).toString("hex");
    fs.writeFileSync(secretFile, `DRIVE_BRIDGE_SECRET=${value()}\nSCHOLARSHIP_DUPLICATE_HMAC_SECRET=${value()}\n`);
  }
  const match = /^DRIVE_BRIDGE_SECRET=(.+)$/m.exec(fs.readFileSync(secretFile, "utf8"));
  if (!match) throw new Error("DRIVE_BRIDGE_SECRET missing from functions/.secret.local");
  return match[1]!.trim();
}

async function waitFor(url: string, timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const secret = emulatorSecrets();
execSync("npm --prefix functions run build", { cwd: root, stdio: "inherit" });

const emulators = spawn(`npx --yes firebase-tools@14 emulators:start --only auth,firestore,functions --project ${PROJECT}`, {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
const stop = () => {
  emulators.kill("SIGINT");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
emulators.on("exit", (code) => process.exit(code ?? 1));

await waitFor("http://127.0.0.1:8080/", 180_000);
await waitFor("http://127.0.0.1:9099/", 60_000);
await waitFor(`http://127.0.0.1:5001/${PROJECT}/us-central1/submitScholarshipApplication`, 120_000);

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const db = getFirestore(initializeApp({ projectId: PROJECT }));
await db.doc("scholarshipCycles/spring-2027").set({
  cycleId: "spring-2027",
  label: "Spring 2027",
  open: true,
  deadlineAt: null,
  catalogVersion: "2026-10-21",
  formVersion: "2026-10-21",
  schemaVersion: "1.0.0",
});

const bridge = createFakeDriveBridge({ secret, allowedRoots: ["emulator-test-root"] });
await bridge.listen(5199);
console.log("[stack] ready: emulators up, cycle seeded, fake Drive bridge on :5199");
