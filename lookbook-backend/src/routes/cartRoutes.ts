import { Router } from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../controllers/cartController";
import { protect } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { addToCartSchema, updateCartSchema } from "../validators/cartValidators";

const router = Router();

router.use(protect);

router.get("/", getCart);
router.post("/", validate(addToCartSchema), addToCart);
router.patch("/:bookId/:mode", validate(updateCartSchema), updateCartItem);
router.delete("/:bookId/:mode", removeFromCart);
router.delete("/", clearCart);

export default router;
