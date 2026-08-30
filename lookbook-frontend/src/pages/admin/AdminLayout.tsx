import { Navigate, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, BookOpen, Users as UsersIcon, ShoppingBag, Store, AlertTriangle, Wallet, ScrollText, Tag } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import Loader from "../../components/common/Loader";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/books", label: "Books", icon: BookOpen },
  { to: "/admin/sellers", label: "Seller Approvals", icon: Store },
  { to: "/admin/listings", label: "Sell Listings", icon: ShoppingBag },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/users", label: "Users", icon: UsersIcon },
  { to: "/admin/damage-reports", label: "Damage Reports", icon: AlertTriangle },
  { to: "/admin/payouts", label: "Payouts", icon: Wallet },
  { to: "/admin/coupons", label: "Coupons", icon: Tag },
  { to: "/admin/audit-logs", label: "Audit Log", icon: ScrollText },
];

const AdminLayout = () => {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh]">
        <Loader fullScreen label="Loading..." />
      </section>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: "/admin" }} replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  return (
    <section className="bg-[#F5F2EA] py-12 min-h-[80vh]">
      <div className="max-w-7xl mx-auto px-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Admin Portal</h1>

        <div className="grid lg:grid-cols-5 gap-8">
          <nav className="lg:col-span-1 bg-white rounded-3xl border border-amber-100 shadow-sm p-4 h-fit space-y-1">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition ${
                    isActive ? "bg-amber-500 text-white" : "text-slate-600 hover:bg-amber-50"
                  }`
                }
              >
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </nav>

          <div className="lg:col-span-4">
            <Outlet />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminLayout;
