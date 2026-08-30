import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Filter } from "lucide-react";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { fetchAllListings, updateListingStatusRequest } from "../../services/adminService";
import type { Listing, ListingStatus } from "../../types";

const tabs: ListingStatus[] = ["Pending", "Approved", "Rejected"];

const statusStyles: Record<ListingStatus, string> = {
  Pending: "bg-amber-50 text-amber-700",
  Approved: "bg-green-50 text-green-700",
  Rejected: "bg-red-50 text-red-700",
};

// Extended type with AI duplicate-detection fields populated from backend
interface ListingWithDuplicate extends Listing {
  duplicateFlag?: boolean;
  duplicateReason?: string;
  duplicateCandidate?: {
    id: string;
    title: string;
    author: string;
    image: string;
  } | null;
}

const DuplicateModal = ({
  listing,
  onClose,
}: {
  listing: ListingWithDuplicate;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
          <AlertTriangle size={18} className="text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Possible Duplicate Detected</h3>
          <p className="text-xs text-slate-500 mt-0.5">AI analysis flagged this listing</p>
        </div>
      </div>

      <p className="text-sm text-slate-600 mb-5 bg-amber-50 rounded-2xl p-4 border border-amber-100">
        {listing.duplicateReason ?? "This listing may be a duplicate of an existing catalog book."}
      </p>

      {listing.duplicateCandidate && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          {/* New listing */}
          <div className="rounded-2xl border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">New Listing</p>
            {listing.images?.[0] && (
              <img src={listing.images[0]} alt={listing.title} className="w-full h-32 object-cover rounded-xl mb-2" />
            )}
            <p className="font-medium text-slate-800 text-sm">{listing.title}</p>
            <p className="text-xs text-slate-500">{listing.author}</p>
          </div>
          {/* Existing catalog book */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-600 uppercase mb-2">Existing Book</p>
            <img
              src={listing.duplicateCandidate.image}
              alt={listing.duplicateCandidate.title}
              className="w-full h-32 object-cover rounded-xl mb-2"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <p className="font-medium text-slate-800 text-sm">{listing.duplicateCandidate.title}</p>
            <p className="text-xs text-slate-500">{listing.duplicateCandidate.author}</p>
          </div>
        </div>
      )}

      <Button fullWidth variant="outline" onClick={onClose}>
        Close
      </Button>
    </div>
  </div>
);

const AdminListings = () => {
  const [status, setStatus] = useState<ListingStatus>("Pending");
  const [listings, setListings] = useState<ListingWithDuplicate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState<ListingWithDuplicate | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state for a new fetch
    setLoading(true);
    fetchAllListings(status)
      .then((data) => setListings(data as ListingWithDuplicate[]))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [status]);

  const handleUpdate = async (id: string, newStatus: ListingStatus) => {
    setBusyId(id);
    try {
      await updateListingStatusRequest(id, newStatus);
      setListings((prev) => prev.filter((l) => l.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  const displayed = showDuplicatesOnly
    ? listings.filter((l) => l.duplicateFlag)
    : listings;

  const duplicateCount = listings.filter((l) => l.duplicateFlag).length;

  return (
    <>
      {duplicateModal && (
        <DuplicateModal listing={duplicateModal} onClose={() => setDuplicateModal(null)} />
      )}

      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="font-bold text-slate-900">Sell Listings</h2>
          <div className="flex gap-2 flex-wrap">
            {duplicateCount > 0 && (
              <button
                onClick={() => setShowDuplicatesOnly((v) => !v)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  showDuplicatesOnly
                    ? "bg-amber-500 text-white"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                <Filter size={13} />
                ⚠️ Duplicates ({duplicateCount})
              </button>
            )}
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => { setStatus(t); setShowDuplicatesOnly(false); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                  status === t ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Loader label="Loading listings..." />
        ) : displayed.length === 0 ? (
          <p className="text-slate-400 text-sm">
            {showDuplicatesOnly ? "No duplicate-flagged listings." : `No ${status.toLowerCase()} listings.`}
          </p>
        ) : (
          <div className="space-y-3">
            {displayed.map((listing) => (
              <div
                key={listing.id}
                className={`flex items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0 ${
                  listing.duplicateFlag ? "bg-amber-50/50 -mx-3 px-3 rounded-2xl" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-800 truncate">
                      {listing.title}
                    </p>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyles[listing.status]}`}
                    >
                      {listing.status}
                    </span>
                    {listing.duplicateFlag && (
                      <button
                        onClick={() => setDuplicateModal(listing)}
                        className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition"
                      >
                        <AlertTriangle size={10} />
                        Possible duplicate
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {listing.author} · {listing.condition} · ₹{listing.price}
                    {listing.user && ` · ${listing.user.name} (${listing.user.email})`}
                  </p>
                </div>
                {listing.status === "Pending" && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      icon={<CheckCircle2 size={14} />}
                      onClick={() => handleUpdate(listing.id, "Approved")}
                      disabled={busyId === listing.id}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<XCircle size={14} />}
                      onClick={() => handleUpdate(listing.id, "Rejected")}
                      disabled={busyId === listing.id}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default AdminListings;
