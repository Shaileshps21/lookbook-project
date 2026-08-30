import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import AuthCard from "../components/auth/AuthCard";
import FormField from "../components/auth/FormField";
import Button from "../components/common/Button";
import { forgotPasswordRequest } from "../services/authService";
import { ApiClientError } from "../services/apiClient";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await forgotPasswordRequest(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't send the reset email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Forgot Password"
      subtitle="We'll email you a link to reset it."
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="text-amber-600 font-semibold hover:underline">
            Back to login
          </Link>
        </>
      }
    >
      {sent ? (
        <p className="text-slate-600 text-center">
          If that email is registered, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <FormField
            label="Email Address"
            type="email"
            placeholder="enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <Button type="submit" fullWidth icon={<Mail size={18} />} disabled={submitting}>
            {submitting ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
};

export default ForgotPassword;
