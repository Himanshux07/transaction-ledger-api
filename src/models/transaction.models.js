import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    fromAccount : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        required: [true , "Transaction must belong to an account"],
        index : true
    },
    toAccount : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        required: [true , "Transaction must belong to an account"],
        index : true
    },
    amount : {
        type: Number,
        required: [true , "Transaction must have an amount"],
        min : [0,"Amount cannot be negative"]
    },
    status : {
        type: String,
        enum: {
            values:["pending", "success", "failed","reversed"], 
            message: "Status is required and can only be pending, success or failed"
        },
        default: "pending"
    },
    idempotencyKey : {
        type: String,
        required: [true , "Transaction must have an idempotency key"],
        unique: true,
        index: true
    }
},{
    timestamps: true
})

transactionSchema.index({fromAccount:1, toAccount:1, status:1})

const Transaction = mongoose.model("Transaction", transactionSchema)

export default Transaction