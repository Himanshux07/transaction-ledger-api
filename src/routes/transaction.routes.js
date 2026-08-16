import express from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import transactionControllers from "../controllers/transaction.controllers.js";

const router = express.Router();

router.post("/", authMiddleware, transactionControllers.createTransaction);

export default router;