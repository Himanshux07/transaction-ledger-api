import mongoose from "mongoose";

const ledgerSchema = new mongoose.Schema({
    account : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Account",
        required : [true, "Ledger must belong to an account"],
        index : true,
        immutable : true
    },
    ammount : {
        type : Number,
        required : [true, "Ledger must have an amount"],
        min : [0, "Amount cannot be negative"],
        immutable : true
    },
    transaction : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Transaction",
        required : [true, "Ledger must belong to a transaction"],
        immutable : true,
    },
    type : {
        type : String,
        enum : {
            values:["deposit", "withdrawal"],
            message: "Type is required and can only be deposit or withdrawal"
        },
        required : [true, "Ledger must have a type"],
        immutable : true
    },
    balanceAfterTransaction : {
        type : Number,
        required : [true, "Ledger must have a balance after transaction"],
        immutable : true
    },
    
})

const preventLedgerModificarion = ()=>{
    throw new Error("Ledger cannot be modified")
}

ledgerSchema.pre("updateOne" , preventLedgerModificarion)
ledgerSchema.pre("updateMany" , preventLedgerModificarion)
ledgerSchema.pre("findOneAndUpdate" , preventLedgerModificarion)
ledgerSchema.pre("findByIdAndUpdate" , preventLedgerModificarion)
ledgerSchema.pre("remove" , preventLedgerModificarion)
ledgerSchema.pre("deleteOne" , preventLedgerModificarion)
ledgerSchema.pre("deleteMany" , preventLedgerModificarion)
ledgerSchema.pre("findOneAndDelete" , preventLedgerModificarion)
ledgerSchema.pre("findOneAndReplace" , preventLedgerModificarion)

const Ledger = mongoose.model("Ledger", ledgerSchema)

export default Ledger