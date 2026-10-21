/**
 * Sets DRIVE_BRIDGE_URL in functions/.secret.live.local, preserving BRIDGE_SECRET.
 * Usage (paste URL only in your terminal, not in chat):
 *   node scripts/set-drive-bridge-url.mjs "https://script.google.com/macros/s/.../exec"
 */
import { readFileSync, writeFileSync } from "node:fs";

const url = (process.argv[2] ?? "").trim();
if (!url.startsWith("https://script.google.com/") || !url.endsWith("/exec")) {
  console.error("Provide the Web app URL as the only argument (https://script.google.com/.../exec).");
  process.exit(2);
}
const path = "functions/.secret.live.local";
const lines = readFileSync(path, "utf8").split(/\r?\n/);
let found = false;
const out = lines.map((line) => {
  if (line.startsWith("DRIVE_BRIDGE_URL=")) {
    found = true;
    return `DRIVE_BRIDGE_URL=${url}`;
  }
  return line;
});
if (!found) out.push(`DRIVE_BRIDGE_URL=${url}`);
writeFileSync(path, `${out.filter((l, i) => i < out.length - 1 || l !== "").join("\r\n")}\r\n`, "utf8");
console.log(`Updated ${path} (DRIVE_BRIDGE_URL length ${url.length}).`);
