import Transaction from "../models/transaction.models.js";
import Account from "../models/account.models.js";
import Ledger from "../models/ledger.models.js";
import mongoose from "mongoose";
import { sendTransactionEmail } from "../services/email.js";

const createTransaction = async (req, res) => {
    let session;
    try {
        /*
            1. Validate request
        */
        const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

        if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Check if the from and to accounts are valid and populate user details
        const fromUserAccount = await Account.findById(fromAccount).populate("user");
        const toUserAccount = await Account.findById(toAccount).populate("user");

        if (!fromUserAccount || !toUserAccount) {
            return res.status(404).json({
                success: false,
                message: "Invalid account"
            });
        }

        /*
            2. Validate idempotencyKey
        */
        const existTransaction = await Transaction.findOne({ idempotencyKey });
        if (existTransaction) {
            if (existTransaction.status === "success") {
                return res.status(409).json({
                    success: false,
                    message: "Transaction already processed successfully",
                    transaction: existTransaction
                });
            }
            if (existTransaction.status === "pending") {
                return res.status(200).json({
                    success: true,
                    message: "Transaction is still processing"
                });
            }
            if (existTransaction.status === "failed") {
                return res.status(400).json({
                    success: false,
                    message: "Transaction has failed"
                });
            }
            if (existTransaction.status === "reversed") {
                return res.status(409).json({
                    success: false,
                    message: "Transaction has been reversed"
                });
            }
        }

        /*
            3. Check Account status
        */
        if (fromUserAccount.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "From account is not active"
            });
        }
        if (toUserAccount.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "To account is not active"
            });
        }

        /*
            4. Check Account balance
        */
        const balance = await fromUserAccount.getBalance();

        if (balance < amount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance, current balance is ${balance}. Requested amount is ${amount}`
            });
        }

        /*
            5. Create pending transaction OUTSIDE session so retries can see it
        */
        const transaction = await Transaction.create({
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "pending"
        });

        /*
            6. Create ledger entries & finalize inside a database session
        */
        try {
            session = await mongoose.startSession();
            session.startTransaction();

            await Ledger.create(
                [
                    {
                        account: fromAccount,
                        type: "debit",
                        amount,
                        balance: balance - amount,
                        transaction: transaction._id
                    }
                ],
                { session }
            );

            await Ledger.create(
                [
                    {
                        account: toAccount,
                        type: "credit",
                        amount,
                        balance: balance + amount,
                        transaction: transaction._id
                    }
                ],
                { session }
            );

            transaction.status = "success";
            await transaction.save({ session });

            await session.commitTransaction();
            session.endSession();
        }
        catch (sessionError) {
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
            // Mark transaction as failed so retries know it didn't go through
            transaction.status = "failed";
            await transaction.save();
            console.error("Session error during transaction:", sessionError);
            return res.status(500).json({
                success: false,
                message: "Transaction failed during processing"
            });
        }

        /*
            6. Send email notifications safely
        */
        try {
            if (fromUserAccount.user?.email) {
                await sendTransactionEmail(fromUserAccount.user.email, fromUserAccount.user.name, transaction._id);
            }
            if (toUserAccount.user?.email) {
                await sendTransactionEmail(toUserAccount.user.email, toUserAccount.user.name, transaction._id);
            }
        } 
        catch (emailErr) {
            console.error("Failed to send transaction email:", emailErr);
        }

        return res.status(200).json({
            success: true,
            message: "Transaction created successfully",
            transaction
        });
    }
    catch (error) {
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        console.error("Error creating transaction:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while creating transaction"
        });
    }
};

const createInitialFundsTransaction = async (req, res) => {
    let session
    try {
        const {toAccount,amount,idempotencyKey} = req.body;

        if(!toAccount || !amount || !idempotencyKey){
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Idempotency check — return existing transaction if already processed
        const existTransaction = await Transaction.findOne({ idempotencyKey });
        if (existTransaction) {
            if (existTransaction.status === "success") {
                return res.status(409).json({
                    success: false,
                    message: "Transaction already processed successfully",
                    transaction: existTransaction
                });
            }
            if (existTransaction.status === "pending") {
                return res.status(200).json({
                    success: true,
                    message: "Transaction is still processing"
                });
            }
            if (existTransaction.status === "failed") {
                return res.status(400).json({
                    success: false,
                    message: "Transaction has failed"
                });
            }
            if (existTransaction.status === "reversed") {
                return res.status(409).json({
                    success: false,
                    message: "Transaction has been reversed"
                });
            }
        }

        const toUserAccount = await Account.findOne({_id : toAccount})

        if(!toUserAccount){
            return res.status(404).json({
                success: false,
                message: "To account not found"
            });
        }
        const fromUserAccount = await Account.findOne({
            user: req.user._id
        })
        
        if(!fromUserAccount){
            return res.status(404).json({
                success: false,
                message: "From account not found"
            });
        }

        // Create pending transaction OUTSIDE session so retries can see it
        const transaction = await Transaction.create({
            fromAccount: fromUserAccount._id,
            toAccount: toUserAccount._id,
            amount,
            idempotencyKey,
            status: "pending"
        });

        try {
            session = await mongoose.startSession();
            session.startTransaction();

            await Ledger.create(
                [
                    {
                        account: fromUserAccount._id,
                        type: "debit",
                        amount,
                        balance: 0,
                        transaction: transaction._id
                    }
                ],
                { session }
            );

            await Ledger.create(
                [
                    {
                        account: toUserAccount._id,
                        type: "credit",
                        amount,
                        balance: amount,
                        transaction: transaction._id
                    }
                ],
                { session }
            );

            transaction.status = "success";
            await transaction.save({ session });

            await session.commitTransaction();
            session.endSession();

            await sendTransactionEmail(toUserAccount.user.email, toUserAccount.user.name, transaction._id);
        } 
        catch (sessionError) {
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
            // Mark transaction as failed so retries know it didn't go through
            transaction.status = "failed";
            await transaction.save();
            console.error("Session error during initial fund transaction:", sessionError);
            return res.status(500).json({
                success: false,
                message: "Transaction failed during processing"
            });
        }
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while creating transaction"
        });
    }
};

export default { createTransaction,createInitialFundsTransaction };