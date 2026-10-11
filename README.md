# Whimsy & Bloom — shop and business dashboard

*Handmade flowers, made with love.*

Two sides of one app:

- **The shop** (the main address, `/#/`): customers browse, fill a cart and check out **without signing in**. At checkout they can create a free account in one tap (Google or email), or carry on as a guest.
- **The dashboard** (`/#/admin`): the team runs the business there, with orders, live chat, customers, materials stock and the partner's KES 100-per-order service fee.

It runs in one of two modes:

- **Demo** (the default): realistic sample data saved in each browser, pretend sign-in and pretend M-Pesa payments. Nothing to set up.
- **Live** (`VITE_LIVE=true`): data in **Supabase**, real Google and email sign-in, and **Paystack** payments (M-Pesa or card). The page talks only to the site's own server functions under `/api`, which apply the business rules and decide who may see and change what. Setup: [docs/go-live.md](docs/go-live.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # order, fee, payout and stock rules, plus server permissions and payments
npm run build        # static site + /api functions in .vercel/output (Vercel Build Output API)
npm run build:single # one self-contained HTML file in dist-single/
```

## Look and feel

The brand look follows the Whimsy & Bloom "We are OPEN!" poster: blush-cream paper, olive green lettering, dusty-rose script (Allura) with Cormorant Garamond headings, a line-art flower logo with sparkles, heart dividers and arch-shaped frames. The colours are tokens at the top of `src/index.css`.

The app is **light by default**, whatever the phone or computer is set to. Team members can switch the dashboard to dark from the sidebar; the shop always uses the brand look.

## Accounts and signing in

Nobody has to sign in to shop. Accounts are optional, offered at checkout and again on the thank-you page (a guest's order is saved to the account they create there).

- **Ways to sign in:** **Continue with Google**, or an **email and password**. Forgotten passwords are reset by email.
- **Team:** emails listed in `VITE_STAFF_EMAILS` open the dashboard at `/#/admin`. The address must be **verified**: signed in with Google, or an email account whose confirmation link was clicked. A password account that merely *uses* a team email can't get in.
- **Demo mode** (default, nothing configured): "Continue with Google" opens a pretend account picker (*Partner* = super admin, *Owner* = admin, *Faith Njeri* = customer with past orders). Email accounts are pretend too and stay in that browser.
- **Real sign-in:** follow [docs/google-login.md](docs/google-login.md) (Supabase Auth), then [docs/go-live.md](docs/go-live.md) to switch on live data and payments.

## What's in it

### The shop (customers)

| Page | What it does |
|---|---|
| **Home** (`/#/`) | Poster-style welcome, the four things she makes, customer favourites and how it works. |
| **Shop** (`/#/shop`) and **bouquet pages** | Every bouquet with price and description. On a bouquet page: quantity, colours and card message, *Add to cart* or *Buy now*. |
| **Cart** (`/#/cart`) | Change quantities and wishes. Remembered in the browser, no account needed. |
| **Checkout** (`/#/checkout`) | Name, phone, delivery (courier or free hand delivery in Nairobi), then *Pay with M-Pesa* or *pay later*. One-tap Google or email sign-up is offered at the top; guests just fill in the form. |
| **Thank you** | Order summary with a progress tracker, *Pay* if unpaid, and an offer to save the order to a new account. |
| **My account** (`/#/account`) | Orders with tracking, *Pay with M-Pesa*, *Order again* (back into the cart), chat with the shop, and their details. |
| **Chat with us** | On every page as a bubble, and full-page at `/#/chat`. |

Bouquets are shown with hand-drawn illustrations in the poster's style until there are product photos.

### The dashboard (team, `/#/admin`)

| Screen | What it does |
|---|---|
| **Overview** | KPIs (orders today, total revenue, unread messages), Order Management with status toggles, fee tracker, latest live chats, product performance and customer growth charts. |
| **Orders** | Full queue with filters and search. Highlights the oldest pending order as *Next up*. Order details, cancel and refund. |
| **Live chat** | Her side of the chat. Online/Away switch, unread badges, typing indicators, "Seen" receipts, quick replies, **Create order** from a chat (with an M-Pesa payment link the customer pays from inside the chat), customer notes alongside. |
| **Customers** | Customer list with lifetime spend, notes, preference tags and order history. |
| **Materials** | Stock on hand, low-stock warnings, materials per bouquet, purchase log. Materials come off automatically when an order moves to *Processing*. |
| **Service fees** | Payable balance, fees by week, payouts (sent → confirmed) and the fee ledger. |
| **Settings** | Super admin only: fee rate, hand-delivery rule, courier fee, payout schedule, team roles, activity log, reset demo data. |

