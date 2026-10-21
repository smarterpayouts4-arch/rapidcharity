import { Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ApplicationProvider } from "@/context/ApplicationContext";
import { SignInPage } from "@/features/application/SignInPage";
import { SignInFinishPage } from "@/features/application/SignInFinishPage";
import { HomePage } from "@/features/application/HomePage";
import { ApplicationWizard } from "@/features/application/ApplicationWizard";
import { SubmittedPage } from "@/features/application/SubmittedPage";
import { AdminPage } from "@/features/admin/AdminPage";

export function App() {
  return (
    <AuthProvider>
      <ApplicationProvider>
        <div className="app-shell">
          {import.meta.env.VITE_PREVIEW_BANNER === "1" ? (
            <p role="note" className="error-text" style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>
              RAPID test environment. Use fictional details and placeholder documents only. This is not the real application.
            </p>
          ) : null}
          <header>
            <Link to="/" className="brand">
              RAPID Scholarship
            </Link>
            <p style={{ margin: 0, fontSize: "0.95rem" }}>Spring 2027 application</p>
          </header>
          <main className="card" style={{ marginTop: "1rem" }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/sign-in/finish" element={<SignInFinishPage />} />
              <Route path="/application/:applicationId" element={<ApplicationWizard />} />
              <Route path="/application/:applicationId/:sectionId" element={<ApplicationWizard />} />
              <Route path="/submitted/:applicationId" element={<SubmittedPage />} />
              <Route path="/admin/*" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </ApplicationProvider>
    </AuthProvider>
  );
}
