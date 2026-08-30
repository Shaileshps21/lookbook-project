import { useEffect, useState } from "react";
import Loader from "../common/Loader";
import { fetchSellerOrders, type SellerOrder } from "../../services/sellerService";
import { formatPrice } from "../../utils/format";

const SellerOrders = () => {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSellerOrders()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Loading orders..." />;

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-5">Orders For Your Books</h2>
      {orders.length === 0 ? (
        <p className="text-slate-500 text-sm">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="border border-slate-100 rounded-2xl p-4">
              <p className="text-xs text-slate-400 mb-2">
                {new Date(order.createdAt).toLocaleDateString()} · {order.buyer?.name} ({order.buyer?.email}) ·{" "}
                <span className="capitalize">{order.paymentStatus}</span> · {order.status}
              </p>
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm py-1">
                  <span className="text-slate-700">
                    {item.book.title} <span className="text-slate-400 capitalize">({item.mode} × {item.quantity})</span>
                  </span>
                  <span className="font-medium text-slate-800">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SellerOrders;
