import { Router } from "express";
import {
  getChallenges,
  createChallenge,
  joinChallenge,
  leaveChallenge,
  getMyChallengeProgress,
  getMyBadges,
  getMyChallenges,
  getLeaderboard,
} from "../controllers/challengeController";
import { protect, attachUserIfPresent } from "../middleware/auth";

const router = Router();

router.get("/", attachUserIfPresent, getChallenges);
// Any logged-in user can propose a challenge (community-driven, not
// admin-only) — the "official" flag is silently ignored unless req.user is
// an admin, so no separate admin-only route is needed.
router.post("/", protect, createChallenge);
router.get("/mine", protect, getMyChallenges);
router.get("/badges/mine", protect, getMyBadges);
router.post("/:challengeId/join", protect, joinChallenge);
router.delete("/:challengeId/join", protect, leaveChallenge);
router.get("/:challengeId/progress", protect, getMyChallengeProgress);
router.get("/:challengeId/leaderboard", attachUserIfPresent, getLeaderboard);

export default router;
