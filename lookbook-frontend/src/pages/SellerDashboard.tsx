import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Store, Clock, XCircle, Trash2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/common/Button";
import Loader from "../components/common/Loader";
import { fetchMyListings, deleteListingRequest } from "../services/listingService";
import { applyToSell } from "../services/userService";
import SellerInventory from "../components/seller/SellerInventory";
import SellerOrders from "../components/seller/SellerOrders";
import SellerRevenue from "../components/seller/SellerRevenue";
import SellerPerformance from "../components/seller/SellerPerformance";
import type { Listing } from "../types";

const statusStyles: Record<Listing["status"], string> = {
  Pending: "bg-amber-50 text-amber-700",
  Approved: "bg-green-50 text-green-700",
  Rejected: "bg-red-50 text-red-700",
};

const tabs = ["Listings", "Inventory", "Orders", "Revenue", "Performance"] as const;
type Tab = (typeof tabs)[number];

const SellerListingsTab = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyListings()
      .then(setListings)
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    await deleteListingRequest(id);
    setListings((prev) => prev.filter((l) => l.id !== id));
  };

  if (loading) return <Loader label="Loading your listings..." />;

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <h2 className="font-bold text-slate-900 mb-4">Your Submitted Listings</h2>
      {listings.length === 0 ? (
        <p className="text-slate-500">
          No listings yet. Head to the{" "}
          <a href="/sell" className="text-amber-600 font-semibold hover:underline">
            Sell page
          </a>{" "}
          to list your first book.
        </p>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <div key={listing.id} className="flex items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0">
              <div>
                <p className="font-medium text-slate-800">{listing.title}</p>
                <p className="text-xs text-slate-400">
                  {listing.author} · {listing.condition} · ₹{listing.price}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyles[listing.status]}`}>{listing.status}</span>
                <button onClick={() => handleDelete(listing.id)} className="text-slate-400 hover:text-red-500 transition" aria-label="Delete listing">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SellerDashboard = () => {
  const { user, setUser, initializing } = useAuth();
  const [applying, setApplying] = useState(false);
  const [tab, setTab] = useState<Tab>("Listings");

  const handleApply = async () => {
    setApplying(true);
    try {
      const sellerApplication = await applyToSell();
      if (user) setUser({ ...user, sellerApplication });
    } finally {
      setApplying(false);
    }
  };

  if (initializing) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh]">
        <Loader fullScreen label="Loading..." />
      </section>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: "/seller" }} replace />;

  const applicationStatus = user.sellerApplication?.status ?? "none";

  if (!user.isSeller) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh] flex items-center justify-center px-6 py-20">
        <div className="bg-white rounded-4xl shadow-sm border border-amber-100 p-10 w-full max-w-md text-center">
          {applicationStatus === "pending" ? (
            <>
              <Clock size={40} className="text-amber-500 mx-auto" />
              <h2 className="text-2xl font-bold text-slate-900 mt-5">Application Pending</h2>
              <p className="text-slate-500 mt-2">We're reviewing your seller application. This usually doesn't take long.</p>
            </>
          ) : applicationStatus === "rejected" ? (
            <>
              <XCircle size={40} className="text-red-500 mx-auto" />
              <h2 className="text-2xl font-bold text-slate-900 mt-5">Application Rejected</h2>
              {user.sellerApplication?.rejectionReason && <p className="text-slate-500 mt-2">{user.sellerApplication.rejectionReason}</p>}
              <Button className="mt-6" onClick={handleApply} disabled={applying}>
                {applying ? "Submitting..." : "Apply Again"}
              </Button>
            </>
          ) : (
            <>
              <Store size={40} className="text-amber-500 mx-auto" />
              <h2 className="text-2xl font-bold text-slate-900 mt-5">Become a Seller</h2>
              <p className="text-slate-500 mt-2">Apply for a seller account to manage your listings from one dashboard.</p>
              <Button className="mt-6" onClick={handleApply} disabled={applying}>
                {applying ? "Submitting..." : "Apply to Sell"}
              </Button>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-8">Seller Dashboard</h1>

        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-amber-100"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Listings" && <SellerListingsTab />}
        {tab === "Inventory" && <SellerInventory />}
        {tab === "Orders" && <SellerOrders />}
        {tab === "Revenue" && <SellerRevenue />}
        {tab === "Performance" && <SellerPerformance />}
      </div>
    </section>
  );
};

export default SellerDashboard;
