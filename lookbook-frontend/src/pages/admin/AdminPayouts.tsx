import { useEffect, useState } from "react";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { api } from "../../services/apiClient";
import { formatPrice } from "../../utils/format";

interface PendingPayout {
  id: string;
  amount: number;
  requestedAt: string;
  seller: { name: string; email: string };
}

const fetchPendingPayouts = async (): Promise<PendingPayout[]> => {
  const { data } = await api.get<PendingPayout[]>("/admin/payouts/pending");
  return data;
};

const resolvePayoutRequest = (id: string, status: "paid" | "rejected", note?: string) =>
  api.patch<null>(`/admin/payouts/${id}/resolve`, { status, note });

const AdminPayouts = () => {
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingPayouts()
      .then(setPayouts)
      .catch(() => setPayouts([]))
      .finally(() => setLoading(false));
  }, []);

  const handleResolve = async (id: string, status: "paid" | "rejected") => {
    setBusyId(id);
    try {
      await resolvePayoutRequest(id, status);
      setPayouts((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Loader label="Loading payout requests..." />;

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-5">Pending Payout Requests</h2>
      {payouts.length === 0 ? (
        <p className="text-slate-400 text-sm">No pending payout requests.</p>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout) => (
            <div key={payout.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-2xl p-4">
              <div>
                <p className="font-medium text-slate-800">
                  {payout.seller?.name} <span className="text-slate-400 font-normal">({payout.seller?.email})</span>
                </p>
                <p className="text-xs text-slate-400">Requested {new Date(payout.requestedAt).toLocaleDateString()}</p>
              </div>
              <p className="font-bold text-slate-900">{formatPrice(payout.amount)}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleResolve(payout.id, "paid")} disabled={busyId === payout.id}>
                  Mark Paid
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleResolve(payout.id, "rejected")} disabled={busyId === payout.id}>
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPayouts;
