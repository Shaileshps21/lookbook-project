import { api, request } from "./apiClient";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export const fetchNotifications = async (): Promise<Notification[]> => {
  const { data } = await api.get<Notification[]>("/notifications");
  return data;
};

export const fetchUnreadCount = async (): Promise<number> => {
  const { data } = await api.get<{ count: number }>("/notifications/unread-count");
  return data.count;
};

export const markNotificationReadRequest = (id: string) => api.patch<Notification>(`/notifications/${id}/read`);

export const markAllNotificationsReadRequest = () => api.patch<null>("/notifications/read-all");

export const fetchPushConfig = async (): Promise<{ configured: boolean; publicKey: string }> => {
  const { data } = await api.get<{ configured: boolean; publicKey: string }>("/notifications/push-config");
  return data;
};

export const savePushSubscription = (subscription: PushSubscription) =>
  api.post<null>("/notifications/subscribe", {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: urlBase64ToUint8ArrayHelper(subscription.getKey("p256dh")),
      auth: urlBase64ToUint8ArrayHelper(subscription.getKey("auth")),
    },
  });

export const deletePushSubscription = (endpoint: string) =>
  request<null>("/notifications/subscribe", { method: "DELETE", body: { endpoint } });

const urlBase64ToUint8ArrayHelper = (buffer: ArrayBuffer | null): string => {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};
