import { useEffect, useState } from "react";
import { Ban, RotateCcw, Activity } from "lucide-react";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { fetchUsers, suspendUserRequest, reinstateUserRequest, fetchUserActivity, type AdminUser } from "../../services/adminService";

const AdminUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [activityFor, setActivityFor] = useState<string | null>(null);
  const [activityText, setActivityText] = useState("");

  const load = () => {
    setLoading(true);
    fetchUsers(search || undefined)
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state for a new fetch
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSuspend = async (id: string) => {
    setBusyId(id);
    try {
      await suspendUserRequest(id, reason);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, suspended: true, suspendedReason: reason } : u)));
      setSuspendingId(null);
      setReason("");
    } finally {
      setBusyId(null);
    }
  };

  const handleReinstate = async (id: string) => {
    setBusyId(id);
    try {
      await reinstateUserRequest(id);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, suspended: false, suspendedReason: undefined } : u)));
    } finally {
      setBusyId(null);
    }
  };

  const handleViewActivity = async (id: string) => {
    if (activityFor === id) {
      setActivityFor(null);
      return;
    }
    setActivityFor(id);
    setActivityText("Loading...");
    const data = await fetchUserActivity(id);
    setActivityText(
      data.recentActivity.length === 0
        ? "No recent activity."
        : data.recentActivity.map((a) => `${a.action} — ${a.book?.title ?? "unknown book"} (${new Date(a.createdAt).toLocaleDateString()})`).join("\n")
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6">
      <div className="flex gap-3 mb-5">
        <h2 className="font-bold text-slate-900 flex-1">Users</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search by name/email..."
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
        />
        <Button size="sm" onClick={load}>
          Search
        </Button>
      </div>

      {loading ? (
        <Loader label="Loading users..." />
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="border border-slate-100 rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {u.name} <span className="text-slate-400 font-normal">({u.email})</span>
                    {u.role === "admin" && <span className="ml-2 text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full">admin</span>}
                    {u.isSeller && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">seller</span>}
                    {u.suspended && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">suspended</span>}
                  </p>
                  <p className="text-xs text-slate-400">Joined {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" icon={<Activity size={14} />} onClick={() => handleViewActivity(u.id)}>
                    Activity
                  </Button>
                  {u.role !== "admin" &&
                    (u.suspended ? (
                      <Button size="sm" variant="outline" icon={<RotateCcw size={14} />} onClick={() => handleReinstate(u.id)} disabled={busyId === u.id}>
                        Reinstate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Ban size={14} />}
                        onClick={() => setSuspendingId(suspendingId === u.id ? null : u.id)}
                      >
                        Suspend
                      </Button>
                    ))}
                </div>
              </div>

              {suspendingId === u.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for suspension"
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
                  />
                  <Button size="sm" variant="danger" onClick={() => handleSuspend(u.id)} disabled={busyId === u.id}>
                    Confirm
                  </Button>
                </div>
              )}

              {activityFor === u.id && (
                <pre className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">{activityText}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
