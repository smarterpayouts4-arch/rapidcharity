import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { loadApplication } from "@/lib/application/firestore";
import type { ScholarshipApplication } from "@/types/application";

export function SubmittedPage() {
  const { applicationId = "" } = useParams();
  const { user, loading } = useAuth();
  const [app, setApp] = useState<ScholarshipApplication | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    loadApplication(applicationId)
      .then(setApp)
      .catch(() => setApp(null));
  }, [applicationId, user]);

  if (loading) return <p>Loading…</p>;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (app === undefined) return <p>Loading…</p>;
  if (!app || app.status !== "submitted") {
    return (
      <p>
        This application has not been submitted. <Link to="/">Back to your applications</Link>
      </p>
    );
  }
  return (
    <div>
      <h2>Application submitted</h2>
      <p>Your receipt code:</p>
      <p className="receipt" data-testid="receipt">
        {app.receiptCode}
      </p>
      <p>Submitted on {new Date(app.submittedAt!).toLocaleString("en-PK")}. Keep this code for your records.</p>
      <p>
        <Link to="/">Back to your applications</Link>
      </p>
    </div>
  );
}
