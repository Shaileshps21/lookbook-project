import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import {
  MessageSquare,
  Plus,
  X,
  LogOut,
  Trash2,
  Pencil,
  UserMinus,
  Users,
  Share2,
  Copy,
  QrCode,
  RefreshCw,
  Check,
} from "lucide-react";
import QRCode from "qrcode";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import { useAuth } from "../hooks/useAuth";
import {
  fetchClubById,
  joinClub,
  leaveClub,
  deleteClub,
  updateClub,
  removeMember,
  regenerateInviteLink,
  toggleInviteEnabled,
} from "../services/clubService";
import { fetchThreadsForClub, createThread } from "../services/threadService";
import type { Club, Thread } from "../types";

const ClubDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [regenerateConfirming, setRegenerateConfirming] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchClubById(id), fetchThreadsForClub(id)])
      .then(([clubData, threadData]) => {
        setClub(clubData);
        setThreads(threadData);
      })
      .catch(() => setClub(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state for a new fetch
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (deleted) return <Navigate to="/clubs" replace />;

  if (loading) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh]">
        <Loader fullScreen label="Loading club..." />
      </section>
    );
  }

  if (!club || !id) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh] flex items-center justify-center">
        <p className="text-slate-500">Club not found.</p>
      </section>
    );
  }

  const isMember = user ? club.members.some((m) => m.id === user.id) : false;
  const isOwner = user ? club.owner.id === user.id : false;
  const isAdmin = user?.role === "admin";
  const canManage = isOwner || isAdmin;

  const handleJoin = async () => {
    setBusy(true);
    try {
      const updated = await joinClub(id);
      setClub(updated);
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    setBusy(true);
    try {
      const updated = await leaveClub(id);
      setClub(updated);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    await deleteClub(id);
    setDeleted(true);
  };

  const handleStartEdit = () => {
    setEditName(club.name);
    setEditDescription(club.description);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    setBusy(true);
    try {
      const updated = await updateClub(id, { name: editName, description: editDescription });
      setClub(updated);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setBusy(true);
    try {
      const updated = await removeMember(id, memberId);
      setClub(updated);
    } finally {
      setBusy(false);
    }
  };

  const inviteLink = club.inviteUrl ?? "";

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShowQr = async () => {
    if (!inviteLink) return;
    const dataUrl = await QRCode.toDataURL(inviteLink, { width: 240, margin: 1 });
    setQrDataUrl(dataUrl);
    setQrOpen(true);
  };

  const handleShareWhatsApp = () => {
    if (!inviteLink) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(`Join my book club "${club.name}" on LookBook: ${inviteLink}`)}`, "_blank");
  };

  const handleToggleInvite = async () => {
    setBusy(true);
    try {
      const enabled = await toggleInviteEnabled(id, !club.inviteEnabled);
      setClub({ ...club, inviteEnabled: enabled });
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    setBusy(true);
    try {
      const { inviteToken, inviteUrl } = await regenerateInviteLink(id);
      setClub({ ...club, inviteToken, inviteUrl });
      setRegenerateConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateThread = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await createThread({ title: title.trim(), clubId: id });
      setTitle("");
      setFormOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-8 mb-8">
          {editing ? (
            <div className="space-y-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2 text-lg font-bold rounded-xl border border-slate-200 outline-none focus:border-amber-400"
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400 resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={busy}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{club.name}</h1>
                {club.description && <p className="text-slate-500 mt-2">{club.description}</p>}
                <button
                  onClick={() => setShowMembers((v) => !v)}
                  className="text-xs text-slate-400 mt-3 flex items-center gap-1.5 hover:text-amber-600 transition"
                >
                  <Users size={13} /> {club.members.length} members · owned by {club.owner.name}
                </button>
              </div>
              <div className="flex gap-2">
                {user && !isMember && (
                  <Button size="sm" onClick={handleJoin} disabled={busy}>
                    Join Club
                  </Button>
                )}
                {user && isMember && !isOwner && (
                  <Button size="sm" variant="outline" icon={<LogOut size={14} />} onClick={handleLeave} disabled={busy}>
                    Leave
                  </Button>
                )}
                {canManage && (
                  <Button size="sm" variant="outline" icon={<Pencil size={14} />} onClick={handleStartEdit}>
                    Edit
                  </Button>
                )}
                {canManage && (
                  <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={handleDelete}>
                    Delete Club
                  </Button>
                )}
              </div>
            </div>
          )}

          {showMembers && !editing && (
            <div className="mt-5 pt-5 border-t border-slate-100 space-y-2">
              {club.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {member.name}
                    {member.id === club.owner.id && <span className="ml-2 text-xs text-amber-600 font-semibold">Owner</span>}
                  </span>
                  {canManage && member.id !== club.owner.id && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-slate-300 hover:text-red-500 transition"
                      aria-label={`Remove ${member.name}`}
                      disabled={busy}
                    >
                      <UserMinus size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Any current member can view and share the invite link — anyone
              can add anyone. Disabling the link, regenerating it, and
              removing members stay owner/admin-only actions below. */}
          {isMember && !editing && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <p className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
                <Share2 size={14} /> Invite Members
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <input
                  readOnly
                  value={inviteLink}
                  className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-500 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy Link"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleShareWhatsApp}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 transition"
                >
                  WhatsApp
                </button>
                <button
                  onClick={handleShowQr}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                >
                  <QrCode size={12} /> QR Code
                </button>
                {canManage && (
                  <button
                    onClick={handleToggleInvite}
                    disabled={busy}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                      club.inviteEnabled !== false ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    Link {club.inviteEnabled !== false ? "Enabled" : "Disabled"}
                  </button>
                )}
                {canManage &&
                  (regenerateConfirming ? (
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">This will break the old link.</span>
                      <button onClick={handleRegenerate} disabled={busy} className="font-semibold text-red-600 hover:underline">
                        Confirm
                      </button>
                      <button onClick={() => setRegenerateConfirming(false)} className="text-slate-400 hover:underline">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setRegenerateConfirming(true)}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition"
                    >
                      <RefreshCw size={12} /> Regenerate Link
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900">Discussion Threads</h2>
          {user && isMember && (
            <Button size="sm" variant="outline" icon={formOpen ? <X size={14} /> : <Plus size={14} />} onClick={() => setFormOpen((v) => !v)}>
              New Thread
            </Button>
          )}
        </div>

        {formOpen && (
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 mb-6 flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thread title"
              className="flex-1 px-4 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
            />
            <Button size="sm" onClick={handleCreateThread} disabled={busy}>
              Post
            </Button>
          </div>
        )}

        {threads.length === 0 ? (
          <p className="text-slate-400 text-sm">No discussion threads yet.</p>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                to={`/threads/${thread.id}`}
                className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 flex items-center justify-between hover:border-amber-300 transition"
              >
                <div>
                  <p className="font-medium text-slate-800">{thread.title}</p>
                  <p className="text-xs text-slate-400 mt-1">by {thread.author.name}</p>
                </div>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <MessageSquare size={13} /> {thread.commentsCount}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {qrOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setQrOpen(false)}
        >
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Scan to Join</h3>
              <button onClick={() => setQrOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="Invite QR code" className="mx-auto rounded-xl" />}
            <p className="text-xs text-slate-400 mt-3">{club.name}</p>
          </div>
        </div>
      )}
    </section>
  );
};

export default ClubDetail;
