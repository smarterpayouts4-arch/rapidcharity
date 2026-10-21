import { FIELD_LABELS, displayValue } from "@/lib/form/display";
import { SECTION_11_SLOTS } from "@/lib/form/documents";
import type { DocumentRecord, ScholarshipApplication } from "@/types/application";

const FLAT = ["s1_about", "s2_contact", "s3_family", "s4_church", "s5_study", "s8_fees", "s9_essay", "s10_refs"] as const;

/** Quotes every cell and neutralises spreadsheet formulas (cells starting with = + - @ tab or CR). */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildCsv(apps: ScholarshipApplication[], documents: DocumentRecord[][], labels: Map<string, string>): string {
  const keys: { section: (typeof FLAT)[number]; key: string }[] = [];
  for (const section of FLAT) {
    const seen = new Set<string>();
    for (const app of apps) for (const key of Object.keys(app.sections[section])) if (!key.endsWith("Other")) seen.add(key);
    for (const key of seen) keys.push({ section, key });
  }
  const header = [
    "Receipt",
    "Application id",
    "Submitted at",
    "Needs review",
    "Scholarship",
    ...keys.map((k) => FIELD_LABELS[k.key] ?? k.key),
    "University terms",
    "Earlier education entries",
    ...SECTION_11_SLOTS.map((slot) => `Document ${slot}`),
  ];
  const rows = apps.map((app, i) => {
    const docs = documents[i] ?? [];
    return [
      app.receiptCode ?? "",
      app.applicationId,
      app.submittedAt ? new Date(app.submittedAt).toISOString() : "",
      app.needsReview ? "yes" : "no",
      app.scholarshipProgram ?? "",
      ...keys.map(({ section, key }) => {
        const values = app.sections[section] as Record<string, unknown>;
        return displayValue(values[key], labels, values[`${key}Other`]);
      }),
      String(app.sections.s6_terms.termResults.length),
      String(app.sections.s7_prior.priorEducation.length),
      ...SECTION_11_SLOTS.map((slot) =>
        docs
          .filter((d) => d.slot === slot && d.uploadStatus === "stored")
          .map((d) => d.verificationStatus)
          .join("; "),
      ),
    ];
  });
  return `\uFEFF${[header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
