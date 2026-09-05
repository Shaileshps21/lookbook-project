import { Router } from "express";
import {
  getThreadsForClub,
  getThreadsForBook,
  createThread,
  getThreadById,
  deleteThread,
  addComment,
  deleteComment,
  likeThread,
  unlikeThread,
  likeComment,
  unlikeComment,
} from "../controllers/threadController";
import { protect, attachUserIfPresent } from "../middleware/auth";

const router = Router();

router.get("/club/:clubId", attachUserIfPresent, getThreadsForClub);
router.get("/book/:bookId", attachUserIfPresent, getThreadsForBook);
router.post("/", protect, createThread);
router.get("/:threadId", attachUserIfPresent, getThreadById);
router.delete("/:threadId", protect, deleteThread);
router.post("/:threadId/like", protect, likeThread);
router.delete("/:threadId/like", protect, unlikeThread);
router.post("/:threadId/comments", protect, addComment);
router.delete("/comments/:commentId", protect, deleteComment);
router.post("/comments/:commentId/like", protect, likeComment);
router.delete("/comments/:commentId/like", protect, unlikeComment);

export default router;
