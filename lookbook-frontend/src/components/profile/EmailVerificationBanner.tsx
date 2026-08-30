import { useState } from "react";
import { MailWarning } from "lucide-react";
import Button from "../common/Button";
import { resendVerificationRequest } from "../../services/authService";

const EmailVerificationBanner = () => {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleResend = async () => {
    setSending(true);
    try {
      await resendVerificationRequest();
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-amber-800">
        <MailWarning size={20} />
        <p className="text-sm font-medium">
          {sent ? "Verification email sent — check your inbox." : "Please verify your email address."}
        </p>
      </div>
      {!sent && (
        <Button variant="outline" size="sm" onClick={handleResend} disabled={sending}>
          {sending ? "Sending..." : "Resend email"}
        </Button>
      )}
    </div>
  );
};

export default EmailVerificationBanner;
