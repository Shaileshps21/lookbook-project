import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Send, Trash2 } from "lucide-react";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import LikeButton from "../components/community/LikeButton";
import { useAuth } from "../hooks/useAuth";
import {
  fetchThreadById,
  addComment,
  deleteComment,
  likeThread,
  unlikeThread,
  likeComment,
  unlikeComment,
} from "../services/threadService";
import type { Thread, Comment } from "../types";

const ThreadDetail = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const { user } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const load = () => {
    if (!threadId) return;
    setLoading(true);
    fetchThreadById(threadId)
      .then(({ thread: t, comments: c }) => {
        setThread(t);
        setComments(c);
      })
      .catch(() => setThread(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state for a new fetch
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const handlePost = async () => {
    if (!content.trim() || !threadId) return;
    setPosting(true);
    try {
      await addComment(threadId, content.trim());
      setContent("");
      load();
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  if (loading) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh]">
        <Loader fullScreen label="Loading thread..." />
      </section>
    );
  }

  if (!thread) {
    return (
      <section className="bg-[#F5F2EA] min-h-[80vh] flex items-center justify-center">
        <p className="text-slate-500">Thread not found.</p>
      </section>
    );
  }

  return (
    <section className="bg-[#F5F2EA] py-16 min-h-[80vh]">
      <div className="max-w-3xl mx-auto px-6">
        <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-6 mb-6">
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

          <h1 className="text-lg font-bold text-slate-900">{thread.title}</h1>
          {thread.content && <p className="text-slate-700 mt-2 whitespace-pre-wrap">{thread.content}</p>}

          {thread.images.length > 0 && (
            <div className={`grid gap-2 mt-4 ${thread.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {thread.images.map((src) => (
                <img key={src} src={src} alt="" className="rounded-2xl w-full max-h-96 object-cover" />
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100">
            <LikeButton
              liked={thread.likedByMe}
              count={thread.likesCount}
              onLike={() => likeThread(thread.id)}
              onUnlike={() => unlikeThread(thread.id)}
              disabled={!user}
              size={16}
            />
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {comments.length === 0 ? (
            <p className="text-slate-400 text-sm">No comments yet. Start the discussion.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/u/${comment.author.id}`} className="font-medium text-slate-800 text-sm hover:text-amber-600">
                      {comment.author.name}
                    </Link>
                    <p className="text-slate-600 mt-1">{comment.content}</p>
                  </div>
                  {user && (user.id === comment.author.id || user.role === "admin") && (
                    <button onClick={() => handleDelete(comment.id)} className="text-slate-300 hover:text-red-500 shrink-0">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <div className="mt-2">
                  <LikeButton
                    liked={comment.likedByMe}
                    count={comment.likesCount}
                    onLike={() => likeComment(comment.id)}
                    onUnlike={() => unlikeComment(comment.id)}
                    disabled={!user}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {user ? (
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 flex gap-2">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-4 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-amber-400"
            />
            <Button size="sm" icon={<Send size={14} />} onClick={handlePost} disabled={posting}>
              Post
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            <a href="/login" className="text-amber-600 font-semibold hover:underline">
              Log in
            </a>{" "}
            to join the discussion.
          </p>
        )}
      </div>
    </section>
  );
};

export default ThreadDetail;