Shop orders show in the dashboard as **Website (guest)** or **Website (account)**.

### Trying live chat

In demo mode, open the dashboard's **Live chat** page (`/#/admin/inbox`) in one tab and the shop's **Chat with us** page (`/#/chat`) in another tab of the same browser. Messages, typing, "Seen" receipts and payments show up in the other tab straight away, through browser storage. In live mode the same happens across devices, over Supabase Realtime.

## Business rules

- **Order flow:** `Awaiting deposit → Pending → Processing → Ready → Shipped`. Unshipped orders can be cancelled. Shipped orders can be refunded.
- **50% deposit:** every order starts with a deposit of half the bouquet price (rounded up). It joins her work queue only once the deposit is paid. Checkout asks whether delivery is **within Nairobi** or **outside Nairobi**; there is no "pay later".
- **Order ready:** she taps *Ready* and enters the delivery fee. The customer is asked for the **balance** (the other 50% + delivery): a WhatsApp message opens on her phone ready to send, and the customer gets a *Pay balance* button on their order page, in My account and in the chat.
- **Shipping waits for the balance.** An order can be marked *Shipped* only once it's fully paid.
- **Service fee:** KES 100 (configurable) is charged **once**, when an order is marked *Shipped*. One ledger line per order, never removed.
- **Shipped is final.** A shipped order can't be moved back. If it's refunded, the customer gets the bouquet price back. The **delivery fee and service fee are non-refundable**.
- **The deposit is non-refundable.** Cancelling before shipping keeps the deposit and refunds anything paid beyond it. No service fee is charged.
- Orders delivered within Nairobi earn the service fee too; the super admin can switch that off in Settings.
- **Live chat:** one conversation per customer, matched by phone number. While she's *Away*, a customer gets at most one automatic reply per hour. Orders created from a chat are tagged *Live chat*, and their payment link and shipping confirmation are posted in that chat.
- **Payouts:** the admin records a payout with its M-Pesa code. The payable balance goes down once the **super admin** confirms receipt.
- **Roles:** the *super admin* (platform partner) can do everything. The *admin* (shop owner) runs orders, messages, customers and stock, and records payouts. She can't change fees or settings, or confirm payouts. A Google account that isn't on the team can't open the dashboard.
- **Customers** can only see, pay for and change their own orders and details. A guest order can be saved to an account only from the browser it was placed in (live, that browser holds a secret token for it). Customers never see team notes, tags or the service fee.
- **Payments (live):** the server starts each Paystack payment for what's due now (the deposit, then the balance) and marks it paid only after checking with Paystack (from the payment window, or Paystack's signed webhook if the window was closed). The amount must match, and the same payment is never counted twice.
- **Old links** keep working: `/#/portal` opens My account and `/#/order-form` opens the shop.

The rules live in `src/domain/` as pure functions, covered by `src/domain/actions.test.ts`. The live server runs the very same functions.

## Code layout

```
src/domain/     types, catalog, order/fee/stock rules (actions.ts), metrics, seed data
src/auth/       Google and email sign-in (Supabase or demo), team gate, sign-in panel
src/shop/       the shop: layout, home, catalogue, cart, checkout, thank-you, My account
src/state/      React store: browser storage (demo) or the /api server with realtime refresh (live)
src/components/ layout, logo, charts, order widgets, fee tracker, customer chat widget, UI primitives
src/pages/      one file per dashboard screen, plus the full-page customer chat
server/         /api functions: permissions, per-person views, Supabase storage, Paystack (core.test.ts)
supabase/       SQL to run once in the Supabase SQL Editor
scripts/        packs the site and functions for Vercel
```

## Demo vs live

| | Demo | Live |
|---|---|---|
| Data | Sample orders, customers and chats in each browser | Supabase database, reachable only through the `/api` server |
| Sign-in | Pretend Google accounts and browser-only email accounts | Supabase Auth (Google, email and password) |
| Payments | Pretend M-Pesa prompt | Paystack window (M-Pesa or card), confirmed by the server and webhook |
| Live chat | Between tabs of one browser | Across devices (Supabase Realtime, with a 30-second refresh as backup) |
| Linking past orders by phone | Yes | Not yet: needs an SMS code first |

Still to come: SMS/email confirmations (Africa's Talking or an email service), an SMS code before linking history by phone number, a phone notification for her when a new chat arrives, and Paystack live keys.
