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
    STUDENTS,
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

async function sendEmail(
    subject: string,
    message: string,
    isSuccess: boolean,
    recipients?: string | string[],
    includeAdmin = false
) {
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

        const toSet = new Set<string>();
        if (recipients) {
            if (Array.isArray(recipients)) {
                for (const r of recipients) if (r) toSet.add(r);
            } else if (typeof recipients === "string") {
                toSet.add(recipients);
            }
        }

        if (includeAdmin && NOTIFICATION_EMAIL) {
            toSet.add(NOTIFICATION_EMAIL);
        }

        const toList = Array.from(toSet);
        if (toList.length === 0) {
            // Nothing to send to
            return;
        }

        await emailTransporter.sendMail({
            from: NOTIFICATION_EMAIL,
            to: toList.join(","),
            subject,
            html,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to send email notification: ${errorMessage}`);
    }
}

async function login(email: string, password: string): Promise<string> {
    try {
        const { data } = await axios.post<LoginResponse>(
            LOGIN_URL,
            {
                returnSecureToken: true,
                email,
                password,
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
            throw new Error(`Login failed for ${email} (${status}): ${message}`);
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
    // Build list of student credentials. Support three formats:
    // 1) `STUDENTS` as JSON string: [{"email":"...","password":"..."}, ...]
    // 2) `STUDENTS` as CSV/semicolon list: "e1:pass1,e2:pass2"
    // 3) Fallback to single `STUDENT_EMAIL` + `STUDENT_PASSWORD`
    const students: { email: string; password: string; notifyEmail?: string }[] = [];

    if (STUDENTS) {
        // Normalize: strip surrounding single/double quotes that may be added by env files or secrets
        let raw = STUDENTS.trim();
        if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
            raw = raw.slice(1, -1);
        }

        // Helper: simple email validation
        const looksLikeEmail = (s?: string) => !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

        // Try JSON first when it looks like JSON
        if (raw.startsWith('[') || raw.startsWith('{')) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    for (const item of parsed) {
                        const email = item && item.email ? String(item.email).trim() : undefined;
                        const password = item && item.password ? String(item.password).trim() : undefined;
                        const notifyEmail = item && item.notifyEmail ? String(item.notifyEmail).trim() : undefined;
                        if (email && password && looksLikeEmail(email)) {
                            students.push({ email, password, notifyEmail });
                        } else {
                            console.warn('Skipping invalid student entry from STUDENTS JSON:', item);
                        }
                    }
                }
            } catch (err) {
                // Try a relaxed parse: replace single quotes with double quotes and retry
                try {
                    const relaxed = raw.replace(/'/g, '"');
                    const parsed = JSON.parse(relaxed);
                    if (Array.isArray(parsed)) {
                        for (const item of parsed) {
                            const email = item && item.email ? String(item.email).trim() : undefined;
                            const password = item && item.password ? String(item.password).trim() : undefined;
                            const notifyEmail = item && item.notifyEmail ? String(item.notifyEmail).trim() : undefined;
                            if (email && password && looksLikeEmail(email)) {
                                students.push({ email, password, notifyEmail });
                            } else {
                                console.warn('Skipping invalid student entry from relaxed STUDENTS JSON:', item);
                            }
                        }
                    }
                } catch (err2) {
                    console.warn('STUDENTS appears to be JSON but failed to parse; falling back to CSV parsing.');
                    // fall through to CSV parsing below using raw
                    const pairs = raw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
                    for (const p of pairs) {
                        const parts = p.split(":");
                        if (parts.length >= 2) {
                            const emailPart = parts[0].trim();
                            const passwordPart = parts[1].trim();
                            const notifyPart = parts.length >= 3 ? parts.slice(2).join(":").trim() : undefined;
                            if (looksLikeEmail(emailPart)) {
                                students.push({ email: emailPart, password: passwordPart, notifyEmail: notifyPart });
                            } else {
                                console.warn('Skipping malformed STUDENTS fragment:', p);
                            }
                        }
                    }
                }
            }
        } else {
            // CSV/semicolon list of email:password[:notifyEmail]
            const pairs = raw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
            for (const p of pairs) {
                const parts = p.split(":");
                if (parts.length >= 2) {
                    const emailPart = parts[0].trim();
                    const passwordPart = parts[1].trim();
                    const notifyPart = parts.length >= 3 ? parts.slice(2).join(":").trim() : undefined;
                    if (looksLikeEmail(emailPart)) {
                        students.push({ email: emailPart, password: passwordPart, notifyEmail: notifyPart });
                    } else {
                        console.warn('Skipping malformed STUDENTS fragment:', p);
                    }
                }
            }
        }
    }

    if (students.length === 0 && STUDENT_EMAIL && STUDENT_PASSWORD) {
        students.push({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD });
    }

    if (students.length === 0) {
        throw new Error("Missing student credentials. Provide STUDENTS or STUDENT_EMAIL/STUDENT_PASSWORD in .env");
    }

    const results: { email: string; success: boolean; message?: string }[] = [];

    for (const s of students) {
        try {
            const token = await login(s.email, s.password);
            await requestVoucher(token);
            console.log(`Voucher requested successfully for ${s.email}`);
            results.push({ email: s.email, success: true });

            // Notify the student (and admin)
            try {
                const recipient = s.notifyEmail || s.email;
                if (recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
                    await sendEmail(
                        "UCT Lunch Voucher Requested Successfully",
                        `Your lunch voucher has been successfully requested for today.`,
                        true,
                        recipient,
                        false
                    );
                } else {
                    console.warn(`Skipping notification for ${s.email}: invalid recipient ${String(recipient)}`);
                }
            } catch (notifyErr) {
                console.error(`Failed to notify ${s.email}:`, notifyErr instanceof Error ? notifyErr.message : String(notifyErr));
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Error for ${s.email}:`, message);
            results.push({ email: s.email, success: false, message });
            // Notify the student about the failure (and admin)
            try {
                const recipient = s.notifyEmail || s.email;
                if (recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
                    await sendEmail(
                        "UCT Lunch Voucher Request Failed",
                        `Error requesting voucher for ${s.email}: ${message}`,
                        false,
                        recipient,
                        false
                    );
                } else {
                    console.warn(`Skipping failure notification for ${s.email}: invalid recipient ${String(recipient)}`);
                }
            } catch (notifyErr) {
                console.error(`Failed to notify ${s.email} about failure:`, notifyErr instanceof Error ? notifyErr.message : String(notifyErr));
            }
        }
    }

    // Build summary message
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;
    let summary = `<p>Processed ${results.length} user(s): ${successCount} succeeded, ${failCount} failed.</p>`;
    summary += "<ul>";
    for (const r of results) {
        summary += `<li>${r.email}: ${r.success ? "Success" : `Failed — ${r.message || "Unknown"}`}</li>`;
    }
    summary += "</ul>";

    try {
        await sendEmail("UCT Lunch Voucher Request Results", summary, failCount === 0, undefined, true);
    } catch (emailError) {
        const emailErrorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        console.error("Failed to send notification email:", emailErrorMessage);
    }
}

main();
