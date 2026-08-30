import { Router } from "express";
import { getWishlist, toggleWishlist, removeFromWishlist } from "../controllers/wishlistController";
import { protect } from "../middleware/auth";

const router = Router();

router.use(protect);

router.get("/", getWishlist);
router.post("/:bookId", toggleWishlist);
router.delete("/:bookId", removeFromWishlist);

export default router;
