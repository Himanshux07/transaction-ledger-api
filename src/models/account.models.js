import mongoose from "mongoose";
import Ledger from "./ledger.models.js";

const accountSchema = new mongoose.Schema({
    user:{
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required:[true, "Account must be associated with an user"],
        index: true
    },
    status:{
        type: String,
        enum:{
            values:["active","frozen", "closed"],   
            message: "Status is required and can only be active, frozen, closed"
        },
        default: "active"
    },
    currency:{
        type: String,
        required: true,
        default: "INR"
    },
},
{
    timestamps: true
})

accountSchema.index({user:1,status:1})

accountSchema.methods.getBalance = async function (){
    const balanceData = await Ledger.aggregate([
        {
            $match:{
                account: this._id,
            }
        },
        {
            $group:{
                _id:null,
                totalDebit:{
                    $sum:{
                        $cond:[
                            {$eq:["$type","debit"]},
                            "$amount",
                            0
                        ]
                    }
                },
                totalCredit:{
                    $sum:{
                        $cond:[
                            {$eq:["$type","credit"]},
                            "$amount",
                            0
                        ]
                    }
                }   
            }
        },
        {
            $project:{
                _id: 0,
                balance : {$subtract:["$totalCredit","$totalDebit"]}
            }
        }
    ])

    if(balanceData.length === 0){
        return 0;
    }
    
    return Number(balanceData[0].balance);
}

const Account = mongoose.model("Account", accountSchema)

export default Account
