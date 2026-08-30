import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BellRing } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationReadRequest,
  markAllNotificationsReadRequest,
  fetchPushConfig,
  savePushSubscription,
  deletePushSubscription,
  type Notification,
} from "../../services/notificationService";

const urlBase64ToUint8Array = (base64: string): Uint8Array<ArrayBuffer> => {
  const pad = (s: string): string => s + "=".repeat((4 - (s.length % 4)) % 4);
  const norm = pad(base64).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(norm);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

const NotificationBell = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount()
      .then(setUnreadCount)
      .catch(() => setUnreadCount(0));
  }, [user]);

  useEffect(() => {
    if (!user || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    fetchPushConfig()
      .then(async (config) => {
        if (!config.configured || !config.publicKey) return; // server can't deliver push
        setPushAvailable(true);
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(Boolean(sub));
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTogglePush = async () => {
    setPushBusy(true);
    try {
      const config = await fetchPushConfig();
      const reg = await navigator.serviceWorker.ready;
      if (pushEnabled) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await deletePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setPushEnabled(false);
      } else {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        });
        await savePushSubscription(sub);
        setPushEnabled(true);
      }
    } catch {
      // permission denied or VAPID mismatch — leave toggle unchanged
    } finally {
      setPushBusy(false);
    }
  };

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const data = await fetchNotifications();
      setNotifications(data);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationReadRequest(notification.id);
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setOpen(false);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsReadRequest();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleToggle} className="relative text-slate-700 hover:text-amber-600 transition-colors" aria-label="Notifications">
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl border border-amber-100 shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-semibold text-sm text-slate-800">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-amber-600 font-semibold hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {pushAvailable && (
            <button
              onClick={handleTogglePush}
              disabled={pushBusy}
              className="w-full flex items-center justify-between px-4 py-2.5 border-b border-slate-50 hover:bg-amber-50/40 transition"
            >
              <span className="text-xs text-slate-600 flex items-center gap-2">
                <BellRing size={14} className="text-amber-500" />
                Browser push alerts
              </span>
              <span
                className={`relative w-9 h-5 rounded-full transition-colors ${pushEnabled ? "bg-amber-500" : "bg-slate-200"} ${pushBusy ? "opacity-50" : ""}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${pushEnabled ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </span>
            </button>
          )}

          {notifications.length === 0 ? (
            <p className="text-sm text-slate-400 px-4 py-6 text-center">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.id}
                to={n.link ?? "#"}
                onClick={() => handleNotificationClick(n)}
                className={`block px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-amber-50/50 transition ${
                  n.read ? "" : "bg-amber-50/30"
                }`}
              >
                <p className="text-sm font-medium text-slate-800">{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                <p className="text-[10px] text-slate-300 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
