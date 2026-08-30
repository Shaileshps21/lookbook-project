import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import {
  fetchPendingSellers,
  approveSellerRequest,
  rejectSellerRequest,
  type PendingSellerApplication,
} from "../../services/adminService";

const AdminSellers = () => {
  const [applications, setApplications] = useState<PendingSellerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    fetchPendingSellers()
      .then(setApplications)
      .catch(() => setApplications([]))
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await approveSellerRequest(id);
      setApplications((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    try {
      await rejectSellerRequest(id, reason);
      setApplications((prev) => prev.filter((a) => a.id !== id));
      setRejectingId(null);
      setReason("");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Loader label="Loading applications..." />;

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-4">Pending Seller Applications</h2>
      {applications.length === 0 ? (
        <p className="text-slate-400 text-sm">No pending applications.</p>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-800">{app.name}</p>
                  <p className="text-xs text-slate-400">{app.email}</p>
                  <p className="text-xs text-slate-400">
                    Requested {app.sellerApplication.requestedAt ? new Date(app.sellerApplication.requestedAt).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" icon={<CheckCircle2 size={14} />} onClick={() => handleApprove(app.id)} disabled={busyId === app.id}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<XCircle size={14} />}
                    onClick={() => setRejectingId(rejectingId === app.id ? null : app.id)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
              {rejectingId === app.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (emailed to applicant)"
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
                  />
                  <Button size="sm" variant="danger" onClick={() => handleReject(app.id)} disabled={busyId === app.id}>
                    Confirm
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminSellers;
