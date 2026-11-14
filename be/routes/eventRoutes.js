import { Router } from "express";
import {
  searchEvents, getEventDetail, getMyEvents, createEvent,
  updateEvent, updateEventStatus, deleteEvent, getAllEventsAdmin,
} from "../controllers/eventController.js";
import verifyToken from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = Router();

router.get("/", searchEvents); // ?keyword=&date=&category_id=&city=
router.get("/admin/all", verifyToken, authorize("super_admin"), getAllEventsAdmin);
router.get("/mine", verifyToken, authorize("event_organizer"), getMyEvents);
router.get("/:id", getEventDetail);

router.post("/", verifyToken, authorize("event_organizer"), createEvent);
router.put("/:id", verifyToken, authorize("event_organizer", "super_admin"), updateEvent);
router.patch("/:id/status", verifyToken, authorize("event_organizer", "super_admin"), updateEventStatus);
router.delete("/:id", verifyToken, authorize("event_organizer", "super_admin"), deleteEvent);

export default router;