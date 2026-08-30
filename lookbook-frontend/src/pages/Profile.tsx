import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { LayoutGrid, Package, BookOpen, Users, MapPin, Shield } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useWishlist } from "../hooks/useWishlist";
import ProfileHeader from "../components/profile/ProfileHeader";
import EditProfileModal from "../components/profile/EditProfileModal";
import ProfileStats from "../components/profile/ProfileStats";
import OrderHistory from "../components/profile/OrderHistory";
import EmailVerificationBanner from "../components/profile/EmailVerificationBanner";
import SessionsList from "../components/profile/SessionsList";
import ReadingDashboard from "../components/profile/ReadingDashboard";
import SustainabilityDashboard from "../components/profile/SustainabilityDashboard";
import AddressBook from "../components/profile/AddressBook";
import CommunitySettings from "../components/profile/CommunitySettings";
import TwoFactorSettings from "../components/profile/TwoFactorSettings";
import ChangePasswordForm from "../components/profile/ChangePasswordForm";
import NotificationsSection from "../components/profile/NotificationsSection";
import Loader from "../components/common/Loader";
import { fetchMyOrders } from "../services/orderService";
import { fetchMyStats } from "../services/userService";
import type { Order } from "../types";

type TabId = "overview" | "orders" | "reading" | "community" | "addresses" | "security";

const TABS: { id: TabId; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "orders", label: "Orders", icon: Package },
  { id: "reading", label: "Reading", icon: BookOpen },
  { id: "community", label: "Community", icon: Users },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "security", label: "Security", icon: Shield },
];

type OrderFilter = "all" | "rentals" | "purchases";

const Profile = () => {
  const { user, logout, initializing } = useAuth();
  const { items: cartItems } = useCart();
  const { items: wishlistItems } = useWishlist();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [reviewsGiven, setReviewsGiven] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMyOrders()
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false);
      });
    fetchMyStats()
      .then((data) => {
        if (!cancelled) setReviewsGiven(data.reviewsCount);
      })
      .catch(() => {
        if (!cancelled) setReviewsGiven(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return orders;
    return orders.filter((o) =>
      orderFilter === "rentals"
        ? o.items.some((i) => i.mode === "rent")
        : o.items.some((i) => i.mode === "buy")
    );
  }, [orders, orderFilter]);

  if (initializing) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh]">
        <Loader fullScreen label="Loading your profile..." />
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-6xl mx-auto px-6">
        <ProfileHeader user={user} orders={orders} onEdit={() => setEditingProfile(true)} onLogout={logout} />

        <div className="mt-6 space-y-6">
          {user.emailVerified === false && <EmailVerificationBanner />}

          <div className="flex flex-wrap gap-2 bg-white rounded-2xl border border-amber-100 shadow-sm p-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  activeTab === id ? "bg-amber-500 text-slate-900" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="space-y-8">
              <ProfileStats
                rentals={orders.filter((o) => o.status === "Active").length}
                wishlisted={wishlistItems.length}
                cartItems={cartItems.length}
                reviewsGiven={reviewsGiven}
              />
              {orders.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-4">Most Recent Order</h2>
                  {loadingOrders ? <Loader label="Loading..." /> : <OrderHistory orders={orders.slice(0, 1)} />}
                </div>
              )}
              <SustainabilityDashboard />
            </div>
          )}

          {activeTab === "orders" && (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-xl font-bold text-slate-900">Rental & Order History</h2>
                <div className="flex gap-2">
                  {(["all", "rentals", "purchases"] as OrderFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setOrderFilter(f)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition ${
                        orderFilter === f ? "bg-amber-500 text-slate-900" : "bg-white border border-slate-200 text-slate-500"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {loadingOrders ? <Loader label="Loading your orders..." /> : <OrderHistory orders={filteredOrders} />}
            </div>
          )}

          {activeTab === "reading" && <ReadingDashboard />}

          {activeTab === "community" && <CommunitySettings />}

          {activeTab === "addresses" && <AddressBook />}

          {activeTab === "security" && (
            <div className="space-y-6">
              <TwoFactorSettings />
              <ChangePasswordForm />
              <NotificationsSection />
              <SessionsList />
            </div>
          )}
        </div>
      </div>

      {editingProfile && <EditProfileModal onClose={() => setEditingProfile(false)} />}
    </section>
  );
};

export default Profile;
