/**
 * Parse a STUDENTS string into an array of credentials.
 * Supports JSON array of objects or CSV/semicolon `email:password[:notifyEmail]` fragments.
 */
export function parseStudents(rawIn?: string) {
    const students: { email: string; password: string; notifyEmail?: string }[] = [];
    if (!rawIn) return students;

    const looksLikeEmail = (s?: string) => !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

    let raw = rawIn.trim();
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        raw = raw.slice(1, -1);
    }

    if (raw.startsWith('[') || raw.startsWith('{')) {
        const tryParse = (str: string) => {
            try {
                const parsed = JSON.parse(str);
                if (Array.isArray(parsed)) {
                    for (const item of parsed) {
                        const email = item && item.email ? String(item.email).trim() : undefined;
                        const password = item && item.password ? String(item.password).trim() : undefined;
                        const notifyEmail = item && item.notifyEmail ? String(item.notifyEmail).trim() : undefined;
                        if (email && password && looksLikeEmail(email)) {
                            students.push({ email, password, notifyEmail });
                        }
                    }
                }
                return true;
            } catch {
                return false;
            }
        };

        if (!tryParse(raw)) {
            // Try a relaxed parse replacing single quotes
            tryParse(raw.replace(/'/g, '"'));
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
                }
            }
        }
    }

    return students;
}
