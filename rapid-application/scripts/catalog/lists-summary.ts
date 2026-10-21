import fs from "node:fs";
import path from "node:path";
import { listsRoot } from "./paths.ts";

const names = process.argv.slice(2);
for (const name of names) {
  const raw = JSON.parse(fs.readFileSync(path.join(listsRoot, `${name}.json`), "utf8")) as {
    items: Record<string, unknown>[];
  };
  console.log(`## ${name} (${raw.items.length})`);
  for (const item of raw.items) {
    const extra = Object.entries(item)
      .filter(([k, v]) => !["id", "label", "source", "note", "notes", "aliases", "searchKeys"].includes(k) && v !== "" && v !== null)
      .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join("; ")
      .slice(0, 220);
    console.log(`${item.id} | ${item.label} | ${extra}`);
  }
}
