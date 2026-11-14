import { Router } from "express";
import { getDashboard } from "../controllers/organizerController.js";
import verifyToken from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = Router();

router.get("/dashboard", verifyToken, authorize("event_organizer"), getDashboard);

export default router;