import { NumberField, SelectField } from "./fields";
import { useList } from "@/hooks/useCatalog";
import { GPA_SCALE_MAX, OTHER, gradeSchemeChoices, letterGradeBelongs } from "@/lib/form/options";
import { marksPercent, resultFieldsShown } from "@/lib/form/rules";
import type { ResultFields } from "@/types/application";

type Props = {
  idPrefix: string;
  entry: ResultFields;
  levelId: string;
  examYear: number | null;
  errors: Record<string, string>;
  onChange: (patch: Partial<ResultFields>) => void;
};

export function ResultEntryFields({ idPrefix, entry, levelId, examYear, errors, onChange }: Props) {
  const formats = useList("resultFormats");
  const scales = useList("gpaScales");
  const schemes = useList("gradeSchemes");
  const grades = useList("letterGrades");
  const divisions = useList("divisions");
  const passFail = useList("passFail");

  const shown = resultFieldsShown(entry, levelId, examYear);
  const schemeChoices = gradeSchemeChoices(levelId, examYear);
  const scheme = schemeChoices.length === 1 ? schemeChoices[0]! : entry.gradeScheme;
  const scaleMax = entry.gpaScale === OTHER ? entry.gpaScaleOther : GPA_SCALE_MAX[entry.gpaScale];
  const percent = marksPercent(entry);

  return (
    <>
      <SelectField
        id={`${idPrefix}-resultFormat`}
        label="How are your results shown?"
        required
        options={formats}
        value={entry.resultFormat}
        onChange={(v) => onChange({ resultFormat: v })}
        otherValue={entry.resultFormatOther}
        onOtherChange={(v) => onChange({ resultFormatOther: v })}
        error={errors.resultFormat}
        otherError={errors.resultFormatOther}
      />
      {shown.has("gpaScale") ? (
        <>
          <SelectField
            id={`${idPrefix}-gpaScale`}
            label="GPA scale"
            required
            options={scales}
            value={entry.gpaScale}
            onChange={(v) => onChange({ gpaScale: v })}
            error={errors.gpaScale}
          />
          {entry.gpaScale === OTHER ? (
            <NumberField
              id={`${idPrefix}-gpaScaleOther`}
              label="Maximum GPA on your card"
              step={0.01}
              value={entry.gpaScaleOther}
              onChange={(v) => onChange({ gpaScaleOther: v })}
              error={errors.gpaScaleOther}
            />
          ) : null}
        </>
      ) : null}
      {shown.has("sgpa") ? (
        <NumberField
          id={`${idPrefix}-sgpa`}
          label="Semester GPA (SGPA)"
          required
          step={0.01}
          min={0}
          max={scaleMax ?? undefined}
          value={entry.sgpa}
          onChange={(v) => onChange({ sgpa: v })}
          error={errors.sgpa}
        />
      ) : null}
      {shown.has("cgpa") ? (
        <NumberField
          id={`${idPrefix}-cgpa`}
          label="Cumulative GPA (CGPA)"
          required
          step={0.01}
          min={0}
          max={scaleMax ?? undefined}
          value={entry.cgpa}
          onChange={(v) => onChange({ cgpa: v })}
          error={errors.cgpa}
        />
      ) : null}
      {shown.has("percentage") ? (
        <NumberField
          id={`${idPrefix}-percentage`}
          label="Percentage"
          required
          step={0.01}
          min={0}
          max={100}
          hint="Type 75, not 0.75."
          value={entry.percentage}
          onChange={(v) => onChange({ percentage: v })}
          error={errors.percentage}
        />
      ) : null}
      {shown.has("marksObtained") ? (
        <>
          <NumberField
            id={`${idPrefix}-marksObtained`}
            label="Marks obtained"
            required
            step={0.01}
            min={0}
            value={entry.marksObtained}
            onChange={(v) => onChange({ marksObtained: v })}
            error={errors.marksObtained}
          />
          <NumberField
            id={`${idPrefix}-marksTotal`}
            label="Total marks"
            required
            min={1}
            max={5000}
            value={entry.marksTotal}
            onChange={(v) => onChange({ marksTotal: v })}
            error={errors.marksTotal}
          />
          {percent !== null ? <p className="save-status">Percentage (calculated): {percent}%</p> : null}
        </>
      ) : null}
      {shown.has("gradeScheme") ? (
        <SelectField
          id={`${idPrefix}-gradeScheme`}
          label="Which grade list is on your card?"
          required
          options={schemes.filter((s) => schemeChoices.includes(s.id))}
          value={entry.gradeScheme}
          onChange={(v) => onChange({ gradeScheme: v, letterGrade: "" })}
          error={errors.gradeScheme}
        />
      ) : null}
      {shown.has("letterGrade") ? (
        <SelectField
          id={`${idPrefix}-letterGrade`}
          label="Grade"
          required
          options={grades.filter((g) => g.isOther || (scheme && letterGradeBelongs(g.id, scheme)))}
          value={entry.letterGrade}
          onChange={(v) => onChange({ letterGrade: v })}
          otherValue={entry.letterGradeOther}
          onOtherChange={(v) => onChange({ letterGradeOther: v })}
          error={errors.letterGrade}
          otherError={errors.letterGradeOther}
          disabled={!scheme}
        />
      ) : null}
      {shown.has("division") ? (
        <SelectField
          id={`${idPrefix}-division`}
          label="Division"
          required
          options={divisions}
          value={entry.division}
          onChange={(v) => onChange({ division: v })}
          otherValue={entry.divisionOther}
          onOtherChange={(v) => onChange({ divisionOther: v })}
          error={errors.division}
          otherError={errors.divisionOther}
        />
      ) : null}
      {shown.has("passFail") ? (
        <SelectField
          id={`${idPrefix}-passFail`}
          label="Result"
          required
          options={passFail}
          value={entry.passFail}
          onChange={(v) => onChange({ passFail: v })}
          otherValue={entry.passFailOther}
          onOtherChange={(v) => onChange({ passFailOther: v })}
          error={errors.passFail}
          otherError={errors.passFailOther}
        />
      ) : null}
    </>
  );
}
