import { X, CalendarClock } from "lucide-react";
import Button from "../common/Button";
import { formatPrice } from "../../utils/format";
import type { ExtendRentalResponse } from "../../services/orderService";

interface ExtendRentalModalProps {
  bookTitle: string;
  currentDueDate: string;
  quote: ExtendRentalResponse;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ExtendRentalModal = ({ bookTitle, currentDueDate, quote, busy, onCancel, onConfirm }: ExtendRentalModalProps) => {
  const newDueDate = new Date(new Date(currentDueDate).getTime() + quote.extensionDays * 24 * 60 * 60 * 1000);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-lg">Extend Rental</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">{bookTitle}</p>

        <div className="bg-amber-50 rounded-2xl p-4 space-y-2 mb-5">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <CalendarClock size={15} className="text-amber-600" />
            New due date: <span className="font-semibold">{newDueDate.toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-amber-100">
            <span className="text-sm text-slate-600">Extension fee ({quote.extensionDays} days)</span>
            <span className="font-bold text-slate-900">{formatPrice(quote.extensionFee)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button fullWidth onClick={onConfirm} disabled={busy}>
            {busy ? "Processing..." : "Confirm & Pay"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExtendRentalModal;
