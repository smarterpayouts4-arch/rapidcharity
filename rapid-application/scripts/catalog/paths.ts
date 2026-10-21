import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../../..");
export const specRoot = path.join(repoRoot, "form References", "spec");
export const listsRoot = path.join(specRoot, "lists");
export const catalogOutRoot = path.join(repoRoot, "rapid-application", "public", "catalog");
