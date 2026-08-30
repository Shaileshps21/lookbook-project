import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Send, Trash2 } from "lucide-react";
import Loader from "../components/common/Loader";
import Button from "../components/common/Button";
import { useAuth } from "../hooks/useAuth";
import { fetchThreadById, addComment, deleteComment } from "../services/threadService";
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
          <h1 className="text-xl font-bold text-slate-900">{thread.title}</h1>
          <p className="text-xs text-slate-400 mt-2">by {thread.author.name}</p>
        </div>

        <div className="space-y-3 mb-6">
          {comments.length === 0 ? (
            <p className="text-slate-400 text-sm">No comments yet. Start the discussion.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 flex justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-800 text-sm">{comment.author.name}</p>
                  <p className="text-slate-600 mt-1">{comment.content}</p>
                </div>
                {user && (user.id === comment.author.id || user.role === "admin") && (
                  <button onClick={() => handleDelete(comment.id)} className="text-slate-300 hover:text-red-500 shrink-0">
                    <Trash2 size={15} />
                  </button>
                )}
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
