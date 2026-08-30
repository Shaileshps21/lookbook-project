import { Router } from "express";
import { getMyAddresses, createAddress, updateAddress, deleteAddress } from "../controllers/addressController";
import { protect } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { upsertAddressSchema } from "../validators/addressValidators";

const router = Router();

router.use(protect);

router.get("/", getMyAddresses);
router.post("/", validate(upsertAddressSchema), createAddress);
router.put("/:id", validate(upsertAddressSchema), updateAddress);
router.delete("/:id", deleteAddress);

export default router;
