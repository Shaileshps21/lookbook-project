import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Thread, type IThread } from "../models/Thread";
import { Comment, type IComment } from "../models/Comment";
import { Like } from "../models/Like";
import { notify } from "../utils/notify";

/** Attaches `likesCount`/`likedByMe` to a list of populated thread or
 * comment documents. Batched as one `Like.find` for the whole page (a
 * bounded, in-memory membership check) rather than one `Like.exists` call
 * per row — the same "fetch a window, check membership in memory" approach
 * `followController.getFollowingFeed` already uses for its own merge. */
const withLikedByMe = async <T extends { id: string; likesCount: number }>(
  rows: T[],
  targetType: "thread" | "comment",
  viewerId?: string
): Promise<(T & { likedByMe: boolean })[]> => {
  if (!viewerId || rows.length === 0) {
    return rows.map((r) => ({ ...r, likedByMe: false }));
  }
  const likes = await Like.find({
    user: viewerId,
    targetType,
    target: { $in: rows.map((r) => r.id) },
  }).select("target");
  const likedIds = new Set(likes.map((l) => l.target.toString()));
  return rows.map((r) => ({ ...r, likedByMe: likedIds.has(r.id) }));
};

export const getThreadsForClub = asyncHandler(async (req: Request, res: Response) => {
  const threads = await Thread.find({ club: req.params.clubId }).populate("author", "name avatar").sort("-createdAt");
  const withLikes = await withLikedByMe(
    threads.map((t) => t.toJSON() as unknown as IThread & { id: string }),
    "thread",
    req.user?.id
  );
  return ApiResponse.ok(res, withLikes);
});

export const getThreadsForBook = asyncHandler(async (req: Request, res: Response) => {
  const threads = await Thread.find({ book: req.params.bookId }).populate("author", "name avatar").sort("-createdAt");
  const withLikes = await withLikedByMe(
    threads.map((t) => t.toJSON() as unknown as IThread & { id: string }),
    "thread",
    req.user?.id
  );
  return ApiResponse.ok(res, withLikes);
});

export const createThread = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { title, content, images, clubId, bookId } = req.body as {
    title: string;
    content: string;
    images?: string[];
    clubId?: string;
    bookId?: string;
  };
  if (!title?.trim()) throw ApiError.badRequest("A short title is required.");
  if (!content?.trim()) throw ApiError.badRequest("Post content can't be empty.");
  if (!clubId && !bookId) throw ApiError.badRequest("A post must be scoped to a club or a book.");

  const thread = await Thread.create({
    title: title.trim(),
    content: content.trim(),
    images: Array.isArray(images) ? images.slice(0, 4) : [],
    author: req.user.id,
    club: clubId || undefined,
    book: bookId || undefined,
  });
  await thread.populate("author", "name avatar");

  return ApiResponse.created(res, { ...thread.toJSON(), likedByMe: false }, "Posted");
});

export const getThreadById = asyncHandler(async (req: Request, res: Response) => {
  const thread = await Thread.findById(req.params.threadId).populate("author", "name avatar");
  if (!thread) throw ApiError.notFound("Thread not found");

  const comments = await Comment.find({ thread: thread.id }).populate("author", "name avatar").sort("createdAt");

  const [threadWithLike] = await withLikedByMe([thread.toJSON() as unknown as IThread & { id: string }], "thread", req.user?.id);
  const commentsWithLikes = await withLikedByMe(
    comments.map((c) => c.toJSON() as unknown as IComment & { id: string }),
    "comment",
    req.user?.id
  );

  return ApiResponse.ok(res, { thread: threadWithLike, comments: commentsWithLikes });
});

export const deleteThread = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const thread = await Thread.findById(req.params.threadId);
  if (!thread) throw ApiError.notFound("Thread not found");
  if (thread.author.toString() !== req.user.id && req.user.role !== "admin") {
    throw ApiError.forbidden("You can only delete your own threads.");
  }

  await Comment.deleteMany({ thread: thread.id });
  await Like.deleteMany({ targetType: "thread", target: thread.id });
  await thread.deleteOne();

  return ApiResponse.ok(res, null, "Thread deleted");
});

