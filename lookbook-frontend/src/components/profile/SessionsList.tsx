import { useEffect, useState } from "react";
import { Laptop, ShieldCheck } from "lucide-react";
import Button from "../common/Button";
import Loader from "../common/Loader";
import { fetchSessions, revokeSessionRequest } from "../../services/authService";
import type { Session } from "../../types";

const describeDevice = (userAgent?: string) => {
  if (!userAgent) return "Unknown device";
  if (/mobile/i.test(userAgent)) return "Mobile browser";
  if (/chrome/i.test(userAgent)) return "Chrome";
  if (/firefox/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent)) return "Safari";
  return "Browser";
};

const SessionsList = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await revokeSessionRequest(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) return <Loader label="Loading sessions..." />;
  if (sessions.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm">
      <h3 className="font-bold text-slate-900 mb-4">Active Sessions</h3>
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Laptop size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 flex items-center gap-2">
                  {describeDevice(session.userAgent)}
                  {session.current && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <ShieldCheck size={14} /> This device
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  Last active {new Date(session.lastUsedAt).toLocaleString()}
                </p>
              </div>
            </div>
            {!session.current && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRevoke(session.id)}
                disabled={revokingId === session.id}
              >
                {revokingId === session.id ? "Revoking..." : "Log out"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SessionsList;
