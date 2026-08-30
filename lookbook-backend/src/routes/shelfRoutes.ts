import { Router } from "express";
import {
  getMyShelves,
  createShelf,
  updateShelf,
  deleteShelf,
  addBookToShelf,
  removeBookFromShelf,
  getPublicShelves,
} from "../controllers/shelfController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/", protect, getMyShelves);
router.post("/", protect, createShelf);
router.patch("/:shelfId", protect, updateShelf);
router.delete("/:shelfId", protect, deleteShelf);
router.post("/:shelfId/books/:bookId", protect, addBookToShelf);
router.delete("/:shelfId/books/:bookId", protect, removeBookFromShelf);
router.get("/user/:userId", getPublicShelves);

export default router;
