import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  loginRequest,
  registerRequest,
  logoutRequest,
  refreshSession,
  verifyTwoFactorLoginRequest,
} from "../services/authService";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  initializing: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  completeTwoFactorLogin: (challengeToken: string, token: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // On first load there's no client-stored token to check — the access
  // token lives in memory only, so it's always gone after a hard refresh.
  // Restore the session (if any) via the httpOnly refresh cookie instead.
  useEffect(() => {
    refreshSession()
      .then(setUser)
      .finally(() => setInitializing(false));
  }, []);

  const login = async (email: string, password: string, rememberMe = true) => {
    setLoading(true);
    try {
      const loggedIn = await loginRequest(email, password, rememberMe);
      setUser(loggedIn);
      return loggedIn;
    } finally {
      setLoading(false);
    }
  };

  const completeTwoFactorLogin = async (challengeToken: string, token: string) => {
    setLoading(true);
    try {
      const loggedIn = await verifyTwoFactorLoginRequest(challengeToken, token);
      setUser(loggedIn);
      return loggedIn;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const registered = await registerRequest(name, email, password);
      setUser(registered);
      return registered;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await logoutRequest();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, initializing, login, register, completeTwoFactorLogin, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
