import { Router } from "express";
import multer from "multer";
import { uploadImage } from "../controllers/uploadController";
import { protect } from "../middleware/auth";
import { ApiError } from "../utils/ApiError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(ApiError.badRequest("Only image files are allowed."));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.post("/image", protect, upload.single("image"), uploadImage);

export default router;
