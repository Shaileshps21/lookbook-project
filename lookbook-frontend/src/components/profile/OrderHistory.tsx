import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, AlertTriangle, XCircle, Truck } from "lucide-react";
import { formatPrice } from "../../utils/format";
import { markBookFinished, fetchReadingStats } from "../../services/readingService";
import {
  cancelOrder,
  returnOrderItem,
  extendRental,
  verifyExtensionPayment,
  reportDamage,
} from "../../services/orderService";
import { openRazorpayCheckout } from "../../utils/razorpayCheckout";
import { ApiClientError } from "../../services/apiClient";
import ExtendRentalModal from "./ExtendRentalModal";
import SchedulePickupModal from "./SchedulePickupModal";
import type { Order } from "../../types";
import type { ExtendRentalResponse } from "../../services/orderService";

const statusStyles: Record<Order["status"], string> = {
  Placed: "bg-blue-100 text-blue-600",
  Active: "bg-amber-100 text-amber-700",
  Delivered: "bg-green-100 text-green-600",
  Returned: "bg-slate-100 text-slate-500",
  Cancelled: "bg-red-100 text-red-500",
};

const shipmentStatusLabels: Record<NonNullable<Order["shipmentStatus"]>, string> = {
  pending: "Preparing shipment",
  in_transit: "In transit",
  delivered: "Delivered",
  failed: "Delivery attempt failed",
};

interface OrderHistoryProps {
  orders: Order[];
}

