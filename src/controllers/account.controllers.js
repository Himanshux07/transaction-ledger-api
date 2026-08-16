import Account from "../models/account.models.js";

const createAccount = async (req, res) => {
    try {
        const user = req.user;

        const account = await Account.create({
            user: user._id
        });

        return res.status(201).json({
            success: true,
            message: "Account created successfully",
            data: account
        });
    } catch (error) {
        console.error("Error creating account:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error creating account"
        });
    }
};

const getAccount = async (req, res) => {
    try {
        const user = req.user;

        const accounts = await Account.find({ user: user._id });

        return res.status(200).json({
            success: true,
            message: "Accounts fetched successfully",
            data: accounts
        });
    } catch (error) {
        console.error("Error fetching accounts:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error fetching accounts"
        });
    }
};

export default {
    createAccount,
    getAccount
};

