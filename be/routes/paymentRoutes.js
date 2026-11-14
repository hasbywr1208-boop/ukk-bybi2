import { Router } from "express";
import {
  createPayment, midtransWebhook, checkPaymentStatus, getAllPayments,
} from "../controllers/paymentController.js";
import verifyToken from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = Router();

router.post("/", verifyToken, authorize("customer"), createPayment);
router.post("/midtrans/webhook", midtransWebhook); // dipanggil Midtrans, TANPA token JWT
router.get("/status/:transaction_id", verifyToken, authorize("customer"), checkPaymentStatus);
router.get("/", verifyToken, authorize("super_admin"), getAllPayments);

export default router;