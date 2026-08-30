import { Router } from "express";
import {
  getBooks,
  getBookById,
  getBookByIsbn,
  getSimilarBooks,
  createBook,
  updateBook,
  deleteBook,
  bulkImportBooks,
} from "../controllers/bookController";
import { getReviewsForBook, createReview, deleteReview } from "../controllers/reviewController";
import { aiSearch } from "../controllers/aiSearchController";
import { protect, adminOnly, attachUserIfPresent } from "../middleware/auth";
import { aiLimiter, reviewLimiter } from "../middleware/rateLimiters";
import { validate } from "../middleware/validate";
import { createBookSchema, updateBookSchema } from "../validators/bookValidators";
import { createReviewSchema } from "../validators/reviewValidators";

const router = Router();

router.get("/", getBooks);
router.get("/ai-search", aiLimiter, aiSearch);
router.get("/by-isbn/:isbn", protect, getBookByIsbn);
router.get("/:id", attachUserIfPresent, getBookById);
router.get("/:id/similar", getSimilarBooks);
router.get("/:id/reviews", getReviewsForBook);
router.post("/:id/reviews", protect, reviewLimiter, validate(createReviewSchema), createReview);
router.delete("/:id/reviews/:reviewId", protect, deleteReview);

router.post("/", protect, adminOnly, validate(createBookSchema), createBook);
router.post("/bulk-import", protect, adminOnly, bulkImportBooks);
router.put("/:id", protect, adminOnly, validate(updateBookSchema), updateBook);
router.delete("/:id", protect, adminOnly, deleteBook);

export default router;
