import axios from "axios";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const LOGIN_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDEFW8cGJ0USejK104PmJkQVc5StxuOfHA";
const VOUCHER_URL = "https://uct.api.getslideapp.com/2/connect/vouchers/issue/";
const STUDENT_EMAIL = process.env.STUDENT_EMAIL;
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL;
const NOTIFICATION_EMAIL_PASSWORD = process.env.NOTIFICATION_EMAIL_PASSWORD;

interface LoginResponse {
    idToken: string;
    [key: string]: any;
}

const emailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: NOTIFICATION_EMAIL,
        pass: NOTIFICATION_EMAIL_PASSWORD,
    },
});

async function sendEmail(subject: string, message: string, isSuccess: boolean) {
    try {
        const htmlContent = `
            <h2 style="color: ${isSuccess ? "green" : "red"};">Voucher Request ${isSuccess ? "Successful" : "Failed"}</h2>
            <p><strong>Time:</strong> ${new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p>
            <p><strong>Status:</strong> ${isSuccess ? " Success" : " Failed"}</p>
            <hr />
            <p>${message}</p>
        `;

        await emailTransporter.sendMail({
            from: NOTIFICATION_EMAIL,
            to: NOTIFICATION_EMAIL,
            subject: subject,
            html: htmlContent,
        });

        console.log("Email notification sent.");
    } catch (error) {
        console.error("Failed to send email:", error instanceof Error ? error.message : error);
    }
}

async function login(): Promise<string> {
    try {
        console.log("Logging in to Pay and Connect...");
        const { data } = await axios.post<LoginResponse>(
            LOGIN_URL,
            {
                returnSecureToken: true,
                email: STUDENT_EMAIL,
                password: STUDENT_PASSWORD,
                clientType: "CLIENT_TYPE_WEB"
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
        
        const token = data.idToken;
        console.log("Login successful. Token obtained.");
        return token;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("Login failed:", error.response?.data);
            throw new Error(`Login failed: ${error.response?.status}`);
        } else {
            console.error("Unexpected error during login:", error);
            throw error;
        }
    }
}

async function requestVoucher(token: string) {
    try {
        console.log("Requesting voucher...");
        const { data } = await axios.post(
            VOUCHER_URL,
            {},
            {
                headers: {
                    "Content-Type": "application/json",
                    Origin: "https://app.payandconnect.co.za",
                    Referer: "https://app.payandconnect.co.za/u/vouchers",
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        console.log("✓ Voucher requested successfully!");
        console.log("Response:", data);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("Voucher request failed:", error.response?.data);
            throw new Error(`Voucher request failed: ${error.response?.status}`);
        } else {
            console.error("Unexpected error:", error);
            throw error;
        }
    }
}

async function main() {
    try {
        if (!STUDENT_EMAIL || !STUDENT_PASSWORD) {
            throw new Error("STUDENT_EMAIL and STUDENT_PASSWORD environment variables are required");
        }
        
        const token = await login();
        await requestVoucher(token);
        console.log("Process completed successfully.");
        
        if (NOTIFICATION_EMAIL && NOTIFICATION_EMAIL_PASSWORD) {
            await sendEmail(
                "UCT Lunch Voucher Requested Successfully",
                "Your lunch voucher has been successfully requested for today.",
                true
            );
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Fatal error:", errorMessage);
        
        if (NOTIFICATION_EMAIL && NOTIFICATION_EMAIL_PASSWORD) {
            await sendEmail(
                "✗ UCT Lunch Voucher Request Failed",
                `Error: ${errorMessage}`,
                false
            );
        }
        
        process.exit(1);
    }
}

main();
