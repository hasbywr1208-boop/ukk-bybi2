import { Router } from "express";
import { register, login, refreshToken, logout, getMe, updateProfile } from "../controllers/authController.js";
import verifyToken from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.get("/me", verifyToken, getMe);
router.put("/me", verifyToken, updateProfile);

export default router;