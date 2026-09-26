# StockSense

An Inventory Management System that replaces manual registers and Excel sheets
with a centralized, real-time stock tracking app — built around a
**cryptographically tamper-evident stock ledger**, so every stock movement is
provably auditable, not just logged.

Built for a hackathon with a hard constraint: **minimal third-party API
dependency**. Everything here is self-hosted — MySQL, Node/Express, and plain
HTML/CSS/JS on the frontend, with no paid SaaS integrations required to run
the core product.

---

## Table of Contents
- [What makes this different](#what-makes-this-different)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Setup](#setup)
- [Gmail SMTP setup (OTP emails)](#gmail-smtp-setup-otp-emails)
- [Running the app](#running-the-app)
- [First-time walkthrough](#first-time-walkthrough)
- [The tamper-detection demo](#the-tamper-detection-demo)
- [API reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Team task split](#team-task-split)

---

## What makes this different

1. **Tamper-evident ledger.** Every stock movement (receipt, delivery,
   transfer, adjustment) is written to a hash-chained ledger — each entry's
   hash depends on the previous entry's hash, the same principle behind
   blockchain integrity, implemented natively in MySQL with zero external
   chain or API. A one-click **Verify Ledger Integrity** button recomputes
   the entire chain and flags the exact entry if anything was edited after
   the fact — something a normal Excel sheet or plain database table can
   never detect.
2. **Rule-based anomaly detection.** Adjustments are automatically flagged
   for unusually large swings, off-hours activity, or repeated edits by the
   same user — fully explainable rules, no ML model or external API needed.
3. **Zero paid third-party dependency.** MySQL, Express, and self-hosted
   Socket.io for real-time updates. The only outbound network call is Gmail
   SMTP for OTP emails, and even that has an automatic console-log fallback
   if unconfigured, so the app never breaks in a demo.
4. **Immutability by design.** A "Done" document can never be silently
   edited — corrections happen through new adjustments, which is itself
   the audit trail.
5. **Offline-friendly barcode/QR scanning** using a local JS library
   (html5-qrcode), no network calls required.

---

## Tech stack

| Layer | Choice |
|---|---|
| Database | MySQL 8+ |
| Backend | Node.js, Express, mysql2, JWT auth, bcrypt, Socket.io |
| Email | Nodemailer via Gmail SMTP (falls back to console log if unconfigured) |
| Frontend | Plain HTML/CSS/JS — no build step, no framework, no bundler |
| Realtime | Socket.io (self-hosted) |
| Charts | Chart.js (CDN) |
| Barcode/QR scanning | html5-qrcode (CDN) |
| Fonts | IBM Plex Sans / IBM Plex Mono (Google Fonts) |

---

## Project structure

```
stocksense/
├── backend/
│   ├── config/
│   │   ├── schema.sql          # full DB schema + seed data
│   │   └── db.js               # MySQL connection pool
│   ├── middleware/
│   │   └── auth.js             # JWT verification, role guard
│   ├── routes/
│   │   ├── auth.js             # signup, login, OTP reset
│   │   ├── products.js         # products, categories, stock-per-location
│   │   ├── warehouses.js       # warehouses, locations
│   │   ├── documents.js        # receipts/delivery/internal/adjustment state machine
│   │   ├── ledger.js           # move history + verify-integrity endpoint
│   │   └── dashboard.js        # KPIs, low-stock alerts
│   ├── utils/
│   │   ├── ledger.js           # hash-chain engine (core differentiator)
│   │   ├── mailer.js           # Gmail SMTP OTP sender
│   │   └── validate.js         # shared input validation helpers
│   ├── test-email.js           # standalone Gmail SMTP test script
│   ├── server.js               # Express + Socket.io entrypoint
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── css/style.css           # design system (colors, type, components)
    ├── js/
    │   ├── api.js               # fetch wrapper, session/token handling
    │   ├── layout.js             # sidebar navigation
    │   ├── icons.js               # self-contained SVG icon set
    │   ├── dashboard.js, products.js, operations.js,
    │   │   move-history.js, settings.js
    ├── index.html, signup.html, forgot-password.html
    ├── dashboard.html, products.html, operations.html,
    │   move-history.html, settings.html, profile.html
```

---

## Setup

### 1. Clone / unzip and install
```bash
cd backend
npm install
```

### 2. Create the database
```bash
mysql -u root -p < config/schema.sql
```
This creates the `stocksense` database, all tables, and seeds:
- 2 warehouses (Main Warehouse, Warehouse 2)
- 6 locations across them (Rack A, Rack B, Production Floor, Receiving Dock, Shipping Dock)
- 3 categories (Raw Materials, Finished Goods, Packaging)

### 3. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env`:
```dotenv
PORT=4000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=stocksense
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5500

GMAIL_USER=youraddress@gmail.com
GMAIL_APP_PASSWORD=your16charapppassword
```

> **CORS_ORIGIN must exactly match your frontend's URL and port.** A
> mismatch here is the most common cause of "nothing works" — the browser
> will silently block every API call with a CORS error, visible in the
> browser console (F12).

---

## Gmail SMTP setup (OTP emails)

The forgot-password flow sends a real OTP to the user's Gmail inbox. This
needs a Gmail **App Password** — not your normal Gmail login password.

1. Go to https://myaccount.google.com/security and turn on
   **2-Step Verification** (required — App Passwords don't exist without it).
2. Go to https://myaccount.google.com/apppasswords.
3. App: **Mail**. Device: **Other** → name it `StockSense`. Click **Generate**.
4. Copy the 16-character code Google gives you (it's shown with spaces,
   e.g. `abcd efgh ijkl mnop` — remove the spaces when pasting).
5. Put it in `.env`:
   ```
   GMAIL_USER=youraddress@gmail.com
   GMAIL_APP_PASSWORD=abcdefghijklmnop
   ```
6. Test it in isolation before testing through the app:
   ```bash
   node test-email.js
   ```
   This should print `SUCCESS:` and land a test email in that same inbox
   within a few seconds. If it fails, the error message will tell you
   exactly what's wrong (bad credentials, network blocked, etc.).

If `GMAIL_USER`/`GMAIL_APP_PASSWORD` are left blank, the app automatically
falls back to printing the OTP in the backend terminal — so a demo never
breaks even if email isn't configured on the machine you're presenting from.

---

## Running the app

### Backend
```bash
cd backend
npm run dev
```
Runs at `http://localhost:4000`. Keep this terminal visible — OTP codes and
request logs print here.

### Frontend
No build step. Serve the folder statically:
```bash
cd frontend
npx serve . -l 5500
```
Open `http://localhost:5500`.

If you use a different port, update `CORS_ORIGIN` in `backend/.env` and
restart the backend.

---

## First-time walkthrough

1. **Sign up** as an Inventory Manager at `signup.html`.
2. **Settings** → confirm the seeded warehouses/locations are there.
3. **Products** → create a product, e.g. `Steel Rods`, SKU `STL-ROD-01`,
   UOM `kg`, reorder point `20`.
4. **Receipts** → create a receipt for 50 kg → Draft → Waiting → Ready →
   Validate. Check Products — stock should now show 50 kg.
5. **Dashboard** → open in a second tab, do another receipt in the first
   tab, watch the KPIs update live without refreshing (Socket.io).
6. **Delivery Orders** → ship some stock out, confirm it decreases.
7. **Internal Transfers** → move stock between locations, confirm total
   stays the same but location split changes.
8. **Inventory Adjustment** → requires a reason field; try leaving it blank
   to confirm validation blocks you. Then submit a large adjustment and
   check **Move History** for the anomaly tag.
9. **Forgot Password** → request a reset, check the configured Gmail inbox
   (or backend console if email isn't set up) for the code.

---

## The tamper-detection demo

This is the feature to lead your pitch with.

1. On the dashboard, click **Verify Ledger Integrity** → should show green,
   confirming the chain is intact.
2. Tamper with the database directly, bypassing the app entirely:
   ```bash
   mysql -u root -p stocksense -e "UPDATE stock_ledger SET qty_change = 999 WHERE id = 1;"
   ```
3. Click **Verify Ledger Integrity** again → it names the exact ledger
   entry that was altered.
4. Reset before your real demo so the data looks clean:
   ```bash
   mysql -u root -p -e "DROP DATABASE stocksense;"
   mysql -u root -p < backend/config/schema.sql
   ```
   Then redo a few receipts/deliveries/transfers so the dashboard has
   realistic-looking data.

---

## API reference

| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/signup | Create account |
| POST | /api/auth/login | Log in, returns JWT |
| POST | /api/auth/forgot-password | Request OTP via Gmail |
| POST | /api/auth/reset-password | Verify OTP, set new password |
| GET/POST | /api/products | List / create products |
| GET | /api/products/:id/stock | Stock per location |
| GET/POST | /api/products/categories/all, /api/products/categories | Categories |
| GET/POST | /api/warehouses | List / create warehouses |
| GET/POST | /api/warehouses/:id/locations | List / create locations |
| GET | /api/warehouses/locations/all | All locations (dropdowns) |
| GET/POST | /api/documents | List / create receipts, delivery, internal, adjustment |
| GET | /api/documents/:id | Document detail with line items |
| POST | /api/documents/:id/transition | Move draft -> waiting -> ready -> done/canceled |
| GET | /api/ledger | Move history (filterable by product, location, category, movement type, warehouse, date) |
| GET | /api/ledger/verify | Recompute and verify the entire hash chain |
| GET | /api/dashboard/kpis | Dashboard KPI numbers |
| GET | /api/dashboard/alerts | Low-stock / out-of-stock product list |

All routes except /api/auth/* and /api/health require
`Authorization: Bearer <token>`.

---

## Troubleshooting

**"Nothing loads / everything fails" in the frontend**
Open the browser console (F12). A CORS error means CORS_ORIGIN in
backend/.env doesn't match the port your frontend is actually served on.
Fix it and restart the backend.

**OTP email not arriving**
1. Run `node test-email.js` in backend/ — this isolates the problem from
   the rest of the app.
2. GMAIL_APP_PASSWORD must be exactly 16 characters, no spaces.
3. 2-Step Verification must be turned on for that Google account.
4. Check the spam folder — first-time sends often land there.
5. If GMAIL_USER/GMAIL_APP_PASSWORD are blank, the OTP is printed in
   the backend terminal instead — scroll up after making the request.

**"Verify Ledger Integrity" shows every entry as tampered, even with no
tampering done**
This was a real bug during development: MySQL's TIMESTAMP column has no
sub-second precision, but the hash was originally computed from a
millisecond-precision JS Date. Fixed in backend/utils/ledger.js by
truncating to whole seconds (ts.setMilliseconds(0)) before hashing. If
you see this again, drop and re-seed the database — old rows hashed before
the fix will never verify correctly.

**Backend won't start**
Run a syntax check across all route files:
```bash
cd backend
for f in server.js routes/*.js utils/*.js middleware/*.js; do node -c "$f" && echo "OK: $f"; done
```

---

## Team task split

**Backend & Data Integrity**
- Database schema, connection pool
- Auth, JWT, OTP + Gmail sending
- Hash-chain ledger engine — utils/ledger.js
- Documents state machine, anomaly detection rules
- Move history, verify-integrity endpoint
- Dashboard KPI endpoints

**Frontend & Experience**
- Design system — one consistent color/type system across every page
- Auth pages, sidebar navigation, SVG icon set
- Dashboard — live KPIs, filters, Socket.io real-time updates
- Products, Operations (receipts/delivery/transfers/adjustments), Move
  History, Settings pages
- Barcode/QR scanning integration

---

## What to say in your pitch

> "Most inventory systems just log stock changes to a table anyone can
> quietly edit. Ours writes every movement to a hash-chained ledger — the
> same principle blockchain uses — so if a past record is ever tampered
> with, our Verify button catches it and names the exact entry. And it's
> all built on plain MySQL, with zero external API dependency, so we're
> never affected by third-party downtime."
