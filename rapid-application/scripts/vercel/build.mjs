// Builds the Vercel preview in Build Output API v3 form (.vercel/output):
// the Vite site as static files plus one Node function at /api/rpc that runs functions/src/rpc.ts.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { nodeFileTrace } from "@vercel/nft";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, ".vercel/output");
const funcDir = path.join(out, "functions/api/rpc.func");
const entry = path.join(root, ".vercel-build/api/rpc.mjs");

fs.rmSync(out, { recursive: true, force: true });
fs.rmSync(path.dirname(entry), { recursive: true, force: true });

execSync("npx tsc -b && npx vite build --mode vercel-preview", { cwd: root, stdio: "inherit" });
fs.cpSync(path.join(root, "dist"), path.join(out, "static"), { recursive: true });

await build({
  entryPoints: [path.join(root, "functions/src/vercel.ts")],
  outfile: entry,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
  logLevel: "warning",
});

const { fileList } = await nodeFileTrace([entry], { base: root });
for (const file of fileList) {
  const from = path.join(root, file);
  if (!fs.statSync(from).isFile()) continue;
  fs.mkdirSync(path.dirname(path.join(funcDir, file)), { recursive: true });
  fs.copyFileSync(from, path.join(funcDir, file));
}
fs.writeFileSync(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify({
    runtime: "nodejs22.x",
    handler: path.relative(root, entry).replaceAll("\\", "/"),
    launcherType: "Nodejs",
    shouldAddHelpers: false,
    maxDuration: 120,
    memory: 1024,
  }),
);

const security = {
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
fs.writeFileSync(
  path.join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "/(.*)", headers: security, continue: true },
        { src: "/assets/(.*)", headers: { "Cache-Control": "public, max-age=31536000, immutable" }, continue: true },
        { handle: "filesystem" },
        { src: "/api/(.*)", status: 404, dest: "/404" },
        { src: "/(.*)", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);
console.log(`Build output written to ${path.relative(root, out)} (${fileList.size} traced files for /api/rpc)`);
