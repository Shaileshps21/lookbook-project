import { BookOpen, Heart, ShoppingCart, Star } from "lucide-react";

interface ProfileStatsProps {
  rentals: number;
  wishlisted: number;
  cartItems: number;
  reviewsGiven: number;
}

const ProfileStats = ({ rentals, wishlisted, cartItems, reviewsGiven }: ProfileStatsProps) => {
  const stats = [
    { icon: BookOpen, label: "Active Rentals", value: rentals, color: "bg-amber-50 text-amber-600" },
    { icon: Heart, label: "Wishlisted", value: wishlisted, color: "bg-red-50 text-red-500" },
    { icon: ShoppingCart, label: "In Cart", value: cartItems, color: "bg-blue-50 text-blue-600" },
    { icon: Star, label: "Reviews Given", value: reviewsGiven, color: "bg-green-50 text-green-600" },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-white rounded-3xl p-6 border border-amber-100 shadow-sm">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
            <Icon size={20} />
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-4">{value}</p>
          <p className="text-slate-500 text-sm">{label}</p>
        </div>
      ))}
    </div>
  );
};

export default ProfileStats;
