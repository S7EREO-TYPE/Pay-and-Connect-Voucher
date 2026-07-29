# Pay and Connect Plus Plus

## About

This app automatically requests lunch vouchers from the UCT (University of Cape Town) campus food system. Instead of manually requesting your voucher every day between 9 PM and 9 AM on weekdays, this tool does it for you automatically.

## How It Works

The application connects to the Pay and Connect system on a schedule and requests your daily voucher. It sends an email notification to let you know if the request was successful or if something went wrong. The automation runs on weekday mornings using GitHub Actions.

## Setup

### Prerequisites
- A GitHub account
- A UCT Pay and Connect account
- A Gmail account (for sending notifications)

### Installation

1. Fork this repository to your GitHub account

2. Clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/Pay-and-Connect-Plus-Plus.git
cd Pay-and-Connect-Plus-Plus
```

3. Install dependencies:
```bash
npm install
```

4. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

5. Update the `.env` file with your credentials (for local testing)

### Environment Variables

- `STUDENT_EMAIL`: Your UCT account email
- `STUDENT_PASSWORD`: Your UCT account password
- `NOTIFICATION_EMAIL`: The email address to receive notifications
- `NOTIFICATION_EMAIL_PASSWORD`: Your Gmail app password (not your normal password - see below)
- `GOOGLE_API_KEY`: Your Google API key for authentication

### Multiple Students

To add multiple student accounts so the app requests vouchers for each, set the `STUDENTS` environment variable. Supported formats:

- JSON array (recommended):

```env
STUDENTS=[{"email":"student1@myuct.ac.za","password":"pass1"},{"email":"student2@myuct.ac.za","password":"pass2"}]
```

- CSV or semicolon list of `email:password` pairs:

```env
STUDENTS=student1@myuct.ac.za:pass1,student2@myuct.ac.za:pass2
```

Notes:
- When running locally, place the `STUDENTS` line in your `.env` file. The app will prefer `STUDENTS` over `STUDENT_EMAIL`/`STUDENT_PASSWORD` if present.
- For GitHub Actions, add a repository secret named `STUDENTS` with the JSON string (or CSV) as the secret value. Then reference it in your workflow as you would the other secrets.
- If you only have one student, you can continue using `STUDENT_EMAIL` and `STUDENT_PASSWORD`.

Per-student notification email

You can optionally provide a separate notification email for each student. Supported formats:

- JSON (recommended): include `notifyEmail` in each entry:

```env
STUDENTS=[{"email":"student1@myuct.ac.za","password":"pass1","notifyEmail":"notify1@example.com"},{"email":"student2@myuct.ac.za","password":"pass2"}]
```

- CSV: use `email:password:notifyEmail` pairs (notifyEmail optional):

```env
STUDENTS=student1@myuct.ac.za:pass1:notify1@example.com,student2@myuct.ac.za:pass2
```

When `notifyEmail` is provided, the app sends the individual success/failure email to that address (not to the student's UCT email). The admin summary is still sent to `NOTIFICATION_EMAIL`.

Each student will also receive an email notification when their voucher request is processed (success or failure). The app sends the email from the `NOTIFICATION_EMAIL` address, and the admin `NOTIFICATION_EMAIL` also receives a copy.

### Getting Gmail App Password

1. Enable 2-factor authentication on your Google account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Select "Mail" and "Windows Computer"
4. Use the generated 16-character password as `NOTIFICATION_EMAIL_PASSWORD`

### GitHub Setup

1. Go to your repository Settings > Secrets and Variables > Actions
2. Add the following secrets:
   - `STUDENT_EMAIL`
   - `STUDENT_PASSWORD`
   - `NOTIFICATION_EMAIL`
   - `NOTIFICATION_EMAIL_PASSWORD`
   - `GOOGLE_API_KEY`

## Cron Schedule

The application runs automatically on weekdays at **7:01 PM SAST** (South African Standard Time), which is 9:01 PM UTC.

The cron schedule `01 19 * * 0-4` means:
- **01**: At minute 1
- **19**: At hour 19 (7 PM UTC)
- **\***: Every day of the month
- **\***: Every month
- **0-4**: Monday through Friday (0=Sunday, 4=Friday)

To modify the schedule, edit `.github/workflows/requestVoucher.yml` and change the cron expression.

## Local Testing

Run locally with:
```bash
npm start
```

Or with auto-reload on file changes:
```bash
npm run dev
```

Build TypeScript:
```bash
npm run build
```

## Troubleshooting

### "Login failed" error
- Verify your `STUDENT_EMAIL` and `STUDENT_PASSWORD` are correct
- Check that your UCT account isn't locked
- Make sure you're using the correct credentials (not your student number)

### "Failed to send email" error
- Ensure you're using an app-specific password, not your regular Google password
- Verify 2-factor authentication is enabled on your Google account
- Check that the `NOTIFICATION_EMAIL` is a Gmail address

### "Voucher request failed" error
- The API might be temporarily unavailable
- Check that you're within the valid request window (9 PM - 9 AM weekdays)
- Verify your account has vouchers available

### Workflow not running
- Check that GitHub Actions is enabled in your repository settings
- Verify the secrets are set correctly in your repository
- Check the Actions tab for workflow run history and logs

## Support

For issues or questions, check the GitHub Actions logs in your repository or contact your UCT support team.
