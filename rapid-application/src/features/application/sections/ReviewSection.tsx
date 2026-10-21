import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckboxField } from "@/components/fields";
import { SubmitError, useApplication } from "@/context/ApplicationContext";
import { useLabels } from "@/hooks/useLabels";
import { FIELD_LABELS, answerKeys, displayValue } from "@/lib/form/display";
import type { Issue } from "@/lib/form/rules";
import { SECTION_LABELS, type SectionId } from "@/lib/validation/constants";
import type { ApplicationSections } from "@/types/application";

const FLAT: SectionId[] = ["s1_about", "s2_contact", "s3_family", "s4_church", "s5_study", "s8_fees", "s9_essay", "s10_refs"];

type Props = { sections: ApplicationSections; issues: Issue[]; applicationId: string; patchDeclaration: (v: boolean) => void };

export function ReviewSection({ sections, issues, applicationId, patchDeclaration }: Props) {
  const { submit } = useApplication();
  const navigate = useNavigate();
  const labels = useLabels();
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<Issue[]>([]);
  const blocking = issues.filter((i) => i.section !== "s12_submit");
  const listed = serverIssues.length ? serverIssues : blocking;

  async function onSubmit() {
    setBusy(true);
    setServerError(null);
    setServerIssues([]);
    try {
      await submit();
      navigate(`/submitted/${applicationId}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Submit failed.");
      if (err instanceof SubmitError) setServerIssues(err.issues);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {listed.length ? (
        <div className="notice error" role="alert">
          <p>
            <strong>Please fix these before submitting:</strong>
          </p>
          <ul>
            {listed.map((i) => (
              <li key={`${i.section}-${i.key}`}>
                <Link to={`/application/${applicationId}/${i.section}`}>{SECTION_LABELS[i.section as SectionId]}</Link>: {i.message}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="notice ok">Everything required is filled in.</p>
      )}
      {FLAT.map((sectionId) => {
        const values = sections[sectionId] as Record<string, unknown>;
        return (
          <section key={sectionId} className="review-block">
            <h3>
              {SECTION_LABELS[sectionId]} <Link to={`/application/${applicationId}/${sectionId}`}>Edit</Link>
            </h3>
            <dl>
              {answerKeys(values).map((k) => (
                <div key={k}>
                  <dt>{FIELD_LABELS[k] ?? k}</dt>
                  <dd>{displayValue(values[k], labels, values[`${k}Other`]) || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
      <section className="review-block">
        <h3>
          Results and education <Link to={`/application/${applicationId}/s6_terms`}>Edit</Link>
        </h3>
        <p>
          University terms: {sections.s6_terms.termResults.length}. Earlier education entries: {sections.s7_prior.priorEducation.length}.
        </p>
      </section>
      <CheckboxField
        id="declaration"
        label="I confirm the information is true and I agree RAPID may verify it"
        required
        checked={sections.s12_submit.declaration === true}
        onChange={patchDeclaration}
      />
      {serverError ? (
        <p className="error-text" role="alert">
          {serverError}
        </p>
      ) : null}
      <button
        type="button"
        className="btn"
        disabled={busy || blocking.length > 0 || sections.s12_submit.declaration !== true}
        onClick={() => void onSubmit()}
      >
        {busy ? "Submitting…" : "Submit application"}
      </button>
      <p className="hint">After you submit, answers and documents can no longer be changed.</p>
    </>
  );
}
