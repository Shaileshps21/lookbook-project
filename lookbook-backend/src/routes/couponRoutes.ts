import { Router } from "express";
import { validateCoupon } from "../controllers/couponController";
import { protect } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { validateCouponSchema } from "../validators/couponValidators";

const router = Router();

router.post("/validate", protect, validate(validateCouponSchema), validateCoupon);

export default router;
