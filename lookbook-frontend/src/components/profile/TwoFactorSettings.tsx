import { useState } from "react";
import { ShieldCheck, ShieldOff, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import Button from "../common/Button";
import { setupTwoFactorRequest, confirmTwoFactorRequest, disableTwoFactorRequest } from "../../services/authService";
import { ApiClientError } from "../../services/apiClient";

const TwoFactorSettings = () => {
  const { user, setUser } = useAuth();
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;
  const enabled = Boolean(user.twoFactorEnabled);

  const handleStartSetup = async () => {
    setBusy(true);
    setError("");
    try {
      setSetupData(await setupTwoFactorRequest());
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError("");
    try {
      await confirmTwoFactorRequest(code);
      setUser({ ...user, twoFactorEnabled: true });
      setSetupData(null);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Invalid code.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setError("");
    try {
      await disableTwoFactorRequest(code);
      setUser({ ...user, twoFactorEnabled: false });
      setCode("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Invalid code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-slate-900">Two-Factor Authentication</h2>
        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full ${enabled ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Adds a 6-digit code from an authenticator app (Google Authenticator, Authy, etc.) as a second login step.
      </p>

      {!enabled && !setupData && (
        <Button size="sm" icon={<ShieldCheck size={14} />} onClick={handleStartSetup} disabled={busy}>
          Enable 2FA
        </Button>
      )}

      {setupData && (
        <div className="border border-slate-100 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-slate-600">
            Scan or manually add this secret in your authenticator app, then enter the code it generates.
          </p>
          <p className="font-mono text-xs bg-slate-50 rounded-xl p-3 break-all">{setupData.secret}</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
            />
            <Button size="sm" onClick={handleConfirm} disabled={busy}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => setSetupData(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code to disable"
            maxLength={6}
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
          />
          <Button size="sm" variant="danger" icon={<ShieldOff size={14} />} onClick={handleDisable} disabled={busy}>
            Disable
          </Button>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
    </div>
  );
};

export default TwoFactorSettings;
