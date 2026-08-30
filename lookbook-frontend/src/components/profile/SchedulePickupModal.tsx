import { useState } from "react";
import { X, Truck } from "lucide-react";
import Button from "../common/Button";
import { ApiClientError } from "../../services/apiClient";
import { schedulePickup } from "../../services/orderService";
import type { Order, PickupTimeSlot } from "../../types";

interface SchedulePickupModalProps {
  bookTitle: string;
  orderId: string;
  itemIndex: number;
  onCancel: () => void;
  onScheduled: (updatedOrder: Order) => void;
}

const SLOTS: { id: PickupTimeSlot; label: string }[] = [
  { id: "morning", label: "Morning (9am–12pm)" },
  { id: "afternoon", label: "Afternoon (12pm–4pm)" },
  { id: "evening", label: "Evening (4pm–7pm)" },
];

const buildNextDays = () => {
  const days: { date: Date; isSunday: boolean }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; days.length < 7 && i < 14; i++) {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    if (d.getDay() === 0) continue; // no Sunday pickups
    days.push({ date: d, isSunday: false });
  }
  return days;
};

const SchedulePickupModal = ({ bookTitle, orderId, itemIndex, onCancel, onScheduled }: SchedulePickupModalProps) => {
  const days = buildNextDays();
  const [selectedDate, setSelectedDate] = useState<Date>(days[0].date);
  const [selectedSlot, setSelectedSlot] = useState<PickupTimeSlot>("morning");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setBusy(true);
    setError("");
    try {
      const updated = await schedulePickup(orderId, itemIndex, selectedDate.toISOString(), selectedSlot);
      onScheduled(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't schedule the pickup.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <Truck size={18} className="text-amber-600" /> Schedule Pickup
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">{bookTitle}</p>

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Pickup Date</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {days.map(({ date }) => {
            const active = date.toDateString() === selectedDate.toDateString();
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`rounded-xl py-2 text-xs font-semibold transition ${
                  active ? "bg-amber-500 text-slate-900" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div>{date.toLocaleDateString("en-IN", { weekday: "short" })}</div>
                <div>{date.getDate()}</div>
              </button>
            );
          })}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Time Slot</p>
        <div className="flex flex-col gap-2 mb-5">
          {SLOTS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSelectedSlot(id)}
              className={`text-left rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                selectedSlot === id ? "bg-amber-500 text-slate-900" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button fullWidth onClick={handleConfirm} disabled={busy}>
            {busy ? "Scheduling..." : "Confirm Pickup"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SchedulePickupModal;
