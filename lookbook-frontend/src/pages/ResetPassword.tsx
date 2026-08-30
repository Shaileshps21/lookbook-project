import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
import AuthCard from "../components/auth/AuthCard";
import FormField from "../components/auth/FormField";
import Button from "../components/common/Button";
import { resetPasswordRequest } from "../services/authService";
import { ApiClientError } from "../services/apiClient";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("This reset link is missing its token.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await resetPasswordRequest(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't reset your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Reset Password"
      subtitle="Choose a new password for your account."
      footer={
        <>
          Back to{" "}
          <Link to="/login" className="text-amber-600 font-semibold hover:underline">
            login
          </Link>
        </>
      }
    >
      {done ? (
        <p className="text-slate-600 text-center">
          Password reset! Redirecting you to login...
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <FormField
            label="New Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <Button type="submit" fullWidth icon={<KeyRound size={18} />} disabled={submitting}>
            {submitting ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
};

export default ResetPassword;
