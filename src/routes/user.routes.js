import express from "express";
import userController from "../controllers/user.controllers.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", userController.register);
router.post("/login", userController.login);
router.post("/logout", authMiddleware, userController.logout);

export default router;


