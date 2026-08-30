import { Router } from "express";
import {
  getInventory,
  updateInventoryItem,
  delistInventoryItem,
  getSellerOrders,
  getSellerRevenue,
  requestPayout,
  getSellerPerformance,
} from "../controllers/sellerController";
import { protect, sellerOnly } from "../middleware/auth";

const router = Router();

router.use(protect, sellerOnly);

router.get("/inventory", getInventory);
router.patch("/inventory/:bookId", updateInventoryItem);
router.delete("/inventory/:bookId", delistInventoryItem);

router.get("/orders", getSellerOrders);

router.get("/revenue", getSellerRevenue);
router.post("/payouts", requestPayout);

router.get("/performance", getSellerPerformance);

export default router;
