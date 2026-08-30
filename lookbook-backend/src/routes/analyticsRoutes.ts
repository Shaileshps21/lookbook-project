import { Router } from "express";
import { trackEvent } from "../controllers/analyticsController";

const router = Router();

/** POST /analytics/track — public, fire-and-forget event ingestion (Phase 11.1). */
router.post("/track", trackEvent);

export default router;