import { Router } from "express";
import {
  getChallenges,
  createChallenge,
  getMyChallengeProgress,
  getMyBadges,
  getLeaderboard,
} from "../controllers/challengeController";
import { protect, adminOnly } from "../middleware/auth";

const router = Router();

router.get("/", getChallenges);
router.post("/", protect, adminOnly, createChallenge);
router.get("/badges/mine", protect, getMyBadges);
router.get("/:challengeId/progress", protect, getMyChallengeProgress);
router.get("/:challengeId/leaderboard", getLeaderboard);

export default router;
