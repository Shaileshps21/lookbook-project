import { Router } from "express";
import {
  followUser,
  unfollowUser,
  removeFollower,
  getFollowCounts,
  getFollowers,
  getFollowing,
  getFollowingFeed,
  getSuggestedUsers,
} from "../controllers/followController";
import { protect, attachUserIfPresent } from "../middleware/auth";

const router = Router();

router.get("/feed", protect, getFollowingFeed);
router.get("/suggestions", protect, getSuggestedUsers);
router.post("/:userId", protect, followUser);
router.delete("/:userId", protect, unfollowUser);
router.delete("/followers/:userId", protect, removeFollower);
router.get("/:userId/counts", attachUserIfPresent, getFollowCounts);
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);

export default router;
