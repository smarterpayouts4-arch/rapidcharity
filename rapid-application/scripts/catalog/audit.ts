import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { listsRoot, repoRoot } from "./paths.ts";

type JsonList = { items?: unknown[]; options?: unknown[] };

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    duplicateFiles: [] as { hash: string; files: string[] }[],
    lists: {} as Record<string, { count: number; bytes: number }>,
    issues: [] as string[],
  };

  const hashMap = new Map<string, string[]>();
  for (const rel of ["Form Field Spec.xlsx", "spec/Form Field Spec.xlsx"]) {
    const p = path.join(repoRoot, "form References", rel);
    if (fs.existsSync(p)) {
      const h = sha256File(p);
      const arr = hashMap.get(h) ?? [];
      arr.push(p);
      hashMap.set(h, arr);
    }
  }
  const duplicateFiles: { hash: string; files: string[] }[] = [];
  for (const [hash, files] of hashMap) {
    if (files.length > 1) duplicateFiles.push({ hash, files });
  }
  report.duplicateFiles = duplicateFiles;

  const provinces = readJson(path.join(listsRoot, "provinces.json")) as JsonList;
  const provinceIds = new Set(
    ((provinces.items ?? provinces.options ?? []) as { id: string }[]).map((p) => p.id),
  );

  const cities = readJson(path.join(listsRoot, "cities.json")) as {
    items: { id: string; provinceId?: string }[];
  };
  for (const city of cities.items ?? []) {
    if (city.provinceId && !provinceIds.has(city.provinceId)) {
      (report.issues as string[]).push(`City ${city.id} references missing province ${city.provinceId}`);
    }
  }

  for (const file of fs.readdirSync(listsRoot).filter((f) => f.endsWith(".json"))) {
    const p = path.join(listsRoot, file);
    const data = readJson(p) as JsonList;
    const count = (data.items ?? data.options ?? []).length;
    (report.lists as Record<string, { count: number; bytes: number }>)[file] = {
      count,
      bytes: fs.statSync(p).size,
    };
  }

  const outDir = path.join(repoRoot, "rapid-application", "docs");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "data-audit.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Catalog data audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Duplicate files",
    ...(report.duplicateFiles as { hash: string; files: string[] }[]).map(
      (d) => `- \`${d.hash.slice(0, 12)}…\`: ${d.files.map((f) => path.basename(f)).join(", ")}`,
    ),
    "",
    "## Issues",
    ...((report.issues as string[]).length
      ? (report.issues as string[]).map((i) => `- ${i}`)
      : ["- None recorded by automated audit"]),
    "",
    "Machine-readable: `data-audit.json`",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "data-audit.md"), md);
  console.log("Wrote docs/data-audit.md");
}

main();
