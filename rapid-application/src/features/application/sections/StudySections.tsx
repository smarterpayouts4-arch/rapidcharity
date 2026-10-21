import { CatalogField } from "@/components/CatalogField";
import { DocumentUpload } from "@/components/DocumentUpload";
import { NumberField, SelectField, TextField } from "@/components/fields";
import { ResultEntryFields } from "@/components/ResultEntryFields";
import { useApplication } from "@/context/ApplicationContext";
import { useCatalogList, useList, type InstitutionItem, type ListItem, type ProgramItem } from "@/hooks/useCatalog";
import { newPriorEducation, newTermResult } from "@/lib/application/emptyApplication";
import { documentId } from "@/lib/form/documents";
import {
  MAX_EXAM_YEAR,
  MAX_PRIOR_EDUCATION,
  MAX_TERM_RESULTS,
  MIN_EXAM_YEAR,
  RESULT_AWAITED,
  boardApplies,
  levelCode,
  priorInstitutionApplies,
  requiresInter,
  requiresMatric,
} from "@/lib/form/options";
import { campusChoices, visibility } from "@/lib/form/rules";
import type { ApplicationSections, PriorEducation, TermResult } from "@/types/application";
import type { FlatSectionProps } from "./types";

const DEFAULT_SYSTEM: Record<string, string> = { Semester: "sys_semester", Annual: "sys_annual", "Exam sessions": "sys_sessions" };

function institutionTypes(levels: ListItem[], levelId: string): string[] | undefined {
  const raw = String(levels.find((l) => l.id === levelId)?.institutionTypes ?? "all");
  return raw === "all" ? undefined : raw.split("|");
}

export function StudySection(p: FlatSectionProps) {
  const levels = useList("degreeLevels");
  const systems = useList("studySystems");
  const terms = useList("terms").filter((t) => !t.isOther);
  const years = useList("yearOfStudy");
  const enrolment = useList("enrolmentStatus");
  const institutions = useCatalogList<InstitutionItem>("institutions");
  const programs = useCatalogList<ProgramItem>("programs");
  const v = visibility(p.sections);
  const level = String(p.values.currentLevel ?? "");
  const institutionValue = p.values.institutionId as { id?: string } | undefined;
  const institution = institutions.find((i) => i.id === institutionValue?.id);
  const campusIds = campusChoices(p.values.institutionId);
  const campusOptions: ListItem[] = [
    ...(institution?.campuses ?? []).filter((c) => campusIds.includes(c.id)).map((c) => ({ id: c.id, label: [c.label, c.city].filter(Boolean).join(", ") })),
    { id: "other", label: "Other (please type it)", isOther: true },
  ];
  const sel = (key: string) => ({
    id: key,
    value: p.values[key],
    onChange: (val: string) => p.patch({ [key]: val }),
    otherValue: p.values[`${key}Other`],
    onOtherChange: (val: string) => p.patch({ [`${key}Other`]: val }),
    error: p.errors[key],
    otherError: p.errors[`${key}Other`],
    required: true,
  });

  return (
    <>
      <SelectField
        {...sel("currentLevel")}
        label="Level of study"
        options={levels}
        onChange={(val) => {
          const system = DEFAULT_SYSTEM[String(levels.find((l) => l.id === val)?.studySystemDefault ?? "")];
          p.patch({ currentLevel: val, ...(system && !p.values.studySystem ? { studySystem: system } : {}) });
        }}
      />
      <CatalogField
        id="institutionId"
        label="Institution (university / college / school)"
        kind="institutions"
        items={institutions}
        value={p.values.institutionId}
        filter={{ type: institutionTypes(levels, level) }}
        manualLabel="Can't find your institution? Enter it manually."
        error={p.errors.institutionId}
        onChange={(value) => p.patch({ institutionId: value, campus: "" })}
      />
      {v.campus ? <SelectField {...sel("campus")} label="Campus" options={campusOptions} /> : null}
      <CatalogField
        id="programId"
        label="Programme / degree"
        kind="programs"
        items={programs}
        value={p.values.programId}
        filter={{ levelCode: levelCode(level) || undefined }}
        manualLabel="Can't find your programme? Enter it manually."
        error={p.errors.programId}
        onChange={(value) => p.patch({ programId: value })}
      />
      {v.specialisation ? (
        <TextField
          id="specialisation"
          label="Specialisation / subjects (only if not in the programme name)"
          maxLength={80}
          value={p.values.specialisation}
          onChange={(val) => p.patch({ specialisation: val })}
          error={p.errors.specialisation}
        />
      ) : null}
      <SelectField {...sel("studySystem")} label="Study system" options={systems} />
      <SelectField {...sel("admissionTerm")} label="Started in (term)" options={terms} />
      <SelectField {...sel("expectedCompletionTerm")} label="Expected to finish in (term)" options={terms} />
      {v.currentSemester ? (
        <NumberField
          id="currentSemester"
          label="Current semester"
          required
          min={1}
          max={12}
          value={p.values.currentSemester}
          onChange={(n) => p.patch({ currentSemester: n })}
          error={p.errors.currentSemester}
        />
      ) : null}
      {v.currentYear ? <SelectField {...sel("currentYear")} label="Current year / professional" options={years} /> : null}
      <SelectField {...sel("enrolmentStatus")} label="Status" options={enrolment} />
    </>
  );
}

