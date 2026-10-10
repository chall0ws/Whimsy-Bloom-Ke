# Whimsy & Bloom — business dashboard

*Handmade flowers, made with love.*

One place for Whimsy & Bloom to run the shop: orders from the web form and live chat, a live-chat inbox, customer history, materials stock, and the partner's KES 100-per-order service fee.

This is **Stage A**: a working, clickable prototype with realistic sample data. Everything runs in the browser and is saved in that browser (`localStorage`). There is no server yet.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # order, fee, payout and stock rules
npm run build        # static site in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

## Look and feel

The brand look follows the Whimsy & Bloom "We are OPEN!" poster: blush-cream paper, olive green lettering, dusty-rose script (Allura) with Cormorant Garamond headings, a line-art flower logo with sparkles, heart dividers and arch-shaped frames. The colours are tokens at the top of `src/index.css`.

The app is **light by default**, whatever the phone or computer is set to. Team members can switch the dashboard to dark from the sidebar; customer pages (order form, chat, client portal) always use the brand look.

## Signing in

Everyone signs in with **Google**. Team members (set in `VITE_STAFF_EMAILS`) get the dashboard; everyone else gets the client portal.

- **Demo mode** (default): "Continue with Google" opens a pretend account picker: *Partner* (super admin), *Owner* (admin), or *Faith Njeri* (a customer with past orders).
- **Real Google login:** follow [docs/google-login.md](docs/google-login.md) (about 15 minutes, using Supabase Auth), then put the keys in `.env.local` (see `.env.example`).

## What's in it

| Screen | What it does |
|---|---|
| **Overview** | KPIs (orders today, total revenue, unread messages), Order Management with status toggles, fee tracker, latest live chats, product performance and customer growth charts. |
| **Orders** | Full queue with filters and search. Highlights the oldest pending order as *Next up*. Order details, cancel and refund. |
| **Live chat** | Her side of the chat. Online/Away switch, unread badges, typing indicators, "Seen" receipts, quick replies, **Create order** from a chat (with an M-Pesa payment link the customer pays from inside the chat), customer notes alongside. |
| **Customers** | Customer list with lifetime spend, notes, preference tags and order history. |
| **Materials** | Stock on hand, low-stock warnings, materials per bouquet, purchase log. Materials come off automatically when an order moves to *Processing*. |
| **Service fees** | Payable balance, fees by week, payouts (sent → confirmed) and the fee ledger. |
| **Settings** | Super admin only: fee rate, hand-delivery rule, courier fee, payout schedule, team roles, activity log, reset demo data. |
| **Order form** | The customer page linked from her bios, with a simulated M-Pesa prompt and a *Chat with us* pop-up. Orders land in the dashboard as *Web Form*. |
| **Client portal** (`#/portal`) | For customers, signed in with Google: their orders with a progress tracker, **Pay with M-Pesa** for unpaid orders, *Order again*, a new-order form with their saved address, chat with the shop, and their details. The first sign-in asks for a phone number and brings over past orders and chats made with that number. |
| **Chat page** | The customer's side of live chat, for the "Chat with us" link in her bios. Customers give their name and phone number and chat. They see whether she's online, and get an automatic reply when she's away. |

### Trying live chat

Open the dashboard's **Live chat** page in one tab and the **Chat page** (`#/chat`) in another tab of the same browser. Messages, typing, "Seen" receipts and payments show up in the other tab straight away. In Stage A, tabs share data through browser storage. Stage B moves this to a realtime backend, so customers can chat from their own phones.

## Business rules

- **Order flow:** `Awaiting payment → Pending → Processing → Shipped`. Unshipped orders can be cancelled. Shipped orders can be refunded.
- An order leaves *Awaiting payment* only when a payment is confirmed.
- **Service fee:** KES 100 (configurable) is charged **once**, when an order is marked *Shipped*. One ledger line per order, never removed.
- **Shipped is final.** A shipped order can't be moved back. If it's refunded, the customer gets the bouquet price back. The **delivery fee and service fee are non-refundable**.
- Cancelling before shipping refunds the customer in full, and no service fee is charged.
- **Hand delivery has no delivery cost.** Hand-delivered orders still earn the service fee. The super admin can switch that off in Settings.
- **Live chat:** one conversation per customer, matched by phone number. While she's *Away*, a customer gets at most one automatic reply per hour. Orders created from a chat are tagged *Live chat*, and their payment link and shipping confirmation are posted in that chat.
- **Payouts:** the admin records a payout with its M-Pesa code. The payable balance goes down once the **super admin** confirms receipt.
- **Roles:** the *super admin* (platform partner) can do everything. The *admin* (shop owner) runs orders, messages, customers and stock, and records payouts. She can't change fees or settings, or confirm payouts. A Google account that isn't on the team can't open the dashboard.
- **Customers** can only see, pay for and change their own orders and details. Portal orders are tagged *Client portal*.

The rules live in `src/domain/` as pure functions, covered by `src/domain/actions.test.ts`.

## Code layout

```
src/domain/     types, catalog, order/fee/stock rules (actions.ts), metrics, seed data
src/auth/       Google sign-in (Supabase or demo), team gate, sign-in screens
src/state/      React store with browser persistence and live tab-to-tab sync
src/components/ layout, logo, charts, order widgets, fee tracker, customer chat widget, UI primitives
src/pages/      one file per screen; pages/portal/ is the client portal
```

## What's simulated in Stage A

| Simulated | Stage B |
|---|---|
| Sample orders, customers and chats, generated relative to the first visit | Orders, chats and customers in the Supabase database, protected by row-level security; team list in a `staff` table |
| Linking a portal account to past orders by phone number | SMS code to confirm the number before linking |
| Payment links and M-Pesa prompts | Payment provider (IntaSend, Paystack or Pesapal) confirming payments automatically |
| Shipping confirmations | SMS (Africa's Talking) or email |
| Live chat between tabs of one browser | Realtime backend (e.g. Supabase Realtime) so customers chat from their own devices, plus a phone notification for her when a new chat arrives |