const OrderHistory = ({ orders: initialOrders }: OrderHistoryProps) => {
  const [orders, setOrders] = useState(initialOrders);
  const [finished, setFinished] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [reportingKey, setReportingKey] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [error, setError] = useState("");
  const [extendTarget, setExtendTarget] = useState<{ orderId: string; itemIndex: number; quote: ExtendRentalResponse } | null>(null);
  const [quoting, setQuoting] = useState<string | null>(null);
  const [extending, setExtending] = useState(false);
  const [pickupTarget, setPickupTarget] = useState<{ orderId: string; itemIndex: number } | null>(null);

  useEffect(() => {
    fetchReadingStats()
      .then((stats) => setFinished(new Set(stats.finishedBookIds)))
      .catch(() => setFinished(new Set()));
  }, []);

  const updateOrder = (updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const runAction = async (key: string, action: () => Promise<Order>) => {
    setError("");
    setBusyKey(key);
    try {
      updateOrder(await action());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleFinish = async (bookId: string) => {
    setMarking(bookId);
    try {
      await markBookFinished(bookId);
      setFinished((prev) => new Set(prev).add(bookId));
    } finally {
      setMarking(null);
    }
  };

  const handleCancel = (orderId: string) => runAction(`cancel-${orderId}`, () => cancelOrder(orderId));

  const handleReturn = (orderId: string, itemIndex: number) =>
    runAction(`return-${orderId}-${itemIndex}`, () => returnOrderItem(orderId, itemIndex));

  const handleRequestExtendQuote = async (orderId: string, itemIndex: number) => {
    const key = `${orderId}-${itemIndex}`;
    setError("");
    setQuoting(key);
    try {
      const quote = await extendRental(orderId, itemIndex);
      setExtendTarget({ orderId, itemIndex, quote });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't fetch the extension quote.");
    } finally {
      setQuoting(null);
    }
  };

  const handleConfirmExtend = async () => {
    if (!extendTarget) return;
    const { orderId, itemIndex, quote } = extendTarget;
    setExtending(true);
    setError("");
    try {
      const payment = await openRazorpayCheckout({
        keyId: quote.razorpay.keyId,
        amount: quote.razorpay.amount,
        currency: quote.razorpay.currency,
        orderId: quote.razorpay.orderId,
        description: "Rental extension",
      });
      const updated = await verifyExtensionPayment(orderId, itemIndex, payment);
      updateOrder(updated);
      setExtendTarget(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setExtending(false);
    }
  };

  const handleReport = (orderId: string, itemIndex: number) =>
    runAction(`report-${orderId}-${itemIndex}`, async () => {
      const updated = await reportDamage(orderId, itemIndex, reportReason);
      setReportingKey(null);
      setReportReason("");
      return updated;
    });

  const extendTargetItem = extendTarget
    ? orders.find((o) => o.id === extendTarget.orderId)?.items[extendTarget.itemIndex]
    : undefined;
  const pickupTargetItem = pickupTarget
    ? orders.find((o) => o.id === pickupTarget.orderId)?.items[pickupTarget.itemIndex]
    : undefined;

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-10 border border-amber-100 shadow-sm text-center text-slate-500">
        No orders yet. Once you rent or buy a book, it will show up here.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {extendTarget && extendTargetItem?.dueDate && (
        <ExtendRentalModal
          bookTitle={extendTargetItem.book?.title ?? "This book"}
          currentDueDate={extendTargetItem.dueDate}
          quote={extendTarget.quote}
          busy={extending}
          onCancel={() => setExtendTarget(null)}
          onConfirm={handleConfirmExtend}
        />
      )}
      {pickupTarget && pickupTargetItem && (
        <SchedulePickupModal
          bookTitle={pickupTargetItem.book?.title ?? "This book"}
          orderId={pickupTarget.orderId}
          itemIndex={pickupTarget.itemIndex}
          onCancel={() => setPickupTarget(null)}
          onScheduled={(updated) => {
            updateOrder(updated);
            setPickupTarget(null);
          }}
        />
      )}
      {orders.map((order) => {
        const canCancel = order.status === "Placed" && !order.items.some((i) => i.returnedAt);

        return (
          <div key={order.id} className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-[#F5F2EA] border-b border-amber-100">
              <p className="text-sm text-slate-500">
                Order placed {new Date(order.createdAt).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}
              </p>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyles[order.status]}`}>
                  {order.status}
                </span>
                {order.paymentStatus !== "paid" && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-500 capitalize">
                    Payment {order.paymentStatus}
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y divide-amber-50">
              {order.items.map((item, idx) => {
                const isOverdue = item.mode === "rent" && item.dueDate && !item.returnedAt && new Date(item.dueDate) < new Date();
                const reportKey = `${order.id}-${idx}`;

                return (
                  <div key={reportKey} className="p-5">
                    <div className="flex items-center gap-4">
                      {item.book ? (
                        <Link to={`/books/${item.book.id}`}>
                          {item.book.image ? (
                            <img src={item.book.image} alt={item.book.title} className="w-14 h-20 object-cover rounded-xl" />
                          ) : (
                            <div className="w-14 h-20 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                              <span className="text-white font-bold text-xl opacity-70 select-none">{item.book.title.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                        </Link>
                      ) : (
                        <div className="w-14 h-20 rounded-xl bg-slate-100 flex items-center justify-center px-1 text-center text-[10px] text-slate-400">
                          Unavailable
                        </div>
                      )}

                      <div className="flex-1">
                        {item.book ? (
                          <Link to={`/books/${item.book.id}`} className="font-semibold text-slate-900 hover:text-amber-600">
                            {item.book.title}
                          </Link>
                        ) : (
                          <p className="font-semibold text-slate-900">Book no longer available</p>
                        )}
                        <p className="text-sm text-slate-500 capitalize">
                          {item.mode} &middot; Qty {item.quantity}
                        </p>
                        {item.mode === "rent" && item.dueDate && !item.returnedAt && (
                          <p className={`text-xs mt-1 flex items-center gap-1 ${isOverdue ? "text-red-500" : "text-slate-400"}`}>
                            <Clock size={12} />
                            {isOverdue ? "Overdue since" : "Due"} {new Date(item.dueDate).toLocaleDateString()}
                          </p>
                        )}
                        {item.returnedAt && <p className="text-xs mt-1 text-slate-400">Returned {new Date(item.returnedAt).toLocaleDateString()}</p>}
                        {item.mode === "rent" && (item.lateFee ?? 0) > 0 && (
                          <p className="text-xs mt-1 font-semibold text-red-500">
                            Late fee: {formatPrice(item.lateFee ?? 0)}
                          </p>
                        )}
                      </div>

                      <p className="font-bold text-slate-900">{formatPrice(item.price * item.quantity)}</p>

                      {item.book &&
                        (finished.has(item.book.id) ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                            <CheckCircle2 size={14} /> Finished
                          </span>
                        ) : (
                          <button
                            onClick={() => handleFinish(item.book.id)}
                            disabled={marking === item.book.id}
                            className="text-xs font-semibold text-amber-600 hover:underline whitespace-nowrap"
                          >
                            {marking === item.book.id ? "Marking..." : "Mark as Finished"}
                          </button>
                        ))}
                    </div>

                    {item.mode === "rent" && !item.returnedAt && order.paymentStatus === "paid" && (
                      <div className="flex flex-wrap items-center gap-4 mt-3 ml-[72px] text-xs">
                        <button
                          onClick={() => handleReturn(order.id, idx)}
                          disabled={busyKey === `return-${order.id}-${idx}`}
                          className="font-semibold text-slate-500 hover:text-slate-800"
                        >
                          {busyKey === `return-${order.id}-${idx}` ? "Returning..." : "Return Book"}
                        </button>
                        <button
                          onClick={() => handleRequestExtendQuote(order.id, idx)}
                          disabled={quoting === `${order.id}-${idx}`}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          {quoting === `${order.id}-${idx}` ? "Loading quote..." : "Extend Rental"}
                        </button>
                        {item.pickupDate ? (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Truck size={12} /> Pickup {new Date(item.pickupDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} ({item.pickupTimeSlot})
                          </span>
                        ) : (
                          <button
                            onClick={() => setPickupTarget({ orderId: order.id, itemIndex: idx })}
                            className="font-semibold text-amber-600 hover:underline"
                          >
                            Schedule Pickup
                          </button>
                        )}
                        {item.damageReport ? (
                          <span className="flex items-center gap-1 text-slate-400">
                            <AlertTriangle size={12} /> Issue reported ({item.damageReport.status})
                          </span>
                        ) : (
                          <button
                            onClick={() => setReportingKey(reportingKey === reportKey ? null : reportKey)}
                            className="font-semibold text-red-500 hover:underline"
                          >
                            Report Issue
                          </button>
                        )}
                      </div>
                    )}

                    {reportingKey === reportKey && (
                      <div className="mt-3 ml-[72px] flex gap-2">
                        <input
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value)}
                          placeholder="Describe the damage..."
                          className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
                        />
                        <button
                          onClick={() => handleReport(order.id, idx)}
                          disabled={!reportReason.trim() || busyKey === `report-${order.id}-${idx}`}
                          className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl px-3 disabled:opacity-50"
                        >
                          Submit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {(order.trackingNumber || order.carrier || order.shipmentStatus) && (
              <div className="flex items-start gap-3 px-5 py-3 bg-blue-50/60 border-t border-amber-100">
                <Truck size={16} className="text-blue-500 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p className="font-semibold text-slate-800 capitalize">
                    {shipmentStatusLabels[order.shipmentStatus ?? "pending"]}
                    {order.carrier && ` · ${order.carrier}`}
                  </p>
                  {order.trackingNumber && (
                    <p>
                      Tracking #{order.trackingNumber}
                      {order.trackingUrl && (
                        <>
                          {" "}
                          &middot;{" "}
                          <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            Track shipment
                          </a>
                        </>
                      )}
                    </p>
                  )}
                  {order.pickupSlot && <p>Pickup: {order.pickupSlot}</p>}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-5 py-3 bg-[#F5F2EA] border-t border-amber-100">
              {canCancel ? (
                <button
                  onClick={() => handleCancel(order.id)}
                  disabled={busyKey === `cancel-${order.id}`}
                  className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:underline"
                >
                  <XCircle size={14} /> {busyKey === `cancel-${order.id}` ? "Cancelling..." : "Cancel Order"}
                </button>
              ) : (
                <span />
              )}
              <p className="text-sm text-slate-600">
                Total: <span className="font-bold text-slate-900">{formatPrice(order.total)}</span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OrderHistory;
