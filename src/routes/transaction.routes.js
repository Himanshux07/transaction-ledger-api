import express from "express";
import { authMiddleware, authSystemMiddleware } from "../middleware/auth.middleware.js";
import transactionControllers from "../controllers/transaction.controllers.js";

const router = express.Router();

router.post("/", authMiddleware, transactionControllers.createTransaction);

router.post("/system/initialifund", authSystemMiddleware, transactionControllers.createInitialFundsTransaction);

router.get("/history", authMiddleware, transactionControllers.getTransactionHistory);

export default router;
