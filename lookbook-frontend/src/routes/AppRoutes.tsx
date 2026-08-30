import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import HomePage from "../pages/HomePage";
import Loader from "../components/common/Loader";

// Route-level code splitting (§13.2.4): every page except the entry route
// (HomePage, kept eager for LCP) is loaded on demand.
const BookDetails = lazy(() => import("../pages/BookDetails"));
const Categories = lazy(() => import("../pages/Categories"));
const Rent = lazy(() => import("../pages/Rent"));
const Sell = lazy(() => import("../pages/Sell"));
const Plans = lazy(() => import("../pages/Plans"));
const Cart = lazy(() => import("../pages/Cart"));
const PaymentSuccess = lazy(() => import("../pages/PaymentSuccess"));
const Developers = lazy(() => import("../pages/Developers"));
const Wishlist = lazy(() => import("../pages/Wishlist"));
const Login = lazy(() => import("../pages/Login"));
const Register = lazy(() => import("../pages/Register"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));
const VerifyEmail = lazy(() => import("../pages/VerifyEmail"));
const OAuthCallback = lazy(() => import("../pages/OAuthCallback"));
const Onboarding = lazy(() => import("../pages/Onboarding"));
const SellerDashboard = lazy(() => import("../pages/SellerDashboard"));
const Profile = lazy(() => import("../pages/Profile"));
const PublicProfile = lazy(() => import("../pages/PublicProfile"));
const Clubs = lazy(() => import("../pages/Clubs"));
const ClubDetail = lazy(() => import("../pages/ClubDetail"));
const ClubInvite = lazy(() => import("../pages/ClubInvite"));
const Feed = lazy(() => import("../pages/Feed"));
const ThreadDetail = lazy(() => import("../pages/ThreadDetail"));
const Challenges = lazy(() => import("../pages/Challenges"));
const NotFound = lazy(() => import("../pages/NotFound"));
const AdminLayout = lazy(() => import("../pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const AdminBooks = lazy(() => import("../pages/admin/AdminBooks"));
const AdminSellers = lazy(() => import("../pages/admin/AdminSellers"));
const AdminListings = lazy(() => import("../pages/admin/AdminListings"));
const AdminOrders = lazy(() => import("../pages/admin/AdminOrders"));
const AdminUsers = lazy(() => import("../pages/admin/AdminUsers"));
const AdminDamageReports = lazy(() => import("../pages/admin/AdminDamageReports"));
const AdminPayouts = lazy(() => import("../pages/admin/AdminPayouts"));
const AdminAuditLogs = lazy(() => import("../pages/admin/AdminAuditLogs"));
const AdminCoupons = lazy(() => import("../pages/admin/AdminCoupons"));

const AppRoutes = () => {
  return (
    <Suspense fallback={<Loader fullScreen />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/books/:id" element={<BookDetails />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/rent" element={<Rent />} />
        <Route path="/sell" element={<Sell />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/orders/:orderId/payment-success" element={<PaymentSuccess />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/seller" element={<SellerDashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/u/:userId" element={<PublicProfile />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/clubs" element={<Clubs />} />
        <Route path="/clubs/join/:token" element={<ClubInvite />} />
        <Route path="/clubs/:id" element={<ClubDetail />} />
        <Route path="/threads/:threadId" element={<ThreadDetail />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/developers" element={<Developers />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="books" element={<AdminBooks />} />
          <Route path="sellers" element={<AdminSellers />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="damage-reports" element={<AdminDamageReports />} />
          <Route path="payouts" element={<AdminPayouts />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;