import { useEffect, useState } from "react";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import {
  fetchAdminOrders,
  updateOrderStatusRequest,
  refundOrderRequest,
  updateOrderTrackingRequest,
} from "../../services/adminService";
import { formatPrice } from "../../utils/format";
import type { Order, OrderStatus } from "../../types";

const statusOptions: OrderStatus[] = ["Placed", "Active", "Delivered", "Returned", "Cancelled"];

const statusStyles: Record<OrderStatus, string> = {
  Placed: "bg-blue-100 text-blue-600",
  Active: "bg-amber-100 text-amber-700",
  Delivered: "bg-green-100 text-green-600",
  Returned: "bg-slate-100 text-slate-500",
  Cancelled: "bg-red-100 text-red-500",
};

interface TrackingDraft {
  trackingNumber: string;
  carrier: string;
  shipmentStatus: "pending" | "in_transit" | "delivered" | "failed" | "";
  trackingUrl: string;
  pickupSlot: string;
}

const AdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingTrackingId, setEditingTrackingId] = useState<string | null>(null);
  const [trackingDraft, setTrackingDraft] = useState<TrackingDraft>({
    trackingNumber: "",
    carrier: "",
    shipmentStatus: "",
    trackingUrl: "",
    pickupSlot: "",
  });

  const openTrackingEditor = (order: Order) => {
    setEditingTrackingId(editingTrackingId === order.id ? null : order.id);
    setTrackingDraft({
      trackingNumber: order.trackingNumber ?? "",
      carrier: order.carrier ?? "",
      shipmentStatus: order.shipmentStatus ?? "",
      trackingUrl: order.trackingUrl ?? "",
      pickupSlot: order.pickupSlot ?? "",
    });
  };

  const handleSaveTracking = async (orderId: string) => {
    setBusyId(orderId);
    try {
      const updated = await updateOrderTrackingRequest(orderId, {
        trackingNumber: trackingDraft.trackingNumber || undefined,
        carrier: trackingDraft.carrier || undefined,
        shipmentStatus: (trackingDraft.shipmentStatus || undefined) as
          | "pending"
          | "in_transit"
          | "delivered"
          | "failed"
          | undefined,
        trackingUrl: trackingDraft.trackingUrl || undefined,
        pickupSlot: trackingDraft.pickupSlot || undefined,
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      setEditingTrackingId(null);
    } finally {
      setBusyId(null);
    }
  };

  const load = () => {
    setLoading(true);
    fetchAdminOrders({ search: search || undefined, status: statusFilter || undefined })
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state for a new fetch
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId);
    try {
      const updated = await updateOrderStatusRequest(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } finally {
      setBusyId(null);
    }
  };

  const handleRefund = async (orderId: string) => {
    setBusyId(orderId);
    try {
      const updated = await refundOrderRequest(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <h2 className="font-bold text-slate-900 flex-1">Orders</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search by user name/email..."
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none bg-white"
        >
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={load}>
          Search
        </Button>
      </div>

      {loading ? (
        <Loader label="Loading orders..." />
      ) : orders.length === 0 ? (
        <p className="text-slate-400 text-sm">No orders match.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="border border-slate-100 rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {order.user?.name ?? "Unknown"} <span className="text-slate-400 font-normal">({order.user?.email})</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(order.createdAt).toLocaleDateString()} · {order.items.length} item(s) · {formatPrice(order.total)} ·{" "}
                    <span className="capitalize">{order.paymentStatus}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyles[order.status]}`}>{order.status}</span>
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                    disabled={busyId === order.id}
                    className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => openTrackingEditor(order)}
                    className="text-xs font-semibold text-amber-600 hover:underline"
                  >
                    {editingTrackingId === order.id ? "Close tracking" : "Tracking"}
                  </button>
                  {order.paymentStatus === "paid" && (
                    <Button size="sm" variant="outline" onClick={() => handleRefund(order.id)} disabled={busyId === order.id}>
                      Refund
                    </Button>
                  )}
                </div>
              </div>

              {editingTrackingId === order.id && (
                <div className="mt-4 grid sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                  <label className="text-xs">
                    <span className="text-slate-500">Tracking number</span>
                    <input
                      value={trackingDraft.trackingNumber}
                      onChange={(e) => setTrackingDraft((d) => ({ ...d, trackingNumber: e.target.value }))}
                      placeholder="e.g. LB-2024-0001"
                      className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="text-slate-500">Carrier</span>
                    <input
                      value={trackingDraft.carrier}
                      onChange={(e) => setTrackingDraft((d) => ({ ...d, carrier: e.target.value }))}
                      placeholder="e.g. BlueDart, Delhivery"
                      className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="text-slate-500">Shipment status</span>
                    <select
                      value={trackingDraft.shipmentStatus}
                      onChange={(e) =>
                        setTrackingDraft((d) => ({ ...d, shipmentStatus: e.target.value as TrackingDraft["shipmentStatus"] }))
                      }
                      className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none bg-white focus:border-amber-400"
                    >
                      <option value="">—</option>
                      <option value="pending">Pending</option>
                      <option value="in_transit">In transit</option>
                      <option value="delivered">Delivered</option>
                      <option value="failed">Failed</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="text-slate-500">Pickup slot</span>
                    <input
                      value={trackingDraft.pickupSlot}
                      onChange={(e) => setTrackingDraft((d) => ({ ...d, pickupSlot: e.target.value }))}
                      placeholder="e.g. Mon 10-12"
                      className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
                    />
                  </label>
                  <label className="text-xs sm:col-span-2">
                    <span className="text-slate-500">Tracking URL</span>
                    <input
                      value={trackingDraft.trackingUrl}
                      onChange={(e) => setTrackingDraft((d) => ({ ...d, trackingUrl: e.target.value }))}
                      placeholder="https://..."
                      className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
                    />
                  </label>
                  <div className="sm:col-span-2 flex justify-end">
                    <Button size="sm" onClick={() => handleSaveTracking(order.id)} disabled={busyId === order.id}>
                      {busyId === order.id ? "Saving…" : "Save tracking"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
