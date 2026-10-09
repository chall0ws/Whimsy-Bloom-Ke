# Whimsy & Bloom — business dashboard

*Handmade flowers, made with love.*

One place for Whimsy & Bloom to run the shop: orders from the web form and Instagram/Messenger DMs, a combined inbox, customer history, materials stock, and the partner's KES 100-per-order service fee.

This is **Stage A**: a working, clickable prototype with realistic sample data. Everything runs in the browser and is saved in that browser (`localStorage`). There is no server yet.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # order, fee, payout and stock rules
npm run build        # static site in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

## What's in it

| Screen | What it does |
|---|---|
| **Overview** | KPIs (orders today, total revenue, unread messages), Order Management with status toggles, fee tracker, latest DMs, product performance and customer growth charts. |
| **Orders** | Full queue with filters and search. Highlights the oldest pending order as *Next up*. Order details, cancel and refund. |
| **Messages** | Instagram and Messenger threads in one inbox. Unread badges, mark read/unread, quick replies, **Create order** from a chat, customer notes alongside. |
| **Customers** | Customer list with lifetime spend, notes, preference tags and order history. |
| **Materials** | Stock on hand, low-stock warnings, materials per bouquet, purchase log. Materials come off automatically when an order moves to *Processing*. |
| **Service fees** | Payable balance, fees by week, payouts (sent → confirmed) and the fee ledger. |
| **Settings** | Super admin only: fee rate, hand-delivery rule, courier fee, payout schedule, team roles, activity log, reset demo data. |
| **Order form** | The customer page linked from her bios, with a simulated M-Pesa prompt. Orders land in the dashboard as *Web Form*. |

## Business rules

- **Order flow:** `Awaiting payment → Pending → Processing → Shipped`. Unshipped orders can be cancelled. Shipped orders can be refunded.
- An order leaves *Awaiting payment* only when a payment is confirmed.
- **Service fee:** KES 100 (configurable) is charged **once**, when an order is marked *Shipped*. One ledger line per order, never removed.
- **Shipped is final.** A shipped order can't be moved back. If it's refunded, the customer gets the bouquet price back. The **delivery fee and service fee are non-refundable**.
- Cancelling before shipping refunds the customer in full, and no service fee is charged.
- **Hand delivery has no delivery cost.** Hand-delivered orders still earn the service fee. The super admin can switch that off in Settings.
- **Payouts:** the admin records a payout with its M-Pesa code. The payable balance goes down once the **super admin** confirms receipt.
- **Roles:** the *super admin* (platform partner) can do everything. The *admin* (shop owner) runs orders, messages, customers and stock, and records payouts. She can't change fees or settings, or confirm payouts. In Stage A a demo switcher in the sidebar changes roles.

The rules live in `src/domain/` as pure functions, covered by `src/domain/actions.test.ts`.

## Code layout

```
src/domain/     types, catalog, order/fee/stock rules (actions.ts), metrics, seed data
src/state/      React store with browser persistence
src/components/ layout, logo, charts, order widgets, fee tracker, UI primitives
src/pages/      one file per screen
```

## What's simulated in Stage A

| Simulated | Stage B / C |
|---|---|
| Sample orders, customers and DMs, generated relative to the first visit | Real database (e.g. Supabase) with logins for each role |
| Payment links and M-Pesa prompts | Payment provider (IntaSend, Paystack or Pesapal) confirming payments automatically |
| Shipping confirmations | SMS (Africa's Talking) or email |
| Replies in the inbox stay in the dashboard | Stage C: Instagram & Messenger via Meta's messaging API (needs a Business account and Meta app review; replies only within 24 hours of the customer's last message) |