function entryErrors(errors: Record<string, string>, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) if (key.startsWith(prefix)) out[key.slice(prefix.length)] = message;
  return out;
}

type RepeatProps = { sections: ApplicationSections; errors: Record<string, string> };

export function TermsSection({ sections, errors }: RepeatProps) {
  const { updateSection, documents } = useApplication();
  const terms = useList("terms").filter((t) => !t.isOther);
  const entries = sections.s6_terms.termResults ?? [];
  const level = String(sections.s5_study.currentLevel ?? "");
  if (!visibility(sections).termResults) {
    return <p>You said you are newly admitted, so there are no university results to add. Continue to the next section.</p>;
  }
  const save = (next: TermResult[]) => updateSection("s6_terms", { termResults: next });
  return (
    <>
      <p>Add one entry for each term you have completed, with the result shown on your result card.</p>
      {errors.termResults ? <p className="error-text" role="alert">{errors.termResults}</p> : null}
      {entries.map((entry, i) => {
        const e = entryErrors(errors, `termResults.${i}.`);
        const patch = (changes: Partial<TermResult>) => save(entries.map((x) => (x.id === entry.id ? { ...x, ...changes } : x)));
        return (
          <fieldset key={entry.id} className="entry">
            <legend>Term {i + 1}</legend>
            <SelectField id={`term-${entry.id}`} label="Term" required options={terms} value={entry.term} onChange={(v) => patch({ term: v })} error={e.term} />
            <ResultEntryFields idPrefix={`t-${entry.id}`} entry={entry} levelId={level} examYear={null} errors={e} onChange={patch} />
            <DocumentUpload
              slot="resultDoc"
              entryId={entry.id}
              label="Upload result document (optional)"
              required={false}
              record={documents.find((d) => d.documentId === documentId("resultDoc", 1, entry.id))}
            />
            <button type="button" className="btn secondary" onClick={() => save(entries.filter((x) => x.id !== entry.id))}>
              Remove this term
            </button>
          </fieldset>
        );
      })}
      {entries.length < MAX_TERM_RESULTS ? (
        <button type="button" className="btn secondary" onClick={() => save([...entries, newTermResult()])}>
          Add a term
        </button>
      ) : null}
    </>
  );
}

