import jwt from "jsonwebtoken";
import User from "../models/user.models.js";

const authMiddleware = async (req, res, next) => {
    try {
        const token =
            req.cookies?.token ||
            (req.headers.authorization && req.headers.authorization.startsWith("Bearer")
                ? req.headers.authorization.split(" ")[1]
                : null);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Not authorized, no token provided"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded._id).select("-password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found or invalid token"
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Not authorized, token verification failed"
        });
    }
};

export { authMiddleware };
