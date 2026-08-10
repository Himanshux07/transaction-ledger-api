import mongoose from "mongoose";

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
            values:["active","frozen", "closed", "inactive"],   
            message: "Status is required and can only be active, frozen, closed or inactive"
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
const Account = mongoose.model("Account", accountSchema)

export default Account
