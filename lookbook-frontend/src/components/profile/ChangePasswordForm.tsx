import { useState } from "react";
import { KeyRound } from "lucide-react";
import Button from "../common/Button";
import FormField from "../auth/FormField";
import { useAuth } from "../../hooks/useAuth";
import { changePasswordRequest } from "../../services/authService";
import { ApiClientError } from "../../services/apiClient";

const ChangePasswordForm = () => {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setBusy(true);
    try {
      await changePasswordRequest(currentPassword, newPassword);
      setDone(true);
      setTimeout(() => {
        logout();
      }, 1500);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't change your password.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
        <h2 className="font-bold text-slate-900 mb-2">Change Password</h2>
        <p className="text-sm text-green-700 bg-green-50 rounded-2xl p-4">
          Password changed. You'll be logged out of all devices...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-4">Change Password</h2>
      <form onSubmit={handleSubmit} className="max-w-sm">
        <FormField
          label="Current Password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <FormField
          label="New Password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <FormField
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <Button type="submit" icon={<KeyRound size={16} />} disabled={busy}>
          {busy ? "Updating..." : "Update Password"}
        </Button>
      </form>
    </div>
  );
};

export default ChangePasswordForm;
