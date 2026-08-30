import { Router } from "express";
import { markBookFinished, getReadingStats, getSustainabilityStats } from "../controllers/readingController";
import { protect } from "../middleware/auth";

const router = Router();

router.use(protect);

router.get("/stats", getReadingStats);
router.get("/sustainability", getSustainabilityStats);
router.post("/finish/:bookId", markBookFinished);

export default router;
