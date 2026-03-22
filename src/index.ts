import axios, { AxiosError } from "axios";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const {
    GOOGLE_API_KEY,
    STUDENT_EMAIL,
    STUDENT_PASSWORD,
    NOTIFICATION_EMAIL,
    NOTIFICATION_EMAIL_PASSWORD,
} = process.env;

const LOGIN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${GOOGLE_API_KEY}`;
const VOUCHER_URL = "https://uct.api.getslideapp.com/2/connect/vouchers/issue/";
const REQUEST_TIMEOUT = 10000; // 10 seconds

interface LoginResponse {
    idToken: string;
    email: string;
    refreshToken: string;
    expiresIn: string;
    localId: string;
}

interface VoucherResponse {
    id: string;
    status: string;
    amount?: number;
    expiryDate?: string;
}

const emailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: NOTIFICATION_EMAIL,
        pass: NOTIFICATION_EMAIL_PASSWORD,
    },
});

async function sendEmail(subject: string, message: string, isSuccess: boolean) {
    if (!NOTIFICATION_EMAIL || !NOTIFICATION_EMAIL_PASSWORD) {
        return;
    }

    try {
        const status = isSuccess ? "Successful" : "Failed";
        const color = isSuccess ? "green" : "red";
        const html = `
            <h2 style="color: ${color};">Voucher Request ${status}</h2>
            <p><strong>Time:</strong> ${new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p>
            <p>${message}</p>
        `;

        await emailTransporter.sendMail({
            from: NOTIFICATION_EMAIL,
            to: NOTIFICATION_EMAIL,
            subject,
            html,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to send email notification: ${errorMessage}`);
    }
}

async function login(): Promise<string> {
    try {
        const { data } = await axios.post<LoginResponse>(
            LOGIN_URL,
            {
                returnSecureToken: true,
                email: STUDENT_EMAIL,
                password: STUDENT_PASSWORD,
                clientType: "CLIENT_TYPE_WEB",
            },
            { timeout: REQUEST_TIMEOUT }
        );

        return data.idToken;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const errorData = error.response?.data as any;
            const message = errorData?.error?.message || "Authentication failed";
            throw new Error(`Login failed (${status}): ${message}`);
        }
        throw error;
    }
}

async function requestVoucher(token: string): Promise<void> {
    try {
        await axios.post<VoucherResponse>(
            VOUCHER_URL,
            {},
            {
                headers: {
                    "Content-Type": "application/json",
                    Origin: "https://app.payandconnect.co.za",
                    Referer: "https://app.payandconnect.co.za/u/vouchers",
                    Authorization: `Bearer ${token}`,
                },
                timeout: REQUEST_TIMEOUT,
            }
        );
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const errorData = error.response?.data as any;
            const message = errorData?.error || errorData?.message || "Request failed";
            throw new Error(`Voucher request failed (${status}): ${message}`);
        }
        throw error;
    }
}

async function main() {
    if (!STUDENT_EMAIL || !STUDENT_PASSWORD) {
        throw new Error("Missing required environment variables: STUDENT_EMAIL and STUDENT_PASSWORD");
    }

    try {
        const token = await login();
        await requestVoucher(token);
        console.log("Voucher requested successfully");

        await sendEmail(
            "UCT Lunch Voucher Requested Successfully",
            "Your lunch voucher has been successfully requested for today.",
            true
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error:", message);

        try {
            await sendEmail(
                "UCT Lunch Voucher Request Failed",
                `Error: ${message}`,
                false
            );
        } catch (emailError) {
            const emailErrorMessage = emailError instanceof Error ? emailError.message : String(emailError);
            console.error("Failed to send error notification:", emailErrorMessage);
        }

        process.exit(1);
    }
}

main();
