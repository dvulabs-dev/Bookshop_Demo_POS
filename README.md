# Dinuda Bookshop – POS & Bookshop Management System (Frontend Demo)

Interactive **frontend-only** demo built by DVULabs from the *Dinuda Bookshop POS System Plan*.
React + Vite + TypeScript. No backend: all data is seeded sample data kept in the browser (`localStorage`).

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # production build -> dist/   (host on any static server)
npm run build:single   # ONE self-contained file -> dist-single/index.html
                       # (e-mail it / double-click it – works offline, no server needed)
npm run typecheck
```

## Demo accounts (password for all: `demo`)

| Role | Username | Approval PIN |
|---|---|---|
| Owner / Administrator | `owner` | 1111 |
| Manager | `manager` | 2222 |
| Cashier | `cashier` (Kasun), `sanduni` | – |
| Inventory / Stock clerk | `stock` | – |
| Purchasing staff | `purchasing` | – |
| Accountant | `accountant` | – |

The login screen has one-click buttons for each role. Cashiers cannot see cost prices, profit,
reports or settings; discounts above the cashier limit (10%), credit sales, voids and refunds ask for a
**manager/owner PIN** (1111 / 2222).

## Suggested demo script
1. Sign in as **Cashier** → POS. Type an ISBN/barcode + Enter (or press **Demo scan**), tap items, change qty.
2. Give a 5 % discount (fine) then 25 % (PIN approval required). Pay with **split** cash + card → receipt (print / PDF / WhatsApp).
3. Select **Hanwella Central College**, leave part unpaid → credit sale (needs approval).
4. Sign in as **Manager** → Sales & Returns: open a bill → return an item (restocked) / void a bill.
5. **Purchasing** → open an *Ordered* PO → *Confirm goods received* → stock goes up → record a part payment.
6. **Orders & Quotes** → convert a quotation or collect a reservation (advance is applied at the POS).
7. **Reports**, **Dashboard**, **Settings → Receipts** (live preview, A4 ⇄ thermal), toggle **Sinhala / dark mode**.
8. **Settings → Data & security → Reset demo data** restores the original sample data at any time.

## What is covered (plan section → screen)
Dashboard (00–01) • POS & receipts (02, 07) • Products, ISBN/barcode, labels, CSV import (03) • Stock, reorder, valuation,
aging, price history (03, 12) • Purchasing & suppliers (04) • Customers, loyalty (05) • Quotations, reservations,
special orders, school lists, packs (06, 12) • Returns/exchanges (07) • Payments, shifts, expenses (08) •
13 reports with Excel/CSV + print (09) • Settings panel (10) • Staff, roles & per-user permissions, audit log (11) •
Sinhala/English, light/dark, responsive desktop/tablet/mobile (13).

## Demo limitations (to be replaced by the real backend)
- Data lives in this browser only; clearing site data or using another browser starts from the sample data.
- Passwords/PINs are stored in plain text (demo only). Real auth, server backups and e-mail/WhatsApp automation belong to the backend phase.
- “PDF” uses the browser’s *Print → Save as PDF*. WhatsApp/e-mail open a pre-filled message.
- Logo upload, invoice/expense attachments (file name only), thermal-printer/cash-drawer drivers and multi-branch stock are stubs.
- Sinhala wording covers navigation, POS and receipts and should be reviewed by the shop’s staff.
