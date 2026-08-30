import { useEffect, useState } from "react";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { fetchPendingDamageReports, resolveDamageReportRequest, type PendingDamageReport } from "../../services/adminService";

const AdminDamageReports = () => {
  const [orders, setOrders] = useState<PendingDamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPendingDamageReports()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const handleResolve = async (orderId: string, itemIndex: number) => {
    const key = `${orderId}-${itemIndex}`;
    setBusyKey(key);
    try {
      const fee = feeInputs[key] ? Number(feeInputs[key]) : undefined;
      await resolveDamageReportRequest(orderId, itemIndex, fee);
      setOrders((prev) =>
        prev
          .map((o) =>
            o.id === orderId
              ? { ...o, items: o.items.filter((_, idx) => idx !== itemIndex || !o.items[idx].damageReport) }
              : o
          )
          .filter((o) => o.items.some((i) => i.damageReport?.status === "pending"))
      );
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) return <Loader label="Loading damage reports..." />;

  const rows = orders.flatMap((order) =>
    order.items
      .map((item, idx) => ({ order, item, idx }))
      .filter(({ item }) => item.damageReport?.status === "pending")
  );

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-5">Pending Damage Reports</h2>
      {rows.length === 0 ? (
        <p className="text-slate-400 text-sm">No pending damage reports.</p>
      ) : (
        <div className="space-y-4">
          {rows.map(({ order, item, idx }) => {
            const key = `${order.id}-${idx}`;
            return (
              <div key={key} className="border border-slate-100 rounded-2xl p-4">
                <p className="text-sm font-medium text-slate-800">{item.book.title}</p>
                <p className="text-xs text-slate-400 mb-2">
                  {order.user?.name} ({order.user?.email}) · Reported {item.damageReport && new Date(item.damageReport.reportedAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-slate-600 mb-3">"{item.damageReport?.reason}"</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={feeInputs[key] ?? ""}
                    onChange={(e) => setFeeInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="Fee charged (₹, optional)"
                    className="px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400 w-48"
                  />
                  <Button size="sm" onClick={() => handleResolve(order.id, idx)} disabled={busyKey === key}>
                    {busyKey === key ? "Resolving..." : "Mark Resolved"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDamageReports;
