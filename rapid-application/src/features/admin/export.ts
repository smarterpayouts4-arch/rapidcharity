import { FIELD_LABELS } from "@/lib/form/display";
import type { DocumentRecord, ResultFields, ScholarshipApplication } from "@/types/application";

/**
 * Spreadsheet export for staff, built from Firestore records. One row per application, one per
 * result entry, one per document. Drive file ids, owner uids and duplicate keys are left out.
 */
export type Cell = string | number;
export type Sheet = { name: string; header: string[]; rows: Cell[][] };

const FLAT = ["s1_about", "s2_contact", "s3_family", "s4_church", "s5_study", "s8_fees", "s9_essay", "s10_refs"] as const;

/** Neutralises spreadsheet formulas in text (cells starting with = + - @ tab or CR). */
export function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Standardised value plus the applicant's own wording when they typed one. */
function pair(value: unknown, labels: Map<string, string>, otherText?: unknown): [Cell, string] {
  if (value === null || value === undefined || value === "") return ["", ""];
  if (typeof value === "object" && "source" in (value as object)) {
    const c = value as { labelSnapshot: string | null; rawText: string; source: string };
    return c.source === "catalog" ? [c.labelSnapshot ?? "", ""] : ["Not in list", c.rawText ?? ""];
  }
  if (value === "other") return ["Other", String(otherText ?? "")];
  if (typeof value === "string") return [labels.get(value) ?? value, ""];
  if (typeof value === "boolean") return [value ? "Yes" : "No", ""];
  if (typeof value === "number") return [value, ""];
  return [String(value), ""];
}

type Column<T> = { title: string; get: (row: T) => [Cell, string] };

/** Builds a sheet; an "(as typed)" column is added only where some applicant typed their own text. */
function sheet<T>(name: string, items: T[], columns: Column<T>[]): Sheet {
  const values = items.map((item) => columns.map((c) => c.get(item)));
  const typed = columns.map((_, i) => values.some((v) => v[i]![1] !== ""));
  const header = columns.flatMap((c, i) => (typed[i] ? [c.title, `${c.title} (as typed)`] : [c.title]));
  const rows = values.map((v) =>
    v.flatMap(([std, raw], i) => {
      const cell = typeof std === "string" ? safeText(std) : std;
      return typed[i] ? [cell, safeText(raw)] : [cell];
    }),
  );
  return { name, header, rows };
}

const text = (v: string | null | undefined): [Cell, string] => [v ?? "", ""];
const date = (ms: number | null | undefined): [Cell, string] => [ms ? new Date(ms).toISOString().slice(0, 16).replace("T", " ") : "", ""];

const RESULT_COLUMNS: Column<ResultFields>[] = [
  { title: "Result format", get: (r) => pair(r.resultFormat, new Map(), r.resultFormatOther) },
  { title: "GPA scale", get: (r) => (r.gpaScale === "other" ? ["Other", String(r.gpaScaleOther ?? "")] : pair(r.gpaScale, new Map())) },
  { title: "SGPA", get: (r) => pair(r.sgpa, new Map()) },
  { title: "CGPA", get: (r) => pair(r.cgpa, new Map()) },
  { title: "Percentage", get: (r) => pair(r.percentage, new Map()) },
  { title: "Marks obtained", get: (r) => pair(r.marksObtained, new Map()) },
  { title: "Marks total", get: (r) => pair(r.marksTotal, new Map()) },
  { title: "Letter grade", get: (r) => pair(r.letterGrade, new Map(), r.letterGradeOther) },
  { title: "Division", get: (r) => pair(r.division, new Map(), r.divisionOther) },
  { title: "Pass / fail", get: (r) => pair(r.passFail, new Map(), r.passFailOther) },
];

type ResultRow = { app: ScholarshipApplication; kind: string; what: [Cell, string]; programme: [Cell, string]; board: [Cell, string]; institution: [Cell, string]; year: [Cell, string]; status: [Cell, string]; result: ResultFields };

