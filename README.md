# Amasga–Zamson Transport Collaboration Scheme App

A mobile-friendly web app for recording and reporting trips under the Amasga International Ltd – Zamson transport collaboration scheme: cement loadings, deliveries, payments and offloading status.

It runs on **Vercel** (pages + two small server functions) with **Firebase** (free Spark plan) for the database and logins.

## Features

- **Trip records** – enter, edit and search trips. Filter by month, day of month, payment status, offloading status and fleet.
- **Pending offloading** – trips not yet offloaded, grouped by status, with 3+ day waits flagged. Admins and Entry officers mark trips offloaded with the date.
- **Reports** – monthly/yearly KPIs, trips loaded per day, share of trips by fleet and by load size, breakdowns, who owes. Download as PDF (with logos) or CSV.
- **Excel/CSV import** and full CSV export.
- **Accounts** – username or email + password logins (Firebase Authentication). The Admin creates accounts, sets roles, resets passwords and deactivates users.
- **Roles**, enforced by the database rules, not just the screen:
  - **Admin** – everything, including accounts and role rights.
  - **Entry officer** – enters trips, updates offloading status, sees customer details.
  - **Member** – views transactions; never receives customer name/phone. Other rights are set by the Admin.

## Files

| File | Purpose |
|---|---|
| `index.html` | The app (markup, styles, script) |
| `logo-combo.png`, `logo-stack.png` | Combined Amasga + Zamson logos |
| `api/config.js` | Serves the Firebase web config from a Vercel environment variable |
| `api/admin.js` | Secure account management (create, update, reset password, deactivate, delete) using the Firebase Admin SDK |
| `firestore.rules` | Database security rules — paste into Firebase |
| `package.json` | Declares `firebase-admin` for the Vercel functions |

## One-time setup (about 10 minutes)

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> → **Add project** (e.g. `amasga-zamson`). Google Analytics is not needed.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
3. **Build → Firestore Database → Create database** → choose a location (e.g. `europe-west`), **production mode**.
4. In Firestore, open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.

### 2. Get the two keys
1. **Web config:** Project settings (gear icon) → **General** → *Your apps* → click the **Web** icon `</>` → register an app (no hosting). Copy the `firebaseConfig` object and turn it into JSON (keys in double quotes), e.g.
   ```json
   {"apiKey":"AIza...","authDomain":"amasga-zamson.firebaseapp.com","projectId":"amasga-zamson","storageBucket":"amasga-zamson.appspot.com","messagingSenderId":"123...","appId":"1:123...:web:abc..."}
   ```
2. **Service account:** Project settings → **Service accounts** → **Generate new private key** → download the JSON file. Keep it private; never commit it.

### 3. Add them to Vercel
Vercel project → **Settings → Environment Variables**, add for *Production* (and *Preview* if you use it):

| Name | Value |
|---|---|
| `FIREBASE_WEB_CONFIG` | the web config JSON from step 2.1 |
| `FIREBASE_SERVICE_ACCOUNT` | the entire contents of the downloaded service-account JSON file |

Then **Deployments → ⋯ → Redeploy**.

### 4. Allow your domain
Firebase → Authentication → **Settings → Authorized domains** → add your Vercel domain (e.g. `amasga-zamson.vercel.app`). This is needed for password-reset emails.

### 5. First login
Open the Vercel URL. With no accounts yet, it shows **Set up the Admin account**. Create it, then add everyone else under **Settings → User accounts**.

## Moving the existing records over

1. In the Claude version of the app, log in as Admin → **Settings → Data → Download all records (CSV)**. This includes customer names/phones, status and offload dates.
2. In the new app, log in as Admin → **Settings → Data → Import from Excel** → choose that CSV. Duplicates are skipped, so it is safe to run twice.

User accounts are not copied; recreate them in the new app.

## Notes

- **Costs:** the Firebase Spark plan is free (50,000 database reads and 20,000 writes per day). Each login loads every trip once and then only receives changes, which is comfortable for a small team; a busy team with many thousands of trips may eventually need the pay-as-you-go plan.
- **Forgot password:** accounts with a real email can use *Forgot your password?* on the login page. Username-only accounts ask the Admin to set a new password.
- **Offline:** changes made while offline are sent automatically when the connection returns.
- Trip data never lives in this repository; `.gitignore` blocks Excel/CSV files.
