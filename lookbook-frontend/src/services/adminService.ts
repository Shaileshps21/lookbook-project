import { api } from "./apiClient";
import type { Order, OrderStatus, Book, Listing, ListingStatus, SellerApplicationStatus } from "../types";

export interface DashboardMetrics {
  revenue: number;
  totalUsers: number;
  totalBooks: number;
  totalOrders: number;
  pendingSellerApplications: number;
  pendingListings: number;
  pendingDamageReports: number;
}

export const fetchDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const { data } = await api.get<DashboardMetrics>("/admin/dashboard");
  return data;
};

export interface PendingSellerApplication {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  sellerApplication: { status: SellerApplicationStatus; requestedAt?: string };
}

export const fetchPendingSellers = async (): Promise<PendingSellerApplication[]> => {
  const { data } = await api.get<PendingSellerApplication[]>("/admin/sellers/pending");
  return data;
};

export const approveSellerRequest = (userId: string) => api.patch<null>(`/admin/sellers/${userId}/approve`);
export const rejectSellerRequest = (userId: string, reason: string) =>
  api.patch<null>(`/admin/sellers/${userId}/reject`, { reason });

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  isSeller: boolean;
  suspended: boolean;
  suspendedReason?: string;
  createdAt: string;
}

export const fetchUsers = async (search?: string): Promise<AdminUser[]> => {
  const { data } = await api.get<AdminUser[]>("/admin/users", { search });
  return data;
};

export const fetchUserActivity = async (userId: string) => {
  const { data } = await api.get(`/admin/users/${userId}/activity`);
  return data as {
    user: AdminUser;
    recentActivity: { action: string; createdAt: string; book: { title: string } | null }[];
    recentOrders: Order[];
  };
};

export const suspendUserRequest = (userId: string, reason: string) =>
  api.patch<null>(`/admin/users/${userId}/suspend`, { reason });
export const reinstateUserRequest = (userId: string) => api.patch<null>(`/admin/users/${userId}/reinstate`);

export const fetchAdminOrders = async (filters: { status?: string; paymentStatus?: string; search?: string }) => {
  const { data } = await api.get<Order[]>("/admin/orders", filters);
  return data;
};

export const updateOrderStatusRequest = async (orderId: string, status: OrderStatus): Promise<Order> => {
  const { data } = await api.patch<Order>(`/admin/orders/${orderId}/status`, { status });
  return data;
};

export const refundOrderRequest = async (orderId: string): Promise<Order> => {
  const { data } = await api.post<Order>(`/admin/orders/${orderId}/refund`);
  return data;
};

export interface PendingDamageReport extends Order {
  user: { name: string; email: string };
}

export const fetchPendingDamageReports = async (): Promise<PendingDamageReport[]> => {
  const { data } = await api.get<PendingDamageReport[]>("/admin/damage-reports/pending");
  return data;
};

export const resolveDamageReportRequest = (orderId: string, itemIndex: number, feeCharged?: number) =>
  api.patch<Order>(`/admin/damage-reports/${orderId}/${itemIndex}/resolve`, { feeCharged });

export const fetchAllListings = async (status?: ListingStatus): Promise<Listing[]> => {
  const { data } = await api.get<Listing[]>("/listings", { status });
  return data;
};

export const updateListingStatusRequest = (id: string, status: ListingStatus) =>
  api.patch<Listing>(`/listings/${id}/status`, { status });

export interface BulkImportResult {
  importedCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
}

export const bulkImportBooksRequest = async (rows: Record<string, unknown>[]): Promise<BulkImportResult> => {
  const { data } = await api.post<BulkImportResult>("/books/bulk-import", { rows });
  return data;
};

export const createBookRequest = (book: Partial<Book>) => api.post<Book>("/books", book);
export const updateBookRequest = (id: string, book: Partial<Book>) => api.put<Book>(`/books/${id}`, book);
export const deleteBookRequest = (id: string) => api.delete<null>(`/books/${id}`);

