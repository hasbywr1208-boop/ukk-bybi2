import { Router } from "express";
import {
  checkout, getMyTransactions, getTransactionDetail, getSalesReport,
} from "../controllers/transactionController.js";
import verifyToken from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = Router();

router.post("/checkout", verifyToken, authorize("customer"), checkout);
router.get("/mine", verifyToken, authorize("customer"), getMyTransactions);
router.get("/:id", verifyToken, getTransactionDetail);
router.get("/report/:eventId", verifyToken, authorize("event_organizer", "super_admin"), getSalesReport);

export default router;