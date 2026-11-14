import { Router } from "express";
import { getTicketsByEvent, createTicket, updateTicket, deleteTicket } from "../controllers/ticketController.js";
import verifyToken from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = Router();

router.get("/event/:eventId", getTicketsByEvent);
router.post("/event/:eventId", verifyToken, authorize("event_organizer"), createTicket);
router.put("/:id", verifyToken, authorize("event_organizer", "super_admin"), updateTicket);
router.delete("/:id", verifyToken, authorize("event_organizer", "super_admin"), deleteTicket);

export default router;