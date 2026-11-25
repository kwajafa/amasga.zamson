# Amasga–Zamson Transport Collaboration Scheme App

A mobile-friendly web app for recording and reporting trips under the Amasga International Ltd – Zamson transport collaboration scheme: cement loadings, deliveries, payments and offloading status.

## Features

- **Trip records** – enter, edit and search trips (truck, fleet, driver, bags, destination, price, amount paid, banks, ATC numbers, customer). Filter by month, day of month, payment status, offloading status and fleet.
- **Pending offloading** – trips loaded but not yet confirmed offloaded, grouped by status, with trips waiting 3+ days flagged. Admins and Entry officers can mark trips offloaded in bulk with the offload date.
- **Reports** – monthly and yearly performance: trip value, amount paid, outstanding balance, trips loaded per day, share of trips by fleet and by load size (pie charts), breakdowns by fleet, state, location and truck, and who owes.
- **Downloads** – report as PDF (with logos) or CSV; period or full records as CSV.
- **Excel import** – bring in workbooks laid out like the original collaboration record; duplicates are skipped.
- **User accounts** – username/email + password logins (PBKDF2-SHA-256 salted hashes), created and managed by the Admin.
- **Roles**
  - **Admin** – everything, including user accounts and role rights.
  - **Entry officer** – enters trips, updates offloading status, sees all records including customer details.
  - **Member** – views transactions; customer name and phone always hidden. Other rights (amounts, bank details, driver phones, ATC numbers, reports, downloads) are set by the Admin.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app: markup, styles and script in one file |
| `logo-combo.png` | Combined Amasga + Zamson logo (side by side) for login, wide sidebar and reports |
| `logo-stack.png` | Combined logo stacked, for the narrow phone menu |

## Hosting and runtime

The app is built to run as a **Claude artifact**. It relies on the artifact runtime (`window.claude.use(...)`) for:

- `db` – shared document storage for `records`, `cust` (customer details), `users` and `settings`
- `user` – whether the viewer is the owner / has Editor access
- `downloads` – saving PDF and CSV files

Opened outside Claude (for example from GitHub Pages or as a local file) the page loads but shows the sign-in message, because there is no database. Hosting it standalone would need a backend (for example Firebase or Supabase) swapped in behind the same `db` calls.

### Database access rules (declared on the artifact)

| Path | Read | Write |
|---|---|---|
| `records` | view | admin |
| `cust` | admin | admin |
| `users` | view | admin |
| `settings` | view | admin |

Customer names and phone numbers live in `cust`, readable only through Claude accounts shared at **Editor** level (Admins and Entry officers).

## Data

Trip data is not stored in this repository. It lives in the app's database and is brought in through **Settings → Data → Import from Excel**.
