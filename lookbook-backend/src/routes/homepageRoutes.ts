import { Router } from "express";
import { getHomepage } from "../controllers/homepageController";
import { attachUserIfPresent } from "../middleware/auth";

const router = Router();

router.get("/", attachUserIfPresent, getHomepage);

export default router;
