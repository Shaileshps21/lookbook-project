import { Router } from "express";
import { getClientConfig } from "../controllers/configController";

const router = Router();

// Public (no auth) — read-only capability flags for the frontend.
router.get("/", getClientConfig);

export default router;