import Account from "../models/account.models.js";

const createAccount = async (req, res) => {
    const user = req.user;

    const account = await Account.create({
        user: user._id
    });

    res.status(201).json({
        account
    });
};

const getAccount = async (req, res) => {
    const user = req.user;

    const accounts = await Account.find({ user: user._id });

    res.status(200).json({
        accounts
    });
};

export default {
    createAccount,
    getAccount
};
