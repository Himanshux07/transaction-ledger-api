import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
    },
});

// Verify the connection configuration
transporter.verify((error, success) => {
    if (error) {
        console.error("Error connecting to email server:", error);
    } else {
        console.log("Email server is ready to send messages");
    }
});

// Function to send email
const sendEmail = async (to, subject, text, html) => {
    try {
        const info = await transporter.sendMail({
        from: `"Your Name" <${process.env.EMAIL_USER}>`, // sender address
        to, // list of receivers
        subject, // Subject line
        text, // plain text body
        html, // html body
        });

        console.log("Message sent: %s", info.messageId);
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    } 
    catch (error) {
        console.error("Error sending email:", error);
    }
};

async function sendRegistrationEmail(userEmail, name) {
    try {
        const subject = "Welcome to Transaction Ledger";
        const text = `Hello ${name},\n\nWelcome to Transaction Ledger!\n\nThank you for registering.`;
        const html = `<h1>Hello ${name},</h1><p>Welcome to Transaction Ledger!</p><p>Thank you for registering.</p>`;

        await sendEmail(userEmail, subject, text, html);
    } 
    catch (error) {
        console.error("Error sending registration email:", error);
    }
}

async function sendTransactionEmail(userEmail, name, transactionId) {
    try {
        const subject = "Transaction successful";
        const text = `Hello ${name},\n\nYour transaction ${transactionId} was successful.`;
        const html = `<h1>Hello ${name},</h1><p>Your transaction ${transactionId} was successful.</p>`;

        await sendEmail(userEmail, subject, text, html);
    } 
    catch (error) {
        console.error("Error sending transaction email:", error);
    }
}

async function sendTransactionFailedEmail(userEmail, name, transactionId) {
    try {
        const subject = "Transaction failed";
        const text = `Hello ${name},\n\nYour transaction ${transactionId} failed.`;
        const html = `<h1>Hello ${name},</h1><p>Your transaction ${transactionId} failed.</p>`;

        await sendEmail(userEmail, subject, text, html);
    } 
    catch (error) {
        console.error("Error sending transaction failed email:", error);
    }
}

async function sendTransactionReversedEmail(userEmail, name, transactionId) {
    try {
        const subject = "Transaction reversed";
        const text = `Hello ${name},\n\nYour transaction ${transactionId} was reversed.`;
        const html = `<h1>Hello ${name},</h1><p>Your transaction ${transactionId} was reversed.</p>`;

        await sendEmail(userEmail, subject, text, html);
    } 
    catch (error) {
        console.error("Error sending transaction reversed email:", error);
    }
}

export { sendEmail, sendRegistrationEmail, sendTransactionEmail, sendTransactionFailedEmail, sendTransactionReversedEmail };
export default { sendEmail, sendRegistrationEmail, sendTransactionEmail, sendTransactionFailedEmail, sendTransactionReversedEmail };


