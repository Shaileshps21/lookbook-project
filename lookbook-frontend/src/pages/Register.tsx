import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import AuthCard from "../components/auth/AuthCard";
import FormField from "../components/auth/FormField";
import Button from "../components/common/Button";
import { useAuth } from "../hooks/useAuth";
import { ApiClientError } from "../services/apiClient";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const Register = () => {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError("");
    try {
      const registered = await register(name, email, password);
      navigate(registered.preferences?.onboardingCompleted ? "/profile" : "/onboarding");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't create your account.");
    }
  };

  return (
    <AuthCard
      title="Create Your Account"
      subtitle="Join thousands of readers on LookBook."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-amber-600 font-semibold hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {/* OAuth Buttons */}
      <div className="flex flex-col gap-3 mb-6">
        <a
          href={`${API_URL}/auth/google`}
          id="btn-google-register"
          className="flex items-center justify-center gap-3 py-3 px-4 rounded-2xl border-2 border-slate-200 bg-white text-slate-700 font-semibold hover:border-amber-400 hover:bg-amber-50 hover:shadow-md transition-all duration-200"
        >
          <span className="flex items-center justify-center w-5 h-5">
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </span>
          <span>Sign up with Google</span>
        </a>
      </div>

      <div className="flex items-center gap-3 mb-6 text-xs text-slate-400 uppercase tracking-wider">
        <div className="h-px bg-slate-200 flex-1" />
        or create with email
        <div className="h-px bg-slate-200 flex-1" />
      </div>

      <form onSubmit={handleSubmit}>
        <FormField
          label="Full Name"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <Button type="submit" fullWidth icon={<UserPlus size={18} />} disabled={loading}>
          {loading ? "Creating account..." : "Get Started"}
        </Button>

        <p className="text-xs text-slate-400 text-center mt-4">
          You'll need to verify your email before placing orders. OAuth sign-ups are verified instantly.
        </p>
      </form>
    </AuthCard>
  );
};

export default Register;
