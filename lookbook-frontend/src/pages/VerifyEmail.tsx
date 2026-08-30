import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import AuthCard from "../components/auth/AuthCard";
import Loader from "../components/common/Loader";
import { verifyEmailRequest } from "../services/authService";
import { ApiClientError } from "../services/apiClient";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "This verification link is missing its token.");

  useEffect(() => {
    if (!token) return;
    verifyEmailRequest(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiClientError ? err.message : "Couldn't verify your email.");
      });
  }, [token]);

  return (
    <AuthCard
      title="Email Verification"
      subtitle=""
      footer={
        <Link to="/profile" className="text-amber-600 font-semibold hover:underline">
          Go to your profile
        </Link>
      }
    >
      {status === "loading" && <Loader label="Verifying your email..." />}
      {status === "success" && (
        <div className="text-center">
          <CheckCircle2 size={48} className="text-green-500 mx-auto" />
          <p className="text-slate-600 mt-4">Your email has been verified.</p>
        </div>
      )}
      {status === "error" && (
        <div className="text-center">
          <XCircle size={48} className="text-red-500 mx-auto" />
          <p className="text-slate-600 mt-4">{message}</p>
        </div>
      )}
    </AuthCard>
  );
};

export default VerifyEmail;
