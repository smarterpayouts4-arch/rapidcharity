import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useApplication } from "@/context/ApplicationContext";
import { useCatalogList, type ProgramItem } from "@/hooks/useCatalog";
import { validateDocuments, validateSections, type Issue } from "@/lib/form/rules";
import { SECTION_IDS, SECTION_LABELS, type SectionId } from "@/lib/validation/constants";
import type { FlatSection } from "@/types/application";
import { AboutSection, ChurchSection, ContactSection, EssaySection, FamilySection, FeesSection, ReferencesSection } from "./sections/PersonalSections";
import { PriorSection, StudySection, TermsSection } from "./sections/StudySections";
import { DocumentsSection } from "./sections/DocumentsSection";
import { ReviewSection } from "./sections/ReviewSection";

const FLAT_COMPONENTS = {
  s1_about: AboutSection,
  s2_contact: ContactSection,
  s3_family: FamilySection,
  s4_church: ChurchSection,
  s5_study: StudySection,
  s8_fees: FeesSection,
  s9_essay: EssaySection,
  s10_refs: ReferencesSection,
} as const;

function errorsFor(issues: Issue[], section: SectionId): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) if (i.section === section && !(i.key in out)) out[i.key] = i.message;
  return out;
}

export function ApplicationWizard() {
  const { applicationId = "", sectionId = "s1_about" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { application, documents, openApplication, updateSection, saveState, flush } = useApplication();
  const navigate = useNavigate();
  const programs = useCatalogList<ProgramItem>("programs");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">("loading");
  const [attempted, setAttempted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void openApplication(applicationId)
      .then((app) => !cancelled && setLoadState(app ? "ready" : "missing"))
      .catch(() => !cancelled && setLoadState("missing"));
    return () => {
      cancelled = true;
    };
  }, [applicationId, user, openApplication]);

  const section = (SECTION_IDS as readonly string[]).includes(sectionId) ? (sectionId as SectionId) : null;
  const programId = (application?.sections.s5_study.programId as { id?: string } | undefined)?.id;
  const duration = programs.find((p) => p.id === programId)?.durationYears ?? null;

  const { issues, warnings } = useMemo(() => {
    if (!application) return { issues: [] as Issue[], warnings: [] as Issue[] };
    const result = validateSections(application.sections, { programDurationYears: duration });
    return { issues: [...result.issues, ...validateDocuments(application.sections, documents)], warnings: result.warnings };
  }, [application, documents, duration]);

  if (authLoading) return <p>Loading…</p>;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (!section) return <Navigate to={`/application/${applicationId}/s1_about`} replace />;
  if (loadState === "loading" || (loadState === "ready" && application?.applicationId !== applicationId)) return <p>Loading your application…</p>;
  if (loadState === "missing" || !application) {
    return (
      <p>
        This application could not be opened. <Link to="/">Back to your applications</Link>
      </p>
    );
  }
  if (application.status === "submitted") return <Navigate to={`/submitted/${application.applicationId}`} replace />;

  const index = SECTION_IDS.indexOf(section);
  const sectionIssues = issues.filter((i) => i.section === section);
  const showErrors = attempted.has(section);
  const errors = showErrors ? errorsFor(issues, section) : {};
  const sectionWarnings = warnings.filter((w) => w.section === section);
  const go = (target: SectionId) => {
    void flush();
    navigate(`/application/${applicationId}/${target}`);
    window.scrollTo(0, 0);
  };

  let body: ReactNode;
  if (section in FLAT_COMPONENTS) {
    const key = section as keyof typeof FLAT_COMPONENTS;
    const Component = FLAT_COMPONENTS[key];
    const values = application.sections[key] as FlatSection;
    body = <Component sections={application.sections} values={values} errors={errors} patch={(changes) => updateSection(key, { ...values, ...changes })} />;
  } else if (section === "s6_terms") {
    body = <TermsSection sections={application.sections} errors={errors} />;
  } else if (section === "s7_prior") {
    body = <PriorSection sections={application.sections} errors={errors} />;
  } else if (section === "s11_docs") {
    body = <DocumentsSection sections={application.sections} errors={errors} />;
  } else {
    body = (
      <ReviewSection
        sections={application.sections}
        issues={issues}
        applicationId={applicationId}
        patchDeclaration={(v) => updateSection("s12_submit", { ...application.sections.s12_submit, declaration: v })}
      />
    );
  }

  return (
    <div>
      <nav className="progress" aria-label="Application sections">
        {SECTION_IDS.map((id, i) => {
          const done = !issues.some((x) => x.section === id);
          return (
            <Link
              key={id}
              to={`/application/${applicationId}/${id}`}
              className={id === section ? "active" : done ? "done" : undefined}
              aria-current={id === section ? "step" : undefined}
            >
              {i + 1}. {SECTION_LABELS[id]}
            </Link>
          );
        })}
      </nav>
      <h2>
        {index + 1}. {SECTION_LABELS[section]}
      </h2>
      <p className="save-status" role="status" aria-live="polite">
        {saveState === "saving" ? "Saving…" : saveState === "saved" ? "All changes saved." : saveState === "error" ? "Could not save. Check your connection." : ""}
      </p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setAttempted((s) => new Set(s).add(section));
          if (sectionIssues.length === 0 && index < SECTION_IDS.length - 1) go(SECTION_IDS[index + 1]!);
        }}
      >
        {body}
        {sectionWarnings.map((w) => (
          <p key={w.key} className="notice">
            {w.message}
          </p>
        ))}
        {showErrors && sectionIssues.length > 0 ? (
          <p className="error-text" role="alert">
            Please fix the highlighted answers ({sectionIssues.length}).
          </p>
        ) : null}
        <div className="button-row">
          {index > 0 ? (
            <button type="button" className="btn secondary" onClick={() => go(SECTION_IDS[index - 1]!)}>
              Back
            </button>
          ) : null}
          {section !== "s12_submit" ? (
            <button type="submit" className="btn">
              Save and continue
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
