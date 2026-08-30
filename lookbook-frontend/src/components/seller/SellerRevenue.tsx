import { useEffect, useState } from "react";
import { Wallet, TrendingUp, Clock } from "lucide-react";
import Loader from "../common/Loader";
import Button from "../common/Button";
import { fetchSellerRevenue, requestPayoutRequest, type SellerRevenue as SellerRevenueData } from "../../services/sellerService";
import { formatPrice } from "../../utils/format";
import { ApiClientError } from "../../services/apiClient";

const statusStyles: Record<string, string> = {
  requested: "bg-amber-50 text-amber-700",
  paid: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

const SellerRevenueTab = () => {
  const [data, setData] = useState<SellerRevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    fetchSellerRevenue()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleRequest = async () => {
    setError("");
    setRequesting(true);
    try {
      await requestPayoutRequest(Number(amount));
      setAmount("");
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't request payout.");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return <Loader label="Loading revenue..." />;
  if (!data) return <p className="text-slate-500">Couldn't load revenue data.</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
        <h2 className="font-bold text-slate-900 mb-1">Revenue & Payouts</h2>
        <p className="text-xs text-slate-400 mb-5">
          Platform commission: {Math.round(data.commissionRate * 100)}% (illustrative flat rate)
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-2xl p-4">
            <TrendingUp size={18} className="text-blue-600" />
            <p className="text-xl font-bold text-slate-900 mt-2">{formatPrice(data.grossRevenue)}</p>
            <p className="text-xs text-slate-500">Gross Revenue</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-xl font-bold text-slate-900 mt-2">{formatPrice(data.commission)}</p>
            <p className="text-xs text-slate-500">Platform Commission</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-4">
            <Wallet size={18} className="text-green-600" />
            <p className="text-xl font-bold text-slate-900 mt-2">{formatPrice(data.netEarnings)}</p>
            <p className="text-xs text-slate-500">Net Earnings</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4">
            <Clock size={18} className="text-amber-600" />
            <p className="text-xl font-bold text-slate-900 mt-2">{formatPrice(data.availableBalance)}</p>
            <p className="text-xs text-slate-500">Available to Withdraw</p>
          </div>
        </div>

        <div className="flex gap-2 items-end">
          <label className="text-sm">
            <span className="text-slate-600 block mb-1">Request Payout</span>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-amber-400 w-40"
            />
          </label>
          <Button onClick={handleRequest} disabled={requesting || !amount}>
            {requesting ? "Requesting..." : "Request"}
          </Button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
        <h3 className="font-bold text-slate-900 mb-4">Payout History</h3>
        {data.payouts.length === 0 ? (
          <p className="text-slate-400 text-sm">No payout requests yet.</p>
        ) : (
          <div className="space-y-2">
            {data.payouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between text-sm border-b border-slate-50 last:border-0 py-2">
                <span className="text-slate-600">{new Date(payout.requestedAt).toLocaleDateString()}</span>
                <span className="font-medium text-slate-800">{formatPrice(payout.amount)}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyles[payout.status]}`}>{payout.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerRevenueTab;
