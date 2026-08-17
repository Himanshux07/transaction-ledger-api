import express from "express";
import accountController from "../controllers/account.controllers.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, accountController.createAccount);
router.get("/", authMiddleware, accountController.getAccount);
// get balance of specific account id
router.get("/balance/:accountId",authMiddleware,accountController.getAccountBalance)


export default router;
