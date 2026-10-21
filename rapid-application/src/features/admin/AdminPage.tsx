import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "@/context/AuthContext";
import { useLabels } from "@/hooks/useLabels";
import { getFirebaseDb, getFirebaseFunctions } from "@/lib/firebase/client";
import { listDocuments, listSubmittedApplications, loadCycle, saveCycle } from "@/lib/application/firestore";
import { FIELD_LABELS, answerKeys, displayValue } from "@/lib/form/display";
import { DEFAULT_CATALOG_VERSION, DEFAULT_CYCLE_ID, FORM_VERSION, SCHEMA_VERSION, SECTION_LABELS, type SectionId } from "@/lib/validation/constants";
import { SCHOLARSHIP_PROGRAMS, type DocumentRecord, type ScholarshipApplication, type ScholarshipCycle, type ScholarshipProgram } from "@/types/application";
import { buildCsv } from "./csv";

type ReviewItem = { id: string; fieldKey: string; listId: string; rawText: string; applicationId: string; status: string };

const FLAT: SectionId[] = ["s1_about", "s2_contact", "s3_family", "s4_church", "s5_study", "s8_fees", "s9_essay", "s10_refs"];

function useStaffGate() {
  const { user } = useAuth();
  const [state, setState] = useState<"checking" | "staff" | "denied">("checking");
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      let token = await user.getIdTokenResult();
      if (token.claims.staff !== true) {
        try {
          await httpsCallable(getFirebaseFunctions(), "claimStaffAccess")({});
          token = await user.getIdTokenResult(true);
        } catch {
          /* not on the staff list */
        }
      }
      if (!cancelled) setState(token.claims.staff === true ? "staff" : "denied");
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);
  return state;
}

export function AdminPage() {
  const { user, loading } = useAuth();
  const gate = useStaffGate();
  const [tab, setTab] = useState<"applications" | "catalog" | "cycle">("applications");

  if (loading) return <p>Loading…</p>;
  if (!user) {
    return (
      <p>
        <Link to="/sign-in">Sign in</Link> with your RAPID staff email to use the admin tools.
      </p>
    );
  }
  if (gate === "checking") return <p>Checking staff access…</p>;
  if (gate === "denied") return <p className="error-text">This account is not on the RAPID staff list.</p>;

  return (
    <div>
      <h2>Staff</h2>
      <div className="button-row" role="tablist">
        {(["applications", "catalog", "cycle"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "btn" : "btn secondary"} onClick={() => setTab(t)}>
            {t === "applications" ? "Applications" : t === "catalog" ? "Typed-in answers" : "Application round"}
          </button>
        ))}
      </div>
      {tab === "applications" ? <ApplicationsTab /> : tab === "catalog" ? <CatalogReviewTab /> : <CycleTab />}
    </div>
  );
}

