import { Router } from "express";
import multer from "multer";
import { chat, chatStream } from "../controllers/assistantController";
import { transcribeAudio } from "../controllers/voiceController";
import { protect } from "../middleware/auth";
import { aiLimiter } from "../middleware/rateLimiters";
import { ApiError } from "../utils/ApiError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("audio/")) {
      cb(ApiError.badRequest("Only audio files are allowed."));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

/** POST /assistant/chat — AI chat assistant with tool-calling (future.md §3.3).
 * Limiter sits before `protect` so even unauthenticated requests can't hammer
 * the paid Gemini proxy. */
router.post("/chat", aiLimiter, protect, chat);

/** POST /assistant/chat/stream — streaming reply over SSE (§3.3 #4). */
router.post("/chat/stream", aiLimiter, protect, chatStream);

/** POST /assistant/transcribe — voice search (future.md §3.8): audio → text. */
router.post("/transcribe", aiLimiter, protect, upload.single("audio"), transcribeAudio);

export default router;
