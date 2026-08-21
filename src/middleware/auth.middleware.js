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

// middleware to check if user is system user
const authSystemMiddleware = async (req,res,next) =>{
    try {
        const token = req.cookies?.token || req.headers.authorization.split(" ")[1];
        
        if(!token){
            return res.status(401).json({
                message: "Not authorized, no token provided"
            });
        }

        const isBlackListed = await TokenBlackList.findOne({token});
        if(isBlackListed){
            return res.status(401).json({
                success: false,
                message: "Not authorized, token is blacklisted"
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded._id).select("-password").select("+systemUser");
        
        if(!user){
            return res.status(401).json({
                success: false,
                message: "User not found or invalid token"
            });
        }
        
        if(!user.systemUser){
            return res.status(401).json({
                success: false,
                message: "Not authorized, user is not system user"
            });
        }
        
        req.user = user;
        next();
    } 
    catch (error) {
        return res.status(401).json({
            success: false,
            message: error.message || "Not authorized, system user check failed"
        });
    }
}

export { authMiddleware,authSystemMiddleware };
