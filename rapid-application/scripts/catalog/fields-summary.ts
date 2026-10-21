import fs from "node:fs";
import path from "node:path";
import { specRoot } from "./paths.ts";

type Field = {
  section: string;
  key: string;
  label: string;
  type: string;
  required: string;
  list: string;
  dependsOn: string;
  validation: string;
  allowOther: string;
  otherField: string;
  group: string;
  adminOnly: boolean;
};

const spec = JSON.parse(fs.readFileSync(path.join(specRoot, "fields.json"), "utf8")) as { fields: Field[] };
for (const f of spec.fields) {
  if (f.otherField === "" && f.label === "Please type it here") continue;
  console.log(
    [f.section, f.key, f.type, f.required, f.list, f.dependsOn, f.group, f.adminOnly ? "ADMIN" : "", f.label, f.validation]
      .map((v) => String(v).replace(/\s+/g, " ").slice(0, 110))
      .join(" | "),
  );
}
