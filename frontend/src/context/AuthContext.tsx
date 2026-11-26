import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  authApi,
  clearToken,
  getToken,
  setToken,
  type KhangUser,
} from "../lib/api";
import { supabase } from "../lib/supabase";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "user" | "admin";
  joinedAt: string;
}

interface AuthContextValue {
  user: User | null;
  /** True while the saved JWT is being checked against the backend. */
  checkingSession: boolean;
  isAuthOpen: boolean;
  authMode: "login" | "signup";
  openAuth: (mode?: "login" | "signup") => void;
  closeAuth: () => void;
  setAuthMode: (mode: "login" | "signup") => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    phone?: string,
  ) => Promise<void>;
  /** Sends the browser to Google; the session comes back via the redirect. */
  signInWithGoogle: () => Promise<void>;
  logout: () => void;
  /** Set when a sign-in triggered by a redirect failed, for the dialog to show. */
  oauthError: string | null;
  clearOAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "khang_user";

function toUser(u: KhangUser): User {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    joinedAt: u.createdAt || new Date().toISOString(),
  };
}

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [oauthError, setOauthError] = useState<string | null>(null);

  const persist = useCallback((u: User | null) => {
    // Wrapped because this runs inside login/signup/logout: a storage failure
    // must not abort those flows. On logout in particular, throwing here would
    // skip clearToken() and the Supabase sign-out, leaving a session that comes
    // back on the next reload.
    try {
      if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — the in-memory session still works */
    }
  }, []);

  // A visitor arriving back from Google has an #access_token=… fragment. Claim
  // it once, on mount, and tidy the URL so a refresh does not replay it. This
  // runs before the session check below, which would otherwise find only the
  // mirror and treat the visit as signed-out.
  useEffect(() => {
    if (!authApi.hasOAuthRedirect()) return;
    let alive = true;

    (async () => {
      try {
        const { token, user: u } = await authApi.completeOAuthSignIn();
        if (!alive) return;
        setToken(token);
        const usr = toUser(u);
        setUser(usr);
        persist(usr);
        setOauthError(null);
      } catch (err: unknown) {
        if (!alive) return;
        setOauthError(err instanceof Error ? err.message : "Google sign-in did not complete.");
      } finally {
        if (!alive) return;
        // strip the fragment either way — replaying it would loop
        const clean = window.location.pathname + window.location.search;
        window.history.replaceState(null, "", clean);
      }
    })();

    return () => {
      alive = false;
    };
  }, [persist]);

  // On reload: validate the saved token against the backend so a deleted user
  // or an expired session cannot keep a fake login alive.
  useEffect(() => {
    let alive = true;

    (async () => {
      // With Supabase the real session lives in the client's own storage, so
      // the app's token is only a mirror — recover it when the mirror is gone.
      let token = getToken();
      if (!token && supabase) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token ?? null;
        if (token) setToken(token);
      }
      if (!alive) return;

      if (!token) {
        setUser(null);
        persist(null);
        setCheckingSession(false);
        return;
      }

      const cached = readCachedUser();
      if (cached) setUser(cached);

      try {
        const { user: fresh } = await authApi.me();
        if (!alive) return;
        const u = toUser(fresh);
        setUser(u);
        persist(u);
      } catch (err: unknown) {
        // Only sign out on a genuine auth failure — keep the cached session
        // during a temporary network outage.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearToken();
          persist(null);
          setUser(null);
        }
      } finally {
        if (alive) setCheckingSession(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [persist]);

  const openAuth = useCallback((mode: "login" | "signup" = "login") => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => setIsAuthOpen(false), []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user: u } = await authApi.login({
        email: email.trim().toLowerCase(),
        password,
      });
      setToken(token);
      const usr = toUser(u);
      setUser(usr);
      persist(usr);
      setIsAuthOpen(false);
    },
    [persist],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string, phone?: string) => {
      const { token, user: u } = await authApi.signup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone?.trim() || undefined,
      });
      setToken(token);
      const usr = toUser(u);
      setUser(usr);
      persist(usr);
      setIsAuthOpen(false);
    },
    [persist],
  );

  const signInWithGoogle = useCallback(async () => {
    setOauthError(null);
    try {
      await authApi.startOAuth("google");
      // on success the page is already navigating; nothing below runs
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Google sign-in could not start.";
      setOauthError(message);
      throw err;
    }
  }, []);

  const clearOAuthError = useCallback(() => setOauthError(null), []);

  const logout = useCallback(() => {
    setUser(null);
    persist(null);
    clearToken();
    // With Supabase this ends the auth session as well, so a reload cannot
    // resurrect it from the client's own storage.
    void authApi.logout();
  }, [persist]);

  return (
    <AuthContext.Provider
      value={{
        user,
        checkingSession,
        isAuthOpen,
        authMode,
        openAuth,
        closeAuth,
        setAuthMode,
        login,
        signup,
        logout,
        signInWithGoogle,
        oauthError,
        clearOAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
