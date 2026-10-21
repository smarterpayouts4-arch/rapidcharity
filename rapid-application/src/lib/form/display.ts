import fieldLabels from "./fieldLabels.generated.json";

export const FIELD_LABELS = fieldLabels as Record<string, string>;

/** Human-readable answer: list ids become labels, catalog values show their label or typed text. */
export function displayValue(value: unknown, labels: Map<string, string>, otherText?: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object" && "source" in (value as object)) {
    const c = value as { labelSnapshot: string | null; rawText: string; source: string };
    return c.source === "catalog" ? (c.labelSnapshot ?? "") : c.rawText ? `${c.rawText} (typed in)` : "";
  }
  if (value === "other") return `Other: ${String(otherText ?? "")}`;
  if (typeof value === "string") return labels.get(value) ?? value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Answer keys of a flat section, excluding the `{key}Other` companions. */
export function answerKeys(section: Record<string, unknown>): string[] {
  return Object.keys(section).filter((k) => !(k.endsWith("Other") && k.slice(0, -5) in section));
}
