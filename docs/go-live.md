# Going live: Supabase data and Paystack payments

Until these steps are done, the site keeps running in **demo mode** (sample data saved in each browser, pretend payments). Turning on live mode is one switch, `VITE_LIVE=true`, and it comes **last**, after the database and keys are in place.

When live:

- Orders, customers, chats, stock and fees are stored in your **Supabase** database. The team sees the same data on every phone and computer, and customers chat from their own devices.
- Customers pay with **M-Pesa or card** in Paystack's secure payment window. The order is marked paid only after the server has checked the payment with Paystack, so nobody can fake a payment from their browser.
- The browser never talks to the database directly. Every request goes through the site's own server functions (`/api/...`), which apply the same order, fee and permission rules as the demo.

It takes about 20 minutes. You need the Vercel project (with the Supabase integration already connected), the Supabase project, and a Paystack account.

> **Never paste secret keys into a chat, an email or the code.** The Paystack secret key and the Supabase service-role key go only into Vercel's **Environment Variables**.

---

## 1. Create the tables in Supabase

1. Open your project at [supabase.com](https://supabase.com) → **SQL Editor** → **New query**.
2. Open `supabase/migrations/20261010120000_whimsy_core.sql` from this repository, copy all of it, paste it in and click **Run**. It should end with *Success. No rows returned*.

What it creates:

| | |
|---|---|
| `records` | One row per order, customer, chat, product, material, fee line… (the data is in a `data` column). |
| `app_meta` | Settings and counters (next order number), plus a version number so two people saving at once can't overwrite each other. |
| `apply_changes(...)` | Saves a batch of changes in one go. Only the server can call it. |
| `orders_overview`, `customers_overview`, `service_fees_overview` | Read-only views, handy for looking at the data in **Table Editor** or exporting to a spreadsheet. |

Row-level security is **on with no policies**, so the public (anon) key can't read or change anything. Only the server, using the service-role key, can.

The shop starts **empty** (the bouquet catalogue is built in). The first visit creates the shop's settings.

## 2. Supabase settings

1. **Authentication → URL Configuration**
   - **Site URL:** your live address, e.g. `https://whimsy-bloom-ke.vercel.app`.
   - **Redirect URLs:** add the same address (and `http://localhost:5173` if you test locally).
2. **Sign-in providers:** Google and email/password, as in [google-login.md](google-login.md) steps 2–3. Keep **Confirm email** on.
3. **Realtime** (Project Settings → **Realtime**): leave **public channels allowed** (don't switch on *private channels only*). The site uses two public channels: one saying "something changed, fetch again" and one for typing indicators. No order or customer data goes over them.

## 3. Paystack (test mode)

1. Sign in at [dashboard.paystack.com](https://dashboard.paystack.com) and make sure the **Test mode** toggle (top bar) is on.
2. **Settings → API Keys & Webhooks**
   - Copy the **Test Secret Key** (`sk_test_…`). It goes into Vercel in step 4, nowhere else.
   - **Test Webhook URL:** `https://<your-site>/api/pay/webhook`, e.g. `https://whimsy-bloom-ke.vercel.app/api/pay/webhook`. Save.
   - The public key isn't needed. The server starts each payment.
3. **Settings → Preferences → Payment channels:** make sure **M-Pesa** (mobile money) and **Card** are on. Payments are in **KES**.

## 4. Vercel environment variables

Vercel → your project → **Settings → Environment Variables**. The Supabase integration has already added `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (check they're there for **Production**). The app reads those names as they are.

Add these:

| Name | Value | Notes |
|---|---|---|
| `VITE_STAFF_EMAILS` | `you@gmail.com:SUPER_ADMIN, her@gmail.com:ADMIN` | The exact addresses you two sign in with. |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` | Mark it **Sensitive**. Swap for `sk_live_…` when you go live for real. |
| `PAYSTACK_RECEIPT_EMAIL` | e.g. `orders@whimsybloom.co.ke` | Optional. Paystack needs an email for every payment; guests who don't give one use this. |
| `VITE_LIVE` | `true` | **Add this last.** It switches the site from demo to live. |

Then **Deployments → ⋯ → Redeploy** on the latest deployment. Variables starting with `VITE_` are built into the page, so a redeploy is needed every time you change them.

To go back to demo mode, delete `VITE_LIVE` (or set it to `false`) and redeploy. The database keeps its data.

## 5. Try it

1. Open the site in a private window. Add a bouquet, check out as a guest, choose **Pay … · M-Pesa or card**.
2. Paystack's window opens. In test mode no real money moves. Pay with Paystack's test card **4084 0840 8408 4081**, expiry any future date, CVV **408**, PIN **0000**, OTP **123456**. (Paystack's [test payments page](https://paystack.com/docs/payments/test-payments/) lists test M-Pesa options too.)
3. You land on the thank-you page with *Payment received*. The order shows **Paid** and moves to *Pending*.
4. Sign in at `/#/admin` with your Google account. The order is there, paid by **Paystack**, on every device.
5. From another phone, open **Chat with us** and send a message. It appears in the dashboard's **Live chat** within a second or two.
6. In Paystack → **Transactions**, the payment shows with the order ID in its metadata. Under **Settings → API Keys & Webhooks** the webhook log should show `200`.

If someone closes the window after paying, nothing is lost: Paystack's webhook marks the order paid on its own.

## Running it on your computer (optional)

Put the same values in `.env.local` (see `.env.example`) and run `npm run dev`. The `/api` routes run inside the dev server. Paystack's webhook can't reach your computer, but the payment window confirms the payment itself, so test payments still go through.

## Common problems

| You see | Fix |
|---|---|
| "The server isn’t connected to Supabase yet (missing …)" | That variable is missing in Vercel for Production. Add it and redeploy. |
| "The database tables aren’t set up yet" | Run the SQL in step 1. |
| "Payments aren't switched on yet (missing PAYSTACK_SECRET_KEY)" | Add the key in Vercel and redeploy. |
| The site still shows sample data | `VITE_LIVE` isn't `true`, or you didn't redeploy after adding it. |
| Paid, but the order still says *Awaiting payment* | Check the webhook URL (step 3.2) and Paystack's webhook log. Refreshing the page re-checks too. |
| Chat messages only arrive after ~30 seconds | Realtime public channels are switched off (step 2.3). The 30-second refresh still works. |

## What's next

- **Real phone check before linking history.** While live, a new account doesn't pick up older orders by phone number alone (anyone could type a number). An SMS code will confirm the number first.
- **SMS / email confirmations** for orders, payments and shipping (Africa's Talking or an email service).
- **Live keys:** when Paystack approves the business, switch the dashboard to live mode, copy `sk_live_…` into `PAYSTACK_SECRET_KEY`, set the **Live Webhook URL** to the same `/api/pay/webhook` address, and redeploy.