function ApplicationsTab() {
  const labels = useLabels();
  const [apps, setApps] = useState<ScholarshipApplication[] | null>(null);
  const [selected, setSelected] = useState<ScholarshipApplication | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSubmittedApplications(DEFAULT_CYCLE_ID)
      .then(setApps)
      .catch(() => setError("Could not load applications."));
  }, []);

  async function exportCsv() {
    if (!apps) return;
    const docs = await Promise.all(apps.map((a) => listDocuments(a.applicationId)));
    const blob = new Blob([buildCsv(apps, docs, labels)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rapid-${DEFAULT_CYCLE_ID}-applications.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!apps) return <p>Loading applications…</p>;
  if (selected) return <ApplicationDetail app={selected} labels={labels} onBack={() => setSelected(null)} />;
  return (
    <section>
      <h3>Submitted applications ({apps.length})</h3>
      <button type="button" className="btn secondary" onClick={() => void exportCsv()} disabled={!apps.length}>
        Export CSV
      </button>
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Receipt</th>
            <th scope="col">Name</th>
            <th scope="col">Submitted</th>
            <th scope="col">Needs review</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.applicationId}>
              <td>
                <button type="button" className="link-button" onClick={() => setSelected(a)}>
                  {a.receiptCode}
                </button>
              </td>
              <td>
                {String(a.sections.s1_about.firstName ?? "")} {String(a.sections.s1_about.lastName ?? "")}
              </td>
              <td>{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString("en-PK") : ""}</td>
              <td>{a.needsReview ? "Yes" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ScholarshipPicker({ app }: { app: ScholarshipApplication }) {
  const [value, setValue] = useState<ScholarshipProgram | "">(app.scholarshipProgram ?? "");
  const [status, setStatus] = useState("");
  async function change(next: ScholarshipProgram | "") {
    setValue(next);
    setStatus("Saving…");
    try {
      await updateDoc(doc(getFirebaseDb(), "scholarshipApplications", app.applicationId), { scholarshipProgram: next || null });
      app.scholarshipProgram = next || null;
      setStatus("Saved.");
    } catch {
      setValue(app.scholarshipProgram ?? "");
      setStatus("Could not save.");
    }
  }
  return (
    <div className="field">
      <label htmlFor="scholarshipProgram">Scholarship</label>
      <select id="scholarshipProgram" value={value} onChange={(e) => void change(e.target.value as ScholarshipProgram | "")}>
        <option value="">Not set</option>
        {SCHOLARSHIP_PROGRAMS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <p className="save-status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

function ApplicationDetail({ app, labels, onBack }: { app: ScholarshipApplication; labels: Map<string, string>; onBack: () => void }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const reload = useCallback(() => listDocuments(app.applicationId).then(setDocuments), [app.applicationId]);
  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <section>
      <button type="button" className="btn secondary" onClick={onBack}>
        Back to list
      </button>
      <h3>Application {app.receiptCode}</h3>
      <p className="hint">
        Application id {app.applicationId}. Form {app.formVersion}, catalog {app.catalogVersion}.
      </p>
      <ScholarshipPicker app={app} />
      {FLAT.map((sectionId) => {
        const values = app.sections[sectionId] as Record<string, unknown>;
        return (
          <div key={sectionId} className="review-block">
            <h4>{SECTION_LABELS[sectionId]}</h4>
            <dl>
              {answerKeys(values).map((k) => (
                <div key={k}>
                  <dt>{FIELD_LABELS[k] ?? k}</dt>
                  <dd>{displayValue(values[k], labels, values[`${k}Other`]) || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
      <div className="review-block">
        <h4>University results</h4>
        <ResultTable rows={app.sections.s6_terms.termResults} labels={labels} first={(r) => labels.get(r.term) ?? r.term} />
        <h4>Earlier education</h4>
        <ResultTable
          rows={app.sections.s7_prior.priorEducation}
          labels={labels}
          first={(r) => `${labels.get(r.level) ?? r.level} ${r.examYear ?? ""} (${labels.get(r.resultStatus) ?? r.resultStatus})`}
        />
      </div>
      <h4>Documents</h4>
      {documents.length === 0 ? <p>No documents.</p> : null}
      {documents.map((d) => (
        <DocumentRow key={d.documentId} app={app} record={d} onChanged={() => void reload()} />
      ))}
    </section>
  );
}

function ResultTable<T extends { id: string; resultFormat: string } & Record<string, unknown>>({
  rows,
  labels,
  first,
}: {
  rows: T[];
  labels: Map<string, string>;
  first: (row: T) => string;
}) {
  if (!rows.length) return <p>None.</p>;
  const resultKeys = ["sgpa", "cgpa", "percentage", "marksObtained", "marksTotal", "letterGrade", "division", "passFail"];
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.id}>
          {first(r)}: {labels.get(r.resultFormat) ?? (r.resultFormat || "—")}{" "}
          {resultKeys
            .filter((k) => r[k] !== null && r[k] !== "" && r[k] !== undefined)
            .map((k) => `${k} ${displayValue(r[k], labels, r[`${k}Other`])}`)
            .join(", ")}
        </li>
      ))}
    </ul>
  );
}

function DocumentRow({ app, record, onChanged }: { app: ScholarshipApplication; record: DocumentRecord; onChanged: () => void }) {
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [note, setNote] = useState(record.verificationNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const fn = httpsCallable<object, { contentType: string; dataBase64: string }>(getFirebaseFunctions(), "getScholarshipDocument", { timeout: 150_000 });
      const { data } = await fn({ applicationId: app.applicationId, documentId: record.documentId });
      const bytes = Uint8Array.from(atob(data.dataBase64), (c) => c.charCodeAt(0));
      setPreview({ url: URL.createObjectURL(new Blob([bytes], { type: data.contentType })), type: data.contentType });
    } catch {
      setError("Could not open the file.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "verified" | "rejected") {
    setBusy(true);
    setError(null);
    try {
      await httpsCallable(getFirebaseFunctions(), "setScholarshipDocumentVerification")({
        applicationId: app.applicationId,
        documentId: record.documentId,
        decision,
        note,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the decision.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="doc-row" data-document={record.documentId}>
      <p>
        <strong>{record.label}</strong> ({record.contentType}, {Math.round(record.sizeBytes / 1024)} KB) — status:{" "}
        <span data-testid="verification">{record.verificationStatus}</span>
        {record.uploadStatus !== "stored" ? " (upload not finished)" : ""}
      </p>
      <div className="button-row">
        <button type="button" className="btn secondary" disabled={busy || record.uploadStatus !== "stored"} onClick={() => void open()}>
          View
        </button>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => void decide("verified")}>
          Verify
        </button>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => void decide("rejected")}>
          Reject
        </button>
      </div>
      <label className="sub-label" htmlFor={`note-${record.documentId}`}>
        Note (required to reject)
      </label>
      <input id={`note-${record.documentId}`} type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      {error ? <p className="error-text">{error}</p> : null}
      {preview ? (
        <div className="preview">
          {preview.type.startsWith("image/") ? (
            <img src={preview.url} alt={record.label} />
          ) : (
            <iframe title={record.label} src={preview.url} />
          )}
          <button type="button" className="btn secondary" onClick={() => setPreview(null)}>
            Close preview
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CatalogReviewTab() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  useEffect(() => {
    const q = query(collection(getFirebaseDb(), "scholarshipCatalogReview"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
    void getDocs(q).then((snaps) => setItems(snaps.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReviewItem, "id">) }))));
  }, []);
  if (!items) return <p>Loading…</p>;
  return (
    <section>
      <h3>Typed-in answers to check ({items.length})</h3>
      <p className="hint">Applicants typed these because they could not find them in the list. Add real ones to the catalog in the next catalog update.</p>
      <ul>
        {items.map((r) => (
          <li key={r.id}>
            {r.listId} · {r.fieldKey}: <strong>{r.rawText}</strong>{" "}
            <button
              type="button"
              className="btn secondary"
              onClick={async () => {
                await updateDoc(doc(getFirebaseDb(), "scholarshipCatalogReview", r.id), { status: "resolved", resolvedAt: Date.now() });
                setItems((prev) => (prev ?? []).filter((x) => x.id !== r.id));
              }}
            >
              Mark checked
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CycleTab() {
  const [cycle, setCycle] = useState<ScholarshipCycle | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    void loadCycle(DEFAULT_CYCLE_ID).then(
      (c) =>
        setCycle(
          c ?? {
            cycleId: DEFAULT_CYCLE_ID,
            label: "Spring 2027",
            open: false,
            deadlineAt: null,
            catalogVersion: DEFAULT_CATALOG_VERSION,
            formVersion: FORM_VERSION,
            schemaVersion: SCHEMA_VERSION,
          },
        ),
    );
  }, []);
  if (!cycle) return <p>Loading…</p>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await saveCycle(cycle);
        setMessage("Saved.");
      }}
    >
      <h3>{cycle.label}</h3>
      <div className="field checkbox">
        <label htmlFor="cycle-open">
          <input id="cycle-open" type="checkbox" checked={cycle.open} onChange={(e) => setCycle({ ...cycle, open: e.target.checked })} /> Accepting
          applications
        </label>
      </div>
      <div className="field">
        <label htmlFor="cycle-deadline">Deadline (Pakistan time; leave empty for none)</label>
        <input
          id="cycle-deadline"
          type="datetime-local"
          value={cycle.deadlineAt ? cycle.deadlineAt.slice(0, 16) : ""}
          onChange={(e) => setCycle({ ...cycle, deadlineAt: e.target.value ? `${e.target.value}:00+05:00` : null })}
        />
      </div>
      <button type="submit" className="btn">
        Save
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
