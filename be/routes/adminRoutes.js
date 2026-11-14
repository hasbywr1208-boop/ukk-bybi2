import { Router } from "express";
import {
  getAllOrganizers, createOrganizer, updateOrganizer, deleteOrganizer, getAdminDashboard,
} from "../controllers/adminController.js";
import verifyToken from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = Router();

router.use(verifyToken, authorize("super_admin"));

router.get("/dashboard", getAdminDashboard);
router.get("/organizers", getAllOrganizers);
router.post("/organizers", createOrganizer);
router.put("/organizers/:id", updateOrganizer);
router.delete("/organizers/:id", deleteOrganizer);

export default router;