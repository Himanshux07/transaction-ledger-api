import express from "express";
import cookieParser from "cookie-parser";


const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

import userRouter from "./routes/user.routes.js";
import accountRoutes from "./routes/account.routes.js"

// Routes
app.use("/api/users",userRouter);
app.use("/api/accounts",accountRoutes)
export default app;