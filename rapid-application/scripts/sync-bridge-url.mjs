/**
 * Copies DRIVE_BRIDGE_URL from functions/.secret.live.local into Vercel Preview env.
 * Does not print the URL or any secret. Usage: node scripts/sync-bridge-url.mjs
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const settings = Object.fromEntries(
  readFileSync("functions/.secret.live.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = settings.DRIVE_BRIDGE_URL ?? "";
if (!url.startsWith("https://script.google.com/")) {
  console.error("Set DRIVE_BRIDGE_URL in functions/.secret.live.local first (https://script.google.com/...).");
  process.exit(2);
}
const child = spawnSync("npx", ["--yes", "vercel@latest", "env", "add", "DRIVE_BRIDGE_URL", "preview", "--force"], {
  input: url,
  encoding: "utf8",
  shell: true,
});
if (child.status !== 0) {
  console.error("Could not update Vercel DRIVE_BRIDGE_URL.");
  process.exit(child.status ?? 1);
}
console.log("Vercel preview DRIVE_BRIDGE_URL updated (length " + url.length + "). Redeploy with npm run deploy:preview.");
