import { useState } from "react";
import { Mail } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { updateEmailPreferences } from "../../services/userService";
import type { EmailPreferences } from "../../types";

const DEFAULT_PREFS: EmailPreferences = {
  orderUpdates: true,
  rentalReminders: true,
  priceDropAlerts: true,
  sellerNotifications: true,
  marketing: true,
};

const TOGGLES: { key: keyof EmailPreferences; label: string; hint: string }[] = [
  { key: "orderUpdates", label: "Order updates", hint: "Confirmations, refunds, tracking" },
  { key: "rentalReminders", label: "Rental reminders", hint: "Due-date alerts" },
  { key: "priceDropAlerts", label: "Price drop alerts", hint: "For wishlisted books" },
  { key: "sellerNotifications", label: "Seller notifications", hint: "Payouts, listing updates" },
  { key: "marketing", label: "Marketing emails", hint: "New features, newsletters" },
];

const NotificationsSection = () => {
  const { user, setUser } = useAuth();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  if (!user) return null;
  const prefs = user.emailPreferences ?? DEFAULT_PREFS;

  const handleToggle = async (key: keyof EmailPreferences) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setUser({ ...user, emailPreferences: next }); // optimistic
    setSavingKey(key);
    try {
      const saved = await updateEmailPreferences({ [key]: next[key] });
      setUser({ ...user, emailPreferences: saved });
    } catch {
      setUser({ ...user, emailPreferences: prefs }); // revert on failure
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
        <Mail size={16} className="text-amber-600" /> Email Notifications
      </h2>
      <p className="text-xs text-slate-400 mb-4">Choose which emails you'd like to receive from LookBook.</p>

      <div className="space-y-3">
        {TOGGLES.map(({ key, label, hint }) => (
          <div key={key} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
            <div>
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-400">{hint}</p>
            </div>
            <button
              onClick={() => handleToggle(key)}
              disabled={savingKey === key}
              role="switch"
              aria-checked={prefs[key]}
              aria-label={label}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                prefs[key] ? "bg-amber-500" : "bg-slate-200"
              } disabled:opacity-60`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  prefs[key] ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationsSection;
