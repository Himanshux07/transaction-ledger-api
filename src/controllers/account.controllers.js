import Account from "../models/account.models.js";

const createAccount = async (req, res) => {
    try {
        const user = req.user;

        const account = await Account.create({
            user: user._id
        });

        return res.status(201).json({
            success: true,
            message: "Account created successfully",
            data: account
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

        return res.status(200).json({
            success: true,
            message: "Accounts fetched successfully",
            data: accounts
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

const getAccountBalance = async (req, res) =>{
    try {
        const {accountId} = req.params;
        if(!accountId){
            return res.status(404).json({
                success: false,
                message: "Account id is required"
            });
        }

        const account = await Account.findOne({
            _id: accountId,
            user: req.user._id
        });

        if(!account){
            return res.status(404).json({
                success: false,
                message: "Account not found"
            });
        }
        const balance = await account.getAccountBalance();


        return res.status(200).json({
            success: true,
            message: "Account balance fetched successfully",
            data: balance
        });
    } 
    catch (error) {
        console.error("Error fetching account balance:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error fetching account balance"
        });
    }
}

export default {
    createAccount,
    getAccount,
    getAccountBalance
};


