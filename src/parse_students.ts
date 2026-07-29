import dotenv from "dotenv";

dotenv.config();

const { STUDENTS } = process.env;

function looksLikeEmail(s?: string) {
    return !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function parseStudents(rawIn?: string) {
    const students: { email: string; password: string; notifyEmail?: string }[] = [];
    if (!rawIn) return students;

    let raw = rawIn.trim();
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        raw = raw.slice(1, -1);
    }

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
            }
        }
    }

    if (students.length === 0) {
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

    return students;
}

console.log('Raw STUDENTS value from .env:', STUDENTS ? STUDENTS.slice(0, 400) : '(empty)');
const parsed = parseStudents(STUDENTS);
console.log('Parsed students:', parsed);
if (parsed.length === 0) console.error('No valid students parsed. Provide valid JSON or CSV in STUDENTS.');

process.exit(0);
