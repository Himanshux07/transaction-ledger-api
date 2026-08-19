import Account from "../models/account.models.js";
import mongoose from "mongoose";

const createAccount = async (req, res) => {
    try {
        const user = req.user;

        const account = await Account.create({
            user: user._id
        });

        return res.status(201).json({
            success: true,
            message: "Account created successfully",
            data: {
                ...account.toObject(),
                balance: 0
            }
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

        // Attach computed live balance to each account
        const accountsWithBalance = await Promise.all(
            accounts.map(async (account) => {
                const balance = await account.getBalance();
                const isCurrentlyLocked = Boolean(account.isLocked && account.lockedUntil && account.lockedUntil > new Date());
                return {
                    ...account.toObject(),
                    balance,
                    isLocked: isCurrentlyLocked
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: "Accounts fetched successfully",
            data: accountsWithBalance
        });
    } 
    catch (error) {
        console.error("Error fetching accounts:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error fetching accounts"
        });
    }
};

const getAccountBalance = async (req, res) => {
    try {
        const { accountId } = req.params;

        if (!accountId) {
            return res.status(400).json({
                success: false,
                message: "Account ID is required"
            });
        }

        // Validate MongoDB ObjectId format
        if (!mongoose.Types.ObjectId.isValid(accountId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid account ID format"
            });
        }

        const account = await Account.findOne({
            _id: accountId,
            user: req.user._id
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Account not found"
            });
        }

        const balance = await account.getBalance();
        const isCurrentlyLocked = Boolean(account.isLocked && account.lockedUntil && account.lockedUntil > new Date());

        return res.status(200).json({
            success: true,
            message: "Account balance fetched successfully",
            data: {
                accountId: account._id,
                status: account.status,
                currency: account.currency,
                balance,
                isLocked: isCurrentlyLocked
            }
        });
    } 
    catch (error) {
        console.error("Error fetching account balance:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error fetching account balance"
        });
    }
};

export default {
    createAccount,
    getAccount,
    getAccountBalance
};



