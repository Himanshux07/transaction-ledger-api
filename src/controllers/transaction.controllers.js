import Transaction from "../models/transaction.models.js";
import Account from "../models/account.models.js";
import Ledger from "../models/ledger.models.js";
import mongoose from "mongoose";

const createTransaction = async(req,res)=>{
    try {

        /*
            1.Validate request
        */
        const {fromAccount, toAccount, amount,idempotencyKey} = req.body;

        if(!fromAccount || !toAccount || !amount || !idempotencyKey){
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            })
        }

        //check if the from and to accounts are valid
        const fromUserAccount = await Account.findOne({_id: fromAccount})
        const toUserAccount = await Account.findOne({_id: toAccount})

        if(!fromUserAccount || !toUserAccount){
            return res.status(404).json({
                success: false,
                message: "Invalid account"
            })
        }
        
        /*
            2.Validate idempotencyKey
        */

        const existTransaction = await Transaction.findOne({idempotencyKey : idempotencyKey})
        if(existTransaction){

            if(existTransaction.status == "success"){
                return res.status(409).json({
                    message: "Transaction already processed successfully",
                    transaction : existTransaction
                })
            }
            if(existTransaction.status == "pending"){
                return res.status(200).json({
                    message: "Transaction is still processing"
                })
            }
            if(existTransaction.status == "failed"){
                return res.status(500).json({
                    message: "Transaction has failed"
                })
            }
            if(existTransaction.status == "reversed"){
                return res.status(409).json({
                    message: "Transaction has been reversed"
                })
            }
            
        }    
        
        /*
            3.check Account status
        */
        if(fromUserAccount.status != "active"){
            return res.status(400).json({
                success: false,
                message: "From account is not active"
            })
        }
        if(toUserAccount.status != "active"){
            return res.status(400).json({
                success: false,
                message: "To account is not active"
            })
        }
        
        /*
            4.check Account balance
        */
        
        const balance = await Account.getBalance()

        if(balance < amount){
            return res.status(400).json({
                message: `Insufficient balance, current balance is ${balance}. Request balance is ${amount}`
            })
        }
        
        /*
            5.create transaction (Pending)
        */

        const session = await mongoose.startSession()
        session.startTransaction()

        const transaction = await transactionModels.create({
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "pending",
        },{session})

        const debitLedger = await Ledger.create(
            {
                account: fromAccount,
                type: "debit",
                amount,
                balance: balance,
                transaction: transaction._id
            },{session}
        )

        const creditLedger = await Ledger.create(
            {
                account: toAccount,
                type: "credit",
                amount,
                balance: balance,
                transaction: transaction._id
            },{session}
        )
        
        transaction.status = "success"
        await transaction.save({session})

        await session.commitTransaction()
        session.endSession()

        return res.status(200).json({
            success: true,
            message: "Transaction created successfully",
            transaction
        })
    } 
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal server error while creating transaction"
        })
    }
}

export default {createTransaction}