export function buildExport(apps: ScholarshipApplication[], documents: DocumentRecord[][], labels: Map<string, string>): Sheet[] {
  const fieldColumns: Column<ScholarshipApplication>[] = [];
  for (const section of FLAT) {
    const seen = new Set<string>();
    for (const app of apps) for (const key of Object.keys(app.sections[section])) if (!(key.endsWith("Other") && key.slice(0, -5) in app.sections[section])) seen.add(key);
    for (const key of seen) {
      fieldColumns.push({
        title: FIELD_LABELS[key] ?? key,
        get: (app) => {
          const values = app.sections[section] as Record<string, unknown>;
          return pair(values[key], labels, values[`${key}Other`]);
        },
      });
    }
  }

  const applications = sheet("Applications", apps, [
    { title: "Receipt", get: (a) => text(a.receiptCode) },
    { title: "Application id", get: (a) => text(a.applicationId) },
    { title: "Cycle", get: (a) => text(a.cycleId) },
    { title: "Status", get: (a) => text(a.status) },
    { title: "Submitted at (UTC)", get: (a) => date(a.submittedAt) },
    { title: "Scholarship type", get: (a) => text(a.scholarshipType ?? "Unassigned") },
    { title: "Drive folder", get: (a) => text(a.driveFolder ?? "INTAKE") },
    { title: "Needs review", get: (a) => text(a.needsReview ? "Yes" : "No") },
    ...fieldColumns,
    { title: "Documents verified", get: (a) => [String((documents[apps.indexOf(a)] ?? []).filter((d) => d.verificationStatus === "verified").length), ""] },
    { title: "Documents stored", get: (a) => [String((documents[apps.indexOf(a)] ?? []).filter((d) => d.uploadStatus === "stored").length), ""] },
  ]);

  const resultRows: ResultRow[] = apps.flatMap((app) => [
    ...app.sections.s6_terms.termResults.map((r) => ({
      app,
      kind: "University term",
      what: pair(r.term, labels),
      programme: ["", ""] as [Cell, string],
      board: ["", ""] as [Cell, string],
      institution: ["", ""] as [Cell, string],
      year: ["", ""] as [Cell, string],
      status: ["", ""] as [Cell, string],
      result: r,
    })),
    ...app.sections.s7_prior.priorEducation.map((r) => ({
      app,
      kind: "Earlier education",
      what: pair(r.level, labels),
      programme: pair(r.programId, labels),
      board: pair(r.board, labels),
      institution: pair(r.institutionId, labels),
      year: pair(r.examYear, labels),
      status: pair(r.resultStatus, labels, r.resultStatusOther),
      result: r,
    })),
  ]);
  const results = sheet("Academic results", resultRows, [
    { title: "Receipt", get: (r) => text(r.app.receiptCode) },
    { title: "Application id", get: (r) => text(r.app.applicationId) },
    { title: "Scholarship type", get: (r) => text(r.app.scholarshipType ?? "Unassigned") },
    { title: "Entry", get: (r) => text(r.kind) },
    { title: "Term / level", get: (r) => r.what },
    { title: "Programme", get: (r) => r.programme },
    { title: "Board", get: (r) => r.board },
    { title: "Institution", get: (r) => r.institution },
    { title: "Exam year", get: (r) => r.year },
    { title: "Result status", get: (r) => r.status },
    ...RESULT_COLUMNS.map((c) => ({ title: c.title, get: (r: ResultRow) => relabel(c.get(r.result), labels) })),
  ]);

  const docRows = apps.flatMap((app, i) => (documents[i] ?? []).map((d) => ({ app, d })));
  const docs = sheet("Documents", docRows, [
    { title: "Receipt", get: (r) => text(r.app.receiptCode) },
    { title: "Application id", get: (r) => text(r.app.applicationId) },
    { title: "Scholarship type", get: (r) => text(r.app.scholarshipType ?? "Unassigned") },
    { title: "Document", get: (r) => text(r.d.label) },
    { title: "File number", get: (r) => [r.d.index, ""] },
    { title: "Uploaded at (UTC)", get: (r) => date(r.d.uploadedAt) },
    { title: "Upload status", get: (r) => text(r.d.uploadStatus) },
    { title: "Verification", get: (r) => text(r.d.verificationStatus) },
    { title: "Verification note", get: (r) => text(r.d.verificationNote) },
    { title: "Verified at (UTC)", get: (r) => date(r.d.verifiedAt) },
  ]);

  return [applications, results, docs];
}

function relabel([std, raw]: [Cell, string], labels: Map<string, string>): [Cell, string] {
  return [typeof std === "string" ? (labels.get(std) ?? std) : std, raw];
}

function csvCell(value: Cell): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** One sheet as CSV (UTF-8 with BOM so Excel reads Urdu and accents correctly). */
export function toCsv(s: Sheet): string {
  return `\uFEFF${[s.header, ...s.rows].map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** The same sheets as one .xlsx workbook. ExcelJS is loaded only when staff export. */
export async function toXlsx(sheets: Sheet[]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  book.creator = "RAPID scholarship application";
  for (const s of sheets) {
    const ws = book.addWorksheet(s.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(s.header).font = { bold: true };
    for (const row of s.rows) ws.addRow(row);
    ws.columns.forEach((col) => (col.width = 18));
  }
  return (await book.xlsx.writeBuffer()) as ArrayBuffer;
}
