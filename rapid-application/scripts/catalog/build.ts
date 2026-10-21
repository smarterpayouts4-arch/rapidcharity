import fs from "node:fs";
import path from "node:path";
import { catalogOutRoot, listsRoot, repoRoot } from "./paths.ts";

const VERSION = "2026-10-21";

type RawInst = {
  id: string;
  label: string;
  shortName?: string;
  aliases?: string[];
  searchKeys?: string[];
  city?: string;
  province?: string;
  type?: string;
  campuses?: { name: string; city?: string }[];
};

function readList<T>(file: string): T[] {
  const raw = JSON.parse(fs.readFileSync(path.join(listsRoot, file), "utf8")) as {
    items?: T[];
    options?: T[];
  };
  return raw.items ?? raw.options ?? [];
}

function stableCampusId(institutionId: string, campusName: string, city?: string): string {
  const slug = `${campusName}-${city ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `${institutionId}__campus_${slug}`;
}

function main() {
  const outDir = path.join(catalogOutRoot, VERSION);
  fs.mkdirSync(outDir, { recursive: true });

  const institutions = readList<RawInst>("institutions.json").map((inst) => ({
    id: inst.id,
    label: inst.label,
    shortName: inst.shortName ?? "",
    aliases: inst.aliases ?? [],
    searchKeys: inst.searchKeys ?? [],
    city: inst.city ?? "",
    province: inst.province ?? "",
    type: inst.type ?? "",
    campuses: (inst.campuses ?? []).map((c) => ({
      id: stableCampusId(inst.id, c.name, c.city),
      label: c.name,
      city: c.city ?? "",
    })),
  }));

  const programs = readList<{
    id: string;
    label: string;
    aliases?: string[];
    searchKeys?: string[];
    levelCode?: string;
    durationYears?: number;
  }>("programs.json").map((p) => ({
    id: p.id,
    label: p.label,
    aliases: p.aliases ?? [],
    searchKeys: p.searchKeys ?? [],
    levelCode: p.levelCode ?? "",
    durationYears: p.durationYears ?? null,
  }));

  const spec = JSON.parse(fs.readFileSync(path.join(listsRoot, "..", "fields.json"), "utf8")) as {
    fields: { key: string; label: string; adminOnly?: boolean; group?: string }[];
  };
  const fieldLabels: Record<string, string> = {};
  for (const f of spec.fields) {
    if (!f.adminOnly && !f.group && f.label !== "Please type it here") fieldLabels[f.key] = f.label;
  }
  fs.writeFileSync(
    path.join(repoRoot, "rapid-application", "src", "lib", "form", "fieldLabels.generated.json"),
    `${JSON.stringify(fieldLabels, null, 2)}\n`,
  );

  const multiCampus: Record<string, string[]> = {};
  for (const inst of institutions) {
    if (inst.campuses.length > 1) multiCampus[inst.id] = inst.campuses.map((c) => c.id);
  }
  fs.writeFileSync(
    path.join(repoRoot, "rapid-application", "src", "lib", "form", "multiCampus.generated.json"),
    `${JSON.stringify(multiCampus, null, 2)}\n`,
  );

  const smallLists = [
    "gender",
    "religion",
    "yesNo",
    "yesNoPending",
    "occupations",
    "provinces",
    "degreeLevels",
    "studySystems",
    "terms",
    "yearOfStudy",
    "enrolmentStatus",
    "employmentStatus",
    "howHeard",
    "relationships",
    "documentTypes",
    "resultFormats",
    "resultStatus",
    "examBoards",
    "gpaScales",
    "gradeSchemes",
    "letterGrades",
    "divisions",
    "passFail",
  ];

  fs.writeFileSync(path.join(outDir, "institutions.json"), JSON.stringify({ version: VERSION, items: institutions }));
  fs.writeFileSync(path.join(outDir, "programs.json"), JSON.stringify({ version: VERSION, items: programs }));

  const cities = readList<{ id: string; label: string; province?: string; provinceId?: string }>("cities.json").map(
    (c) => ({
      id: c.id,
      label: c.label,
      province: c.province ?? "",
      provinceId: c.provinceId ?? "",
      searchKeys: [c.label.toLowerCase()],
    }),
  );
  fs.writeFileSync(path.join(outDir, "cities.json"), JSON.stringify({ version: VERSION, items: cities }));

  for (const name of smallLists) {
    fs.copyFileSync(path.join(listsRoot, `${name}.json`), path.join(outDir, `${name}.json`));
  }

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ version: VERSION, builtAt: new Date().toISOString(), institutions: institutions.length, programs: programs.length }, null, 2),
  );
  console.log(`Built catalog ${VERSION} → public/catalog/${VERSION}`);
}

main();
