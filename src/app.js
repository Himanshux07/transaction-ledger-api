import express from "express";
import userRouter from "./routes/user.routes.js";
import cookieParser from "cookie-parser";


const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api/users",userRouter);

export default app;