export function PriorSection({ sections, errors }: RepeatProps) {
  const { updateSection, documents } = useApplication();
  const levels = useList("degreeLevels");
  const boards = useList("examBoards");
  const statuses = useList("resultStatus");
  const institutions = useCatalogList<InstitutionItem>("institutions");
  const programs = useCatalogList<ProgramItem>("programs");
  const entries = sections.s7_prior.priorEducation ?? [];
  const current = String(sections.s5_study.currentLevel ?? "");
  const save = (next: PriorEducation[]) => updateSection("s7_prior", { priorEducation: next });
  const has = (ids: string[]) => entries.some((e) => ids.includes(e.level));

  return (
    <>
      <p>
        Add your Matric / O-Level{requiresInter(current) ? " and Intermediate / A-Level" : ""}. Add a previous degree if you have one.
      </p>
      {errors.priorEducation ? <p className="error-text" role="alert">{errors.priorEducation}</p> : null}
      {entries.map((entry, i) => {
        const e = entryErrors(errors, `priorEducation.${i}.`);
        const patch = (changes: Partial<PriorEducation>) => save(entries.map((x) => (x.id === entry.id ? { ...x, ...changes } : x)));
        return (
          <fieldset key={entry.id} className="entry">
            <legend>{levels.find((l) => l.id === entry.level)?.label ?? `Education ${i + 1}`}</legend>
            <SelectField
              id={`level-${entry.id}`}
              label="Level"
              required
              options={levels}
              value={entry.level}
              onChange={(v) => patch({ level: v })}
              error={e.level}
            />
            <CatalogField
              id={`program-${entry.id}`}
              label="Group / programme"
              kind="programs"
              items={programs}
              value={entry.programId}
              filter={{ levelCode: levelCode(entry.level) || undefined }}
              manualLabel="Can't find it? Enter it manually."
              error={e.programId}
              onChange={(value) => patch({ programId: value })}
            />
            {boardApplies(entry.level) ? (
              <SelectField id={`board-${entry.id}`} label="Board" required options={boards} value={entry.board} onChange={(v) => patch({ board: v })} error={e.board} />
            ) : null}
            {priorInstitutionApplies(entry.level) ? (
              <CatalogField
                id={`inst-${entry.id}`}
                label="School / college / university"
                kind="institutions"
                items={institutions}
                value={entry.institutionId}
                manualLabel="Can't find your institution? Enter it manually."
                error={e.institutionId}
                onChange={(value) => patch({ institutionId: value })}
              />
            ) : null}
            <NumberField
              id={`year-${entry.id}`}
              label="Year passed (or expected)"
              required
              min={MIN_EXAM_YEAR}
              max={MAX_EXAM_YEAR}
              value={entry.examYear}
              onChange={(n) => patch({ examYear: n })}
              error={e.examYear}
            />
            <SelectField
              id={`status-${entry.id}`}
              label="Result status"
              required
              options={statuses}
              value={entry.resultStatus}
              onChange={(v) => patch({ resultStatus: v })}
              otherValue={entry.resultStatusOther}
              onOtherChange={(v) => patch({ resultStatusOther: v })}
              error={e.resultStatus}
              otherError={e.resultStatusOther}
            />
            {entry.resultStatus && entry.resultStatus !== RESULT_AWAITED ? (
              <>
                <ResultEntryFields idPrefix={`p-${entry.id}`} entry={entry} levelId={entry.level} examYear={entry.examYear} errors={e} onChange={patch} />
                <DocumentUpload
                  slot="resultDoc"
                  entryId={entry.id}
                  label="Upload result document (optional)"
                  required={false}
                  record={documents.find((d) => d.documentId === documentId("resultDoc", 1, entry.id))}
                />
              </>
            ) : null}
            <button type="button" className="btn secondary" onClick={() => save(entries.filter((x) => x.id !== entry.id))}>
              Remove
            </button>
          </fieldset>
        );
      })}
      {entries.length < MAX_PRIOR_EDUCATION ? (
        <div className="button-row">
          {requiresMatric(current) && !has(["lvl_mat", "lvl_ol"]) ? (
            <button type="button" className="btn secondary" onClick={() => save([...entries, newPriorEducation("lvl_mat")])}>
              Add Matric
            </button>
          ) : null}
          {requiresInter(current) && !has(["lvl_int", "lvl_al", "lvl_dae"]) ? (
            <button type="button" className="btn secondary" onClick={() => save([...entries, newPriorEducation("lvl_int")])}>
              Add Intermediate
            </button>
          ) : null}
          <button type="button" className="btn secondary" onClick={() => save([...entries, newPriorEducation()])}>
            Add other education
          </button>
        </div>
      ) : null}
    </>
  );
}
