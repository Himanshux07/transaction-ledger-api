import Transaction from "../models/transaction.models.js";
import Account from "../models/account.models.js";
import Ledger from "../models/ledger.models.js";
import mongoose from "mongoose";
import { sendTransactionEmail } from "../services/email.js";

const createTransaction = async (req, res) => {
    let session;
    let accountLocked = false;
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

    try {
        /*
            1. Validate request
        */
        if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (typeof amount !== "number" || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount must be a positive number"
            });
        }

        if (fromAccount === toAccount) {
            return res.status(400).json({
                success: false,
                message: "Cannot transfer funds to the same account"
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
            3. Security Check: Verify caller owns the source account
        */
        if (fromUserAccount.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: You do not own the source account"
            });
        }

        /*
            4. Check Account status
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
            5. ATOMICALLY ACQUIRE LOCK (30-second lock with auto-expiry)
        */
        const now = new Date();
        const lockExpiry = new Date(Date.now() + 30 * 1000); // 30 seconds from now

        const lockedAccount = await Account.findOneAndUpdate(
            {
                _id: fromAccount,
                status: "active",
                $or: [
                    { isLocked: false },
                    { lockedUntil: { $lte: now } },
                    { isLocked: { $exists: false } }
                ]
            },
            {
                $set: {
                    isLocked: true,
                    lockedUntil: lockExpiry
                }
            },
            { new: true }
        );

        if (!lockedAccount) {
            return res.status(409).json({
                message: "Another transaction is currently processing on this account. Please wait a moment."
            });
        }

        accountLocked = true;

        /*
            6. Create pending transaction OUTSIDE session so retries can see it
        */
        const transaction = await Transaction.create({
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "pending"
        });

        /*
            7. Create ledger entries & finalize inside a database session
        */
        try {
            session = await mongoose.startSession();
            session.startTransaction();

            // Read balance inside the locked session
            const balance = await fromUserAccount.getBalance(session);

            if (balance < amount) {
                throw new Error(`Insufficient balance, current balance is ₹${balance}. Requested amount is ₹${amount}`);
            }

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
            transaction.status = "failed";
            await transaction.save();

            // Release lock immediately on failure
            await Account.findByIdAndUpdate(fromAccount, { isLocked: false, lockedUntil: null });
            accountLocked = false;

            console.error("Session error during transaction:", sessionError.message);
            return res.status(400).json({
                success: false,
                message: sessionError.message || "Transaction failed during processing"
            });
        }

        /*
            8. Release lock on success
        */
        await Account.findByIdAndUpdate(fromAccount, { isLocked: false, lockedUntil: null });
        accountLocked = false;

        /*
            9. Send email notifications safely
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
        if (accountLocked && fromAccount) {
            await Account.findByIdAndUpdate(fromAccount, { isLocked: false, lockedUntil: null });
        }
        console.error("Error creating transaction:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error while creating transaction"
        });
    }
};

const createInitialFundsTransaction = async (req, res) => {
    let session;
    try {
        const { toAccount, amount, idempotencyKey } = req.body;

        if (!toAccount || !amount || !idempotencyKey) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (typeof amount !== "number" || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount must be a positive number"
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

        const toUserAccount = await Account.findOne({ _id: toAccount }).populate("user");

        if (!toUserAccount) {
            return res.status(404).json({
                success: false,
                message: "To account not found"
            });
        }
        const fromUserAccount = await Account.findOne({
            user: req.user._id
        });
        
        if (!fromUserAccount) {
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

            if (toUserAccount.user?.email) {
                await sendTransactionEmail(toUserAccount.user.email, toUserAccount.user.name, transaction._id);
            }

            return res.status(200).json({
                success: true,
                message: "Initial funds added successfully",
                transaction
            });
        } 
        catch (sessionError) {
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
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

const getTransactionHistory = async (req, res) => {
    try {
        // Pagination
        const page = Math.max(1, parseInt(req.query.page) || 1);

        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

        const skip = (page - 1) * limit;

        const {
            status,
            type,
            startDate,
            endDate,
            accountId
        } = req.query;

        if (!mongoose.Types.ObjectId.isValid(accountId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid accountId format"
            });
        }

        const userAccount = await Account.findOne({
            _id: accountId,
            user: req.user._id
        });

        if (!userAccount) {
            return res.status(404).json({
                success: false,
                message: "Account not found"
            });
        }

        const filter = {};

        if (type === "debit") {
            filter.fromAccount = userAccount._id;
        }
        else if (type === "credit") {
            filter.toAccount = userAccount._id;
        }
        else {
            filter.$or = [
                { fromAccount: userAccount._id },
                { toAccount: userAccount._id }
            ];
        }

        if (status) {
            filter.status = status;
        }


        if (startDate || endDate) {
            filter.createdAt = {};

            if (startDate) {
                filter.createdAt.$gte = new Date(startDate);
            }

            if (endDate) {
                filter.createdAt.$lte = new Date(endDate);
            }
        }

        const [transactions, totalTransactions] =
            await Promise.all([
                Transaction.find(filter)
                    .populate({
                        path: "fromAccount",
                        select: "_id currency user",
                        populate: {
                            path: "user",
                            select: "name email"
                        }
                    })
                    .populate({
                        path: "toAccount",
                        select: "_id currency user",
                        populate: {
                            path: "user",
                            select: "name email"
                        }
                    })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),

                Transaction.countDocuments(filter)
            ]);

        const totalPages =
            Math.ceil(totalTransactions / limit);

        return res.status(200).json({
            success: true,
            data: transactions,
            pagination: {
                currentPage: page,
                limit,
                totalTransactions,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        });

    } catch (error) {
        console.error(
            "Error fetching transaction history:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Internal server error while fetching transaction history"
        });
    }
};

export default { 
    createTransaction, 
    createInitialFundsTransaction, 
    getTransactionHistory 
};