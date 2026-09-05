import { useEffect, useRef, useState } from "react";
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
  Image as ImageIcon,
  Trophy,
} from "lucide-react";
import QRCode from "qrcode";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import LikeButton from "../components/community/LikeButton";
import ChallengeCard from "../components/community/ChallengeCard";
import CreateChallengeForm from "../components/community/CreateChallengeForm";
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
import { fetchThreadsForClub, createThread, likeThread, unlikeThread } from "../services/threadService";
import { fetchChallenges } from "../services/challengeService";
import { uploadImage } from "../services/uploadService";
import { ApiClientError } from "../services/apiClient";
import type { Club, Thread, Challenge } from "../types";

const ClubDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postImages, setPostImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [postError, setPostError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleted, setDeleted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [regenerateConfirming, setRegenerateConfirming] = useState(false);
  const [creatingChallenge, setCreatingChallenge] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchClubById(id), fetchThreadsForClub(id), fetchChallenges(id)])
      .then(([clubData, threadData, challengeData]) => {
        setClub(clubData);
        setThreads(threadData);
        setChallenges(challengeData);
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (postImages.length >= 4) {
      setPostError("Up to 4 photos per post.");
      return;
    }
    setPostError("");
    setUploadingImage(true);
    try {
      const url = await uploadImage(file, true);
      setPostImages((prev) => [...prev, url]);
    } catch (err) {
      setPostError(err instanceof ApiClientError ? err.message : "Couldn't upload the photo.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim()) return;
    setBusy(true);
    setPostError("");
    try {
      const title = postContent.trim().length > 60 ? `${postContent.trim().slice(0, 57)}...` : postContent.trim();
      await createThread({ title, content: postContent.trim(), images: postImages, clubId: id });
      setPostContent("");
      setPostImages([]);
      setFormOpen(false);
      load();
    } catch (err) {
      setPostError(err instanceof ApiClientError ? err.message : "Couldn't post.");
    } finally {
      setBusy(false);
    }
  };

  const handleThreadLikeToggled = (threadId: string, liked: boolean, count: number) => {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, likedByMe: liked, likesCount: count } : t)));
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
                  <Link to={`/u/${member.id}`} className="text-slate-700 hover:text-amber-600">
                    {member.name}
                    {member.id === club.owner.id && <span className="ml-2 text-xs text-amber-600 font-semibold">Owner</span>}
                  </Link>
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
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <Trophy size={16} className="text-amber-500" /> Club Challenges
          </h2>
          {user && isMember && (
            <Button
              size="sm"
              variant="outline"
              icon={creatingChallenge ? <X size={14} /> : <Plus size={14} />}
              onClick={() => setCreatingChallenge((v) => !v)}
            >
              New Challenge
            </Button>
          )}
        </div>

        {creatingChallenge && (
          <div className="mb-6">
            <CreateChallengeForm
              defaultClubId={id}
              onCreated={() => {
                setCreatingChallenge(false);
                load();
              }}
              onCancel={() => setCreatingChallenge(false)}
            />
          </div>
        )}

        {challenges.length === 0 ? (
          <p className="text-slate-400 text-sm mb-8">
            No challenges running for this club yet.{" "}
            <Link to="/challenges" className="text-amber-600 font-semibold hover:underline">
              Browse all challenges
            </Link>
            .
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {challenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} onChanged={load} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900">Club Feed</h2>
          {user && isMember && (
            <Button size="sm" variant="outline" icon={formOpen ? <X size={14} /> : <Plus size={14} />} onClick={() => setFormOpen((v) => !v)}>
              New Post
            </Button>
          )}
        </div>

        {formOpen && (
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 mb-6">
            <textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="Share something with the club..."
              rows={3}
              className="w-full px-4 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400 resize-none"
              maxLength={3000}
            />

            {postImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {postImages.map((src) => (
                  <div key={src} className="relative">
                    <img src={src} alt="" className="w-20 h-20 rounded-xl object-cover" />
                    <button
                      onClick={() => setPostImages((prev) => prev.filter((i) => i !== src))}
                      className="absolute -right-1.5 -top-1.5 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {postError && <p className="text-red-500 text-xs mt-2">{postError}</p>}

            <div className="flex items-center justify-between mt-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || postImages.length >= 4}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-amber-600 transition disabled:opacity-50"
              >
                <ImageIcon size={15} /> {uploadingImage ? "Uploading..." : "Add Photo"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <Button size="sm" onClick={handleCreatePost} disabled={busy || !postContent.trim()}>
                Post
              </Button>
            </div>
          </div>
        )}

        {threads.length === 0 ? (
          <p className="text-slate-400 text-sm">No posts yet. Be the first to share something.</p>
        ) : (
          <div className="space-y-4">
            {threads.map((thread) => (
              <div key={thread.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  {thread.author.avatar ? (
                    <img src={thread.author.avatar} alt={thread.author.name} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">
                      {thread.author.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <Link to={`/u/${thread.author.id}`} className="font-semibold text-slate-800 text-sm hover:text-amber-600">
                      {thread.author.name}
                    </Link>
                    <p className="text-[11px] text-slate-400">{new Date(thread.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {thread.content ? (
                  <p className="text-slate-700 text-sm whitespace-pre-wrap">{thread.content}</p>
                ) : (
                  <p className="font-medium text-slate-800 text-sm">{thread.title}</p>
                )}

                {thread.images.length > 0 && (
                  <div className={`grid gap-2 mt-3 ${thread.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {thread.images.map((src) => (
                      <img key={src} src={src} alt="" className="rounded-xl w-full max-h-72 object-cover" />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                  <LikeButton
                    liked={thread.likedByMe}
                    count={thread.likesCount}
                    onLike={async () => {
                      const count = await likeThread(thread.id);
                      handleThreadLikeToggled(thread.id, true, count);
                      return count;
                    }}
                    onUnlike={async () => {
                      const count = await unlikeThread(thread.id);
                      handleThreadLikeToggled(thread.id, false, count);
                      return count;
                    }}
                    disabled={!user}
                  />
                  <Link to={`/threads/${thread.id}`} className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-600 transition">
                    <MessageSquare size={13} /> {thread.commentsCount} comments
                  </Link>
                </div>
              </div>
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