export interface AuditLogEntry {
  id: string;
  admin: { name: string; email: string };
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export const fetchAuditLogs = async (): Promise<AuditLogEntry[]> => {
  const { data } = await api.get<AuditLogEntry[]>("/admin/audit-logs");
  return data;
};

export interface AnalyticsSnapshot {
  id: string;
  date: string;
  revenue: number;
  ordersCount: number;
  newUsers: number;
  activeUsers: number;
  membershipRevenue: number;
  sellerRevenue: number;
  topRentedBooks: { bookId: string; title: string; count: number }[];
  topSoldBooks: { bookId: string; title: string; count: number }[];
  genrePopularity: { category: string; count: number }[];
}

export const fetchAnalytics = async (days = 30): Promise<AnalyticsSnapshot[]> => {
  const { data } = await api.get<AnalyticsSnapshot[]>("/admin/analytics", { days });
  return data;
};

export interface ExternalBookResult {
  sourceKey: string;
  title: string;
  author: string;
  isbn?: string;
  image?: string;
  published?: string;
  publisher?: string;
  pages?: number;
  subjects: string[];
  alreadyImported: boolean;
}

export const searchBooksApiRequest = async (query: string): Promise<ExternalBookResult[]> => {
  const { data } = await api.get<ExternalBookResult[]>("/admin/books-api/search", { q: query });
  return data;
};

export interface ImportBooksResult {
  imported: number;
  skipped: { title: string; reason: string }[];
}

export const importBooksApiRequest = async (
  items: ExternalBookResult[],
  category: string
): Promise<ImportBooksResult> => {
  const { data } = await api.post<ImportBooksResult>("/admin/books-api/import", { items, category });
  return data;
};

export interface ProductAnalytics {
  days: number;
  funnel: Record<string, { count: number; sessions: number }>;
  daily: { date: string; total: number }[];
}

export const fetchProductAnalytics = async (days = 7): Promise<ProductAnalytics> => {
  const { data } = await api.get<ProductAnalytics>("/admin/analytics/events", { days });
  return data;
};

// §13.3 — online A/B report for the homepage recommendation experiment.
export interface AbArm {
  arm: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  impressionToConversionRate: number;
  clickToConversionRate: number;
}

export interface AbTestResult {
  p1: number;
  p2: number;
  n1: number;
  n2: number;
  z: number;
  pValue: number;
  significant: boolean;
  direction: "equal" | "one-greater" | "two-greater";
}

export interface AbReport {
  impressions: Record<string, number>;
  clicks: Record<string, number>;
  conversions: Record<string, number>;
  arms: AbArm[];
  tests: { ctr: AbTestResult; clickToConversion: AbTestResult };
  sources: { source: string; clicks: number; conversions: number; conversionRate: number }[];
}

export const fetchAbReport = async (days = 30): Promise<AbReport> => {
  const { data } = await api.get<AbReport>("/admin/analytics/ab-report", { days });
  return data;
};

export interface BookPricingConfig {
  enabled: boolean;
  minRentPrice: number;
  maxRentPrice: number;
}

export const configureBookPricingRequest = async (
  bookId: string,
  input: Partial<BookPricingConfig>
): Promise<BookPricingConfig> => {
  const { data } = await api.post<BookPricingConfig>(`/admin/books/${bookId}/pricing`, input);
  return data;
};

export const runPricingNowRequest = () => api.post<null>("/admin/pricing/run");

export const updateOrderTrackingRequest = async (
  orderId: string,
  input: Partial<{
    trackingNumber: string;
    carrier: string;
    shipmentStatus: "pending" | "in_transit" | "delivered" | "failed";
    trackingUrl: string;
    pickupSlot: string;
  }>
): Promise<Order> => {
  const { data } = await api.patch<Order>(`/admin/orders/${orderId}/tracking`, input);
  return data;
};

export interface ClientConfig {
  razorpay: { available: boolean; keyId: string };
  stripe: { available: boolean; publishableKey: string };
  push: { configured: boolean };
  ai: { configured: boolean };
}

export const fetchClientConfig = async (): Promise<ClientConfig> => {
  const { data } = await api.get<ClientConfig>("/config");
  return data;
};
