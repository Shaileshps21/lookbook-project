import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { Thread } from "../models/Thread";
import { Comment } from "../models/Comment";

export const getThreadsForClub = asyncHandler(async (req: Request, res: Response) => {
  const threads = await Thread.find({ club: req.params.clubId }).populate("author", "name avatar").sort("-createdAt");
  return ApiResponse.ok(res, threads);
});

export const getThreadsForBook = asyncHandler(async (req: Request, res: Response) => {
  const threads = await Thread.find({ book: req.params.bookId }).populate("author", "name avatar").sort("-createdAt");
  return ApiResponse.ok(res, threads);
});

export const createThread = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { title, clubId, bookId } = req.body as { title: string; clubId?: string; bookId?: string };
  if (!title?.trim()) throw ApiError.badRequest("Thread title is required.");
  if (!clubId && !bookId) throw ApiError.badRequest("A thread must be scoped to a club or a book.");

  const thread = await Thread.create({
    title: title.trim(),
    author: req.user.id,
    club: clubId || undefined,
    book: bookId || undefined,
  });
  await thread.populate("author", "name avatar");

  return ApiResponse.created(res, thread, "Thread created");
});

export const getThreadById = asyncHandler(async (req: Request, res: Response) => {
  const thread = await Thread.findById(req.params.threadId).populate("author", "name avatar");
  if (!thread) throw ApiError.notFound("Thread not found");

  const comments = await Comment.find({ thread: thread.id }).populate("author", "name avatar").sort("createdAt");

  return ApiResponse.ok(res, { thread, comments });
});

export const deleteThread = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const thread = await Thread.findById(req.params.threadId);
  if (!thread) throw ApiError.notFound("Thread not found");
  if (thread.author.toString() !== req.user.id && req.user.role !== "admin") {
    throw ApiError.forbidden("You can only delete your own threads.");
  }

  await Comment.deleteMany({ thread: thread.id });
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

  return ApiResponse.created(res, comment, "Comment added");
});

export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw ApiError.notFound("Comment not found");
  if (comment.author.toString() !== req.user.id && req.user.role !== "admin") {
    throw ApiError.forbidden("You can only delete your own comments.");
  }

  await comment.deleteOne();
  await Thread.findByIdAndUpdate(comment.thread, { $inc: { commentsCount: -1 } });

  return ApiResponse.ok(res, null, "Comment deleted");
});
