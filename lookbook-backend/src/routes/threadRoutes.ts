import { Router } from "express";
import {
  getThreadsForClub,
  getThreadsForBook,
  createThread,
  getThreadById,
  deleteThread,
  addComment,
  deleteComment,
} from "../controllers/threadController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/club/:clubId", getThreadsForClub);
router.get("/book/:bookId", getThreadsForBook);
router.post("/", protect, createThread);
router.get("/:threadId", getThreadById);
router.delete("/:threadId", protect, deleteThread);
router.post("/:threadId/comments", protect, addComment);
router.delete("/comments/:commentId", protect, deleteComment);

export default router;
