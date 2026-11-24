import { Router } from "express";
import {
  validatePromo, getPromos, createPromo, updatePromo, deletePromo,
} from "../controllers/promoController.js";
import verifyToken from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = Router();

router.post("/validate", verifyToken, authorize("customer"), validatePromo);
router.get("/", verifyToken, authorize("event_organizer", "super_admin"), getPromos);
router.post("/", verifyToken, authorize("event_organizer", "super_admin"), createPromo);
router.put("/:id", verifyToken, authorize("event_organizer", "super_admin"), updatePromo);
router.delete("/:id", verifyToken, authorize("event_organizer", "super_admin"), deletePromo);

export default router;