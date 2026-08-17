import mongoose from "mongoose";

const tokenBlackListSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
    }
},{timestamps: true});

tokenBlackListSchema.index({createdAt: 1});

const tokenBlackList = mongoose.model("tokenBlackList", tokenBlackListSchema);
export default tokenBlackList;