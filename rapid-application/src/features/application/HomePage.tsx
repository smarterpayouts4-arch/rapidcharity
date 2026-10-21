import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useApplication } from "@/context/ApplicationContext";

function applicantName(sections: { s1_about: Record<string, unknown> }): string {
  const name = `${String(sections.s1_about.firstName ?? "")} ${String(sections.s1_about.lastName ?? "")}`.trim();
  return name || "Unnamed applicant";
}

export function HomePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { applications, loading, startApplication } = useApplication();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading || (user && loading)) return <p>Loading…</p>;
  if (!user) {
    return (
      <div>
        <p>Apply for a RAPID scholarship for Spring 2027. Sign in with your email to start or continue an application.</p>
        <Link className="btn" to="/sign-in">
          Sign in to start
        </Link>
        <p style={{ marginTop: "1rem" }}>
          <a href="https://www.rapidcharity.org/apply">Return to the RAPID information page</a>
        </p>
      </div>
    );
  }

  async function onStart() {
    setBusy(true);
    setError(null);
    try {
      const app = await startApplication();
      navigate(`/application/${app.applicationId}/s1_about`);
    } catch {
      setError("Could not start an application. Applications may be closed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p>
        Signed in as <strong>{user.email}</strong>.{" "}
        <button type="button" className="link-button" onClick={() => void logout()}>
          Sign out
        </button>
      </p>
      {applications.length ? (
        <ul className="application-list">
          {applications.map((a) => (
            <li key={a.applicationId}>
              <strong>{applicantName(a.sections)}</strong>{" "}
              {a.status === "submitted" ? (
                <>
                  Submitted. Receipt <code>{a.receiptCode}</code> <Link to={`/submitted/${a.applicationId}`}>View</Link>
                </>
              ) : (
                <>
                  Draft. <Link to={`/application/${a.applicationId}/s1_about`}>Continue</Link>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>You have no applications yet.</p>
      )}
      <button type="button" className="btn" disabled={busy} onClick={() => void onStart()}>
        {applications.length ? "Start another application" : "Start an application"}
      </button>
      <p className="hint">Brothers and sisters who share an email can each have their own application here.</p>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
