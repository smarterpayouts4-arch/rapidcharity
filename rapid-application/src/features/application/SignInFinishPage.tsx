import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function SignInFinishPage() {
  const { completeLink, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [needEmail, setNeedEmail] = useState(false);
  const [email, setEmail] = useState("");
  const started = useRef(false);

  async function finish(address: string) {
    try {
      await completeLink(address, window.location.href);
      navigate("/", { replace: true });
    } catch {
      setError("This sign-in link is invalid or has expired. Request a new one.");
    }
  }

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
      return;
    }
    if (started.current) return;
    started.current = true;
    const saved = window.localStorage.getItem("rapidApplyEmail");
    if (saved) void finish(saved);
    else setNeedEmail(true);
  }, [user]);

  if (error) return <p className="error-text">{error}</p>;
  if (needEmail) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void finish(email.trim());
        }}
      >
        <p>You opened the link on a different device or browser. Type the email address you used to sign in.</p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="btn" type="submit">
          Continue
        </button>
      </form>
    );
  }
  return <p>Completing sign-in…</p>;
}
