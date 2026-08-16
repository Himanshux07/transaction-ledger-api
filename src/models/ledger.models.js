import mongoose from "mongoose";

const ledgerSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        required: [true, "Ledger must belong to an account"],
        index: true,
        immutable: true
    },
    amount: {
        type: Number,
        required: [true, "Ledger must have an amount"],
        min: [0, "Amount cannot be negative"],
        immutable: true
    },
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
        required: [true, "Ledger must belong to a transaction"],
        immutable: true
    },
    type: {
        type: String,
        enum: {
            values: ["debit", "credit"],
            message: "Type is required and can only be debit or credit"
        },
        required: [true, "Ledger must have a type"],
        immutable: true
    },
    balance: {
        type: Number,
        required: [true, "Ledger must have a balance after transaction"],
        immutable: true
    }
}, { timestamps: true });

const preventLedgerModification = () => {
    throw new Error("Ledger entries are immutable and cannot be modified or deleted.");
};

ledgerSchema.pre("updateOne", preventLedgerModification);
ledgerSchema.pre("updateMany", preventLedgerModification);
ledgerSchema.pre("findOneAndUpdate", preventLedgerModification);
ledgerSchema.pre("findByIdAndUpdate", preventLedgerModification);
ledgerSchema.pre("remove", preventLedgerModification);
ledgerSchema.pre("deleteOne", preventLedgerModification);
ledgerSchema.pre("deleteMany", preventLedgerModification);
ledgerSchema.pre("findOneAndDelete", preventLedgerModification);
ledgerSchema.pre("findOneAndReplace", preventLedgerModification);

const Ledger = mongoose.model("Ledger", ledgerSchema);

export default Ledger;