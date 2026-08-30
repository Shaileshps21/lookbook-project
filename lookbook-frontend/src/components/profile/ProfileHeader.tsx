import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Store, ShieldCheck, Pencil, LogOut, BookOpen, Heart, Users, Star } from "lucide-react";
import Button from "../common/Button";
import { fetchFollowCounts } from "../../services/followService";
import { fetchMyStats } from "../../services/userService";
import type { Order, User } from "../../types";

interface ProfileHeaderProps {
  user: User;
  orders: Order[];
  onEdit: () => void;
  onLogout: () => void;
}

const ProfileHeader = ({ user, orders, onEdit, onLogout }: ProfileHeaderProps) => {
  const [following, setFollowing] = useState(0);
  const [reviewsGiven, setReviewsGiven] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchFollowCounts(user.id)
      .then((c) => !cancelled && setFollowing(c.following))
      .catch(() => !cancelled && setFollowing(0));
    fetchMyStats()
      .then((s) => !cancelled && setReviewsGiven(s.reviewsCount))
      .catch(() => !cancelled && setReviewsGiven(0));
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const booksRead = orders.filter((o) => o.status === "Delivered" || o.status === "Returned").length;
  const activeRentals = orders.filter((o) => o.status === "Active").length;

  const stats = [
    { icon: BookOpen, label: "Books Read", value: booksRead },
    { icon: Heart, label: "Active Rentals", value: activeRentals },
    { icon: Users, label: "Following", value: following },
    { icon: Star, label: "Reviews Given", value: reviewsGiven },
  ];

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
      <div className="h-28 bg-gradient-to-r from-amber-400 to-rose-400" />

      <div className="px-6 pb-6 -mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <div className="relative">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-amber-500 text-white text-4xl font-bold flex items-center justify-center border-4 border-white shadow-md">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={onEdit}
                aria-label="Edit profile"
                className="absolute -right-1 -bottom-1 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md hover:bg-slate-700 transition"
              >
                <Pencil size={13} />
              </button>
            </div>

            <div className="pb-6">
              <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
              <p className="text-slate-600 text-sm">{user.email}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {user.emailVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700">
                    <BadgeCheck size={12} /> Verified
                  </span>
                )}
                {user.isSeller && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                    <Store size={12} /> Seller
                  </span>
                )}
                {user.role === "admin" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700">
                    <ShieldCheck size={12} /> Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pb-1">
            <Button variant="outline" size="sm" icon={<Pencil size={14} />} onClick={onEdit}>
              Edit Profile
            </Button>
            {user.role === "admin" && (
              <Link to="/admin">
                <Button variant="outline" size="sm" icon={<ShieldCheck size={14} />}>
                  Admin Panel
                </Button>
              </Link>
            )}
            <Link to="/seller">
              <Button variant="outline" size="sm" icon={<Store size={14} />}>
                {user.isSeller ? "Seller Dashboard" : "Become a Seller"}
              </Button>
            </Link>
            <Button variant="outline" size="sm" icon={<LogOut size={14} />} onClick={onLogout}>
              Log Out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-slate-50 rounded-2xl p-4 text-center">
              <Icon size={16} className="mx-auto text-amber-600" />
              <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
              <p className="text-[11px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
