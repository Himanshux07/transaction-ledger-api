import express from "express";
import accountController from "../controllers/account.controllers.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, accountController.createAccount);
router.get("/", authMiddleware, accountController.getAccount);

export default router;