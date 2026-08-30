import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogIn, ShieldCheck } from "lucide-react";
import AuthCard from "../components/auth/AuthCard";
import FormField from "../components/auth/FormField";
import Button from "../components/common/Button";
import { useAuth } from "../hooks/useAuth";
import { ApiClientError } from "../services/apiClient";
import { TwoFactorRequiredError } from "../services/authService";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const Login = () => {
  const { login, completeTwoFactorLogin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const redirectAfterLogin = () => {
    const redirectTo = (location.state as { from?: string })?.from ?? "/profile";
    navigate(redirectTo);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in both fields.");
      return;
    }
    setError("");
    try {
      await login(email, password, rememberMe);
      redirectAfterLogin();
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        setChallengeToken(err.challengeToken);
        return;
      }
      setError(err instanceof ApiClientError ? err.message : "Couldn't log in. Please try again.");
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken || !code) return;
    setError("");
    try {
      await completeTwoFactorLogin(challengeToken, code);
      redirectAfterLogin();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Invalid code.");
    }
  };

  if (challengeToken) {
    return (
      <AuthCard title="Enter Your Code" subtitle="Open your authenticator app and enter the 6-digit code.">
        <form onSubmit={handleVerifyCode}>
          <FormField
            label="Authentication Code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
          />
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <Button type="submit" fullWidth icon={<ShieldCheck size={18} />} disabled={loading}>
            {loading ? "Verifying..." : "Verify & Log In"}
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Welcome Back"
      subtitle="Log in to continue your reading journey."
      footer={
        <>
          New to LookBook?{" "}
          <Link to="/register" className="text-amber-600 font-semibold hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {/* OAuth Buttons */}
      <div className="flex flex-col gap-3 mb-6">
        <a
          href={`${API_URL}/auth/google`}
          id="btn-google-login"
          className="flex items-center justify-center gap-3 py-3 px-4 rounded-2xl border-2 border-slate-200 bg-white text-slate-700 font-semibold hover:border-amber-400 hover:bg-amber-50 hover:shadow-md transition-all duration-200 group"
        >
          <span className="flex items-center justify-center w-5 h-5">
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </span>
          <span>Continue with Google</span>
        </a>
      </div>

      <div className="flex items-center gap-3 mb-6 text-xs text-slate-400 uppercase tracking-wider">
        <div className="h-px bg-slate-200 flex-1" />
        or sign in with email
        <div className="h-px bg-slate-200 flex-1" />
      </div>

      <form onSubmit={handleSubmit}>
        <FormField
          label="Email Address"
          type="email"
          placeholder="enter email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex items-center justify-between mb-5 text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-amber-600 font-semibold hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <Button type="submit" fullWidth icon={<LogIn size={18} />} disabled={loading}>
          {loading ? "Logging in..." : "Log In"}
        </Button>
      </form>
    </AuthCard>
  );
};

export default Login;
