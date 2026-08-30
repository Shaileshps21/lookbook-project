import { Router } from "express";
import {
  updatePreferences,
  updateMe,
  updateEmailPreferences,
  skipOnboarding,
  applyToSell,
  updatePublicProfileSetting,
  getMyStats,
  getPublicProfile,
} from "../controllers/userController";
import { protect, attachUserIfPresent } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  updatePreferencesSchema,
  updateMeSchema,
  updateEmailPreferencesSchema,
} from "../validators/userValidators";

const router = Router();

router.patch("/me", protect, validate(updateMeSchema), updateMe);
router.patch("/me/email-preferences", protect, validate(updateEmailPreferencesSchema), updateEmailPreferences);
router.patch("/preferences", protect, validate(updatePreferencesSchema), updatePreferences);
router.post("/preferences/skip", protect, skipOnboarding);
router.post("/apply-seller", protect, applyToSell);
router.patch("/public-profile", protect, updatePublicProfileSetting);
router.get("/me/stats", protect, getMyStats);
router.get("/:userId/public-profile", attachUserIfPresent, getPublicProfile);

export default router;
