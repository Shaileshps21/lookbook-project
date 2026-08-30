import { useEffect, useState } from "react";
import Loader from "../../components/common/Loader";
import { fetchAuditLogs, type AuditLogEntry } from "../../services/adminService";

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      setLoading(true);
      fetchAuditLogs()
        .then(setLogs)
        .catch(() => setLogs([]))
        .finally(() => setLoading(false));
    };
    load();
  }, []);

  if (loading) return <Loader label="Loading audit logs..." />;

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-1">Audit Log</h2>
      <p className="text-xs text-slate-400 mb-5">Every admin action — approvals, suspensions, refunds, payouts — recorded append-only.</p>

      {logs.length === 0 ? (
        <p className="text-slate-400 text-sm">No admin actions recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="border border-slate-100 rounded-2xl p-3 text-sm flex items-center justify-between gap-3">
              <div>
                <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded-full mr-2">{log.action}</span>
                <span className="text-slate-600">
                  {log.targetType}
                  {log.targetId ? ` #${log.targetId.slice(-6)}` : ""}
                </span>
                <span className="text-slate-400"> by {log.admin?.name ?? "unknown"}</span>
              </div>
              <span className="text-xs text-slate-400 shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogs;
