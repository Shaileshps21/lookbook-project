import { Router } from "express";
import multer from "multer";
import {
  createListing,
  getMyListings,
  getAllListings,
  updateListingStatus,
  deleteListing,
} from "../controllers/listingController";
import { scanBookCover, suggestListingPrice } from "../controllers/bookScanController";
import { protect, adminOnly, requireVerifiedEmail } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createListingSchema, updateListingStatusSchema } from "../validators/listingValidators";
import { listingLimiter } from "../middleware/rateLimiters";
import { ApiError } from "../utils/ApiError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(ApiError.badRequest("Only image files are allowed."));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.post("/", protect, requireVerifiedEmail, listingLimiter, validate(createListingSchema), createListing);
// AI OCR Book Upload (§3.1) — scan a cover photo into a pre-filled form.
router.post("/scan", protect, requireVerifiedEmail, listingLimiter, upload.single("image"), scanBookCover);
router.post("/scan-price", protect, requireVerifiedEmail, listingLimiter, suggestListingPrice);
router.get("/mine", protect, getMyListings);
router.get("/", protect, adminOnly, getAllListings);
router.patch("/:id/status", protect, adminOnly, validate(updateListingStatusSchema), updateListingStatus);
router.delete("/:id", protect, deleteListing);

export default router;
