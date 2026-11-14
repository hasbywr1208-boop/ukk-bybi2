import { Router } from "express";
import { getAll, create, update, remove } from "../controllers/categoryController.js";
import verifyToken from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = Router();

router.get("/", getAll);
router.post("/", verifyToken, authorize("super_admin"), create);
router.put("/:id", verifyToken, authorize("super_admin"), update);
router.delete("/:id", verifyToken, authorize("super_admin"), remove);

export default router;