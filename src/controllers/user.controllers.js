import User from "../models/user.models.js";
import { sendRegistrationEmail } from "../services/email.js";
import TokenBlackList from "../models/blackList.models.js";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        const user = await User.create({
            name,
            email,
            password
        });

        const token = user.generateToken();

        const userResponse = {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt
        };

        // Try sending registration email safely without failing registration response if email fails
        try {
            await sendRegistrationEmail(user.email, user.name);
        } catch (emailError) {
            console.error("Error sending registration email:", emailError);
        }

        res.status(201)
            .cookie("token", token, cookieOptions)
            .json({
                success: true,
                message: "User registered successfully",
                token,
                data: userResponse
            });
    } 
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Error registering user"
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const token = user.generateToken();

        const userResponse = {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        res.status(200)
            .cookie("token", token, cookieOptions)
            .json({
                success: true,
                message: "Logged in successfully",
                token,
                data: userResponse
            });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Error logging in"
        });
    }
};

const logout = async (req, res) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

        if(!token){
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        await TokenBlackList.create({
            token
        });
        
        return res.clearCookie("token").json({
                message: "Logged out successfully"
            });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Error logging out"
        });
    }
};

export default {
    register,
    login,
    logout
};

