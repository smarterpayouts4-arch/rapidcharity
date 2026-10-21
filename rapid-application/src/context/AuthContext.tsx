import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut,
  type User,
} from "firebase/auth";
import { emailLinkSettings, getFirebaseAuth } from "@/lib/firebase/client";

type AuthState = {
  user: User | null;
  loading: boolean;
  sendLink: (email: string) => Promise<void>;
  completeLink: (email: string, link: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      async sendLink(email: string) {
        const auth = getFirebaseAuth();
        window.localStorage.setItem("rapidApplyEmail", email);
        await sendSignInLinkToEmail(auth, email, emailLinkSettings());
      },
      async completeLink(email: string, link: string) {
        if (!isSignInWithEmailLink(getFirebaseAuth(), link)) {
          throw new Error("Invalid sign-in link");
        }
        await signInWithEmailLink(getFirebaseAuth(), email, link);
        window.localStorage.removeItem("rapidApplyEmail");
      },
      async logout() {
        await signOut(getFirebaseAuth());
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider required");
  return ctx;
}
