import { Router } from "express";
import rateLimit from "express-rate-limit";
import { publicBookList, publicBookDetail, publicCategories } from "../controllers/publicApiController";

const router = Router();

// Public API is unauthenticated and externally reachable — keep it gentle.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many public API requests. Please slow down." },
});
router.use(publicLimiter);

/** Public read-only API (future.md Phase 12 stretch) — no auth required. */
router.get("/books", publicBookList);
router.get("/books/:id", publicBookDetail);
router.get("/categories", publicCategories);

router.get("/", (_req, res) => {
  res.json({
    success: true,
    name: "LookBook Public API",
    version: "1",
    endpoints: [
      { method: "GET", path: "/public/books", query: { page: "number", limit: "number (max 50)", search: "text", category: "string" } },
      { method: "GET", path: "/public/books/:id", query: {} },
      { method: "GET", path: "/public/categories", query: {} },
    ],
  });
});

export default router;