export const addComment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const thread = await Thread.findById(req.params.threadId);
  if (!thread) throw ApiError.notFound("Thread not found");

  const { content } = req.body as { content: string };
  if (!content?.trim()) throw ApiError.badRequest("Comment can't be empty.");

  const comment = await Comment.create({ thread: thread.id, author: req.user.id, content: content.trim() });
  await comment.populate("author", "name avatar");

  thread.commentsCount += 1;
  await thread.save();

  if (thread.author.toString() !== req.user.id) {
    notify(
      thread.author.toString(),
      "community.comment",
      "New comment on your post",
      `${req.user.name} commented on "${thread.title}"`,
      `/threads/${thread.id}`
    );
  }

  return ApiResponse.created(res, { ...comment.toJSON(), likedByMe: false }, "Comment added");
});

export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw ApiError.notFound("Comment not found");
  if (comment.author.toString() !== req.user.id && req.user.role !== "admin") {
    throw ApiError.forbidden("You can only delete your own comments.");
  }

  await comment.deleteOne();
  await Like.deleteMany({ targetType: "comment", target: comment.id });
  await Thread.findByIdAndUpdate(comment.thread, { $inc: { commentsCount: -1 } });

  return ApiResponse.ok(res, null, "Comment deleted");
});

export const likeThread = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const thread = await Thread.findById(req.params.threadId);
  if (!thread) throw ApiError.notFound("Thread not found");

  // find-then-create rather than create+catch-duplicate — same idempotent
  // "check, then act once" shape challengeController's badge-award already
  // uses, so a double-tap the UI should already prevent optimistically is a
  // harmless no-op instead of a 409.
  const existing = await Like.findOne({ user: req.user.id, targetType: "thread", target: thread.id });
  if (existing) {
    return ApiResponse.ok(res, { likesCount: thread.likesCount }, "Already liked");
  }
  await Like.create({ user: req.user.id, targetType: "thread", target: thread.id });

  thread.likesCount += 1;
  await thread.save();

  if (thread.author.toString() !== req.user.id) {
    notify(
      thread.author.toString(),
      "community.like",
      "Someone liked your post",
      `${req.user.name} liked "${thread.title}"`,
      `/threads/${thread.id}`
    );
  }

  return ApiResponse.ok(res, { likesCount: thread.likesCount }, "Liked");
});

export const unlikeThread = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const thread = await Thread.findById(req.params.threadId);
  if (!thread) throw ApiError.notFound("Thread not found");

  const removed = await Like.findOneAndDelete({ user: req.user.id, targetType: "thread", target: thread.id });
  if (removed) {
    thread.likesCount = Math.max(0, thread.likesCount - 1);
    await thread.save();
  }

  return ApiResponse.ok(res, { likesCount: thread.likesCount }, "Unliked");
});

export const likeComment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw ApiError.notFound("Comment not found");

  const existing = await Like.findOne({ user: req.user.id, targetType: "comment", target: comment.id });
  if (existing) {
    return ApiResponse.ok(res, { likesCount: comment.likesCount }, "Already liked");
  }
  await Like.create({ user: req.user.id, targetType: "comment", target: comment.id });

  comment.likesCount += 1;
  await comment.save();

  if (comment.author.toString() !== req.user.id) {
    notify(
      comment.author.toString(),
      "community.like",
      "Someone liked your comment",
      `${req.user.name} liked your comment`,
      `/threads/${comment.thread.toString()}`
    );
  }

  return ApiResponse.ok(res, { likesCount: comment.likesCount }, "Liked");
});

export const unlikeComment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw ApiError.notFound("Comment not found");

  const removed = await Like.findOneAndDelete({ user: req.user.id, targetType: "comment", target: comment.id });
  if (removed) {
    comment.likesCount = Math.max(0, comment.likesCount - 1);
    await comment.save();
  }

  return ApiResponse.ok(res, { likesCount: comment.likesCount }, "Unliked");
});
