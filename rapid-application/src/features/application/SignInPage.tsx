import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export function SignInPage() {
  const { sendLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <h2>Sign in</h2>
      <p>We will email you a secure link. You can open it on this device or another one.</p>
      {sent ? (
        <p role="status">Check your email for the sign-in link.</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              await sendLink(email.trim());
              setSent(true);
            } catch {
              setError("Could not send link. Use the emulator inbox if testing locally.");
            }
          }}
        >
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="btn" type="submit">
            Email me a sign-in link
          </button>
        </form>
      )}
    </div>
  );
}
