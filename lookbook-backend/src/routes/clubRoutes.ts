import { Router } from "express";
import {
  getClubs,
  getClubById,
  createClub,
  updateClub,
  joinClub,
  leaveClub,
  removeMember,
  deleteClub,
  getClubByInvite,
  joinByInvite,
  regenerateInvite,
  toggleInvite,
} from "../controllers/clubController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/", getClubs);
router.post("/", protect, createClub);
router.get("/invite/:token", getClubByInvite);
router.post("/invite/:token/join", protect, joinByInvite);
router.get("/:id", getClubById);
router.patch("/:id", protect, updateClub);
router.post("/:id/join", protect, joinClub);
router.post("/:id/leave", protect, leaveClub);
router.post("/:id/regenerate-invite", protect, regenerateInvite);
router.patch("/:id/invite-enabled", protect, toggleInvite);
router.delete("/:id/members/:memberId", protect, removeMember);
router.delete("/:id", protect, deleteClub);

export default router;
