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
  logout: () => void;
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

  const persist = useCallback((u: User | null) => {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  // On reload: validate the saved token against the API so a deleted user or
  // expired JWT cannot keep a fake session alive.
  useEffect(() => {
    const cached = readCachedUser();
    const token = getToken();

    if (!token) {
      setUser(null);
      persist(null);
      setCheckingSession(false);
      return;
    }

    if (cached) setUser(cached);

    authApi
      .me()
      .then(({ user: fresh }) => {
        const u = toUser(fresh);
        setUser(u);
        persist(u);
      })
      .catch((err: unknown) => {
        // Only sign out on a genuine auth failure — keep the cached session
        // during a temporary network outage.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearToken();
          persist(null);
          setUser(null);
        }
      })
      .finally(() => setCheckingSession(false));
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
