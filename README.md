# NEAR Business Manager

**Customers, products, invoices and NEAR payments in one on-chain dashboard — built for online businesses.**

[![Live demo](https://img.shields.io/badge/live%20demo-GitHub%20Pages-6ee7b7)](https://aryann-4.github.io/bussiness-management-on-near/)
[![Contract](https://img.shields.io/badge/NEAR%20testnet-near--business--manager.testnet-60a5fa)](https://explorer.testnet.near.org/accounts/near-business-manager.testnet)
[![Tests](https://img.shields.io/badge/contract%20tests-6%20passing-34d399)](contracts/near-business/src/lib.rs)
[![Built for](https://img.shields.io/badge/NEAR%20Hackathon-2026-a78bfa)](#hackathon-track-alignment)

> **Demo:** <https://aryann-4.github.io/bussiness-management-on-near/>
> The demo opens in **demo mode** — a complete, clickable workspace backed by local state. Switch to **NEAR testnet** in the header to sign real transactions with a testnet wallet.

---

## Table of contents

- [What it does](#what-it-does)
- [Live links](#live-links)
- [Try it in 60 seconds](#try-it-in-60-seconds)
- [Features](#features)
- [Payments and guest checkout](#payments-and-guest-checkout)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Contract API](#contract-api)
- [Run locally](#run-locally)
- [Deploy your own](#deploy-your-own)
- [Tests](#tests)
- [Hackathon track alignment](#hackathon-track-alignment)
- [Security notes and limitations](#security-notes-and-limitations)
- [Roadmap](#roadmap)
- [License](#license)

---

## What it does

Small online businesses juggle a spreadsheet for customers, another for products, a third for
invoices, and a payment link that settles somewhere else. **NEAR Business Manager** replaces that
with a single dashboard where:

1. **The business** creates a profile (name, handle, email, currency, tax rate).
2. **Customers** are stored against the business.
3. **Products / services** are catalogued with a NEAR price.
4. **Invoices** are created from line items; subtotal, tax and total are computed on-chain.
5. **Payments settle in NEAR** — the payer attaches exactly the invoice total and the contract
   forwards the funds to the business owner in the same transaction.
6. **Analytics** show revenue, outstanding balance, open invoices and paid invoices.

The contract is deployed on **NEAR testnet**, and the frontend ships with a full **demo mode** so
judges and visitors can explore the product without a wallet.

```text
                    ┌──────────────────────────────────────────────┐
                    │            NEAR Business Manager             │
                    ├──────────────────────────────────────────────┤
  business owner ──▶│ profile · customers · products · invoices    │
                    │              │                               │
                    │              ▼                               │
                    │   create_invoice (tax computed on-chain)     │
                    │              │                               │
   customer ───────▶│   pay_invoice (deposit == total) ───▶ owner  │
                    │              │                               │
                    │              ▼                               │
                    │   stats: revenue · outstanding · counts      │
                    └──────────────────────────────────────────────┘
```

---

## Live links

| What | Where |
| --- | --- |
| **Demo app** | <https://aryann-4.github.io/bussiness-management-on-near/> |
| **Contract account** | [`near-business-manager.testnet`](https://explorer.testnet.near.org/accounts/near-business-manager.testnet) |
| **Source** | <https://github.com/Aryann-4/bussiness-management-on-near> |
| **Contract wasm** | `contracts/near-business/target/wasm32-unknown-unknown/release/near_business.wasm` |

---

## Try it in 60 seconds

1. Open the [demo](https://aryann-4.github.io/bussiness-management-on-near/).
2. Click **Load a sample workspace** (or create your own business on the right).
3. Explore:
   - **Overview** — revenue, outstanding balance, recent invoices.
   - **Invoices** — create an invoice with line items and watch tax/total recompute live, then mark it sent and paid.
   - **Customers** — add and remove customers.
   - **Products** — add a service with a NEAR price, archive or remove it.
   - **Settings** — edit the business profile or reset the demo.
4. Want real transactions? Click **Switch to NEAR testnet** → **Connect wallet** and use a testnet account.

> Demo data is stored in `localStorage`. It never leaves your browser.

---

## Features

### Product
- Business profile with handle, email, currency and configurable tax rate.
- Customer directory.
- **Customer payment links** — every invoice has a shareable URL (`?pay=<ownerAccount>:<invoiceId>`) that
  opens a read-only checkout page. The customer signs from their own wallet; the contract forwards the
  deposit to the business owner. Optional **Sign in with Google** via NEAR Auth (testnet) is available on
  the checkout page when run on `http://localhost:3000` (the only callback origin the shared testnet Auth0
  client accepts); on other origins a note explains how to enable your own tenant or run locally.
- Product/service catalogue with archive + delete.
- Invoice builder with multiple line items, live totals and automatic tax.
- Invoice lifecycle: **Draft → Sent → Paid**, or **Cancelled**.
- One-click payment in NEAR from the UI.
- Dashboard analytics: revenue, outstanding, customer count, invoice counts.
- Clean, light UI designed for clarity: plain-language labels, a guided getting-started checklist,
  helpful empty states and a seeded sample workspace.
- Light and dark themes with a one-click toggle in the header. The choice is saved and the
  system preference is used on the first visit.
- A custom logo: rising bars, a growth arrow and a NEAR coin.
- Motion with purpose: page transitions, staggered cards, floating hero chips, animated totals,
  logo sheen, a live checklist progress bar and press feedback — all disabled automatically for
  users who prefer reduced motion.
- Fully responsive: two-column desktop layout, stacked forms and tables on phones, and an
  app-style bottom navigation on mobile.

### Contract
- One dashboard per NEAR account.
- Tax computed with basis points (no floating point).
- Integer overflow checks on line amounts and subtotals (`checked_mul` / `checked_add`).
- Payments require `attached_deposit == invoice.total`.
- Paid invoices are immutable; cancelled invoices cannot be paid.
- NEP-297 style `EVENT_JSON` logs for `business_created`, `customer_added`, `product_added`,
  `invoice_created` and `invoice_paid`.
- 6 Rust unit tests.

### Frontend
- **Demo mode** — fully functional with local state, no wallet required.
- **Live mode** — reads via NEAR RPC and writes via
  [NEAR Wallet Selector](https://github.com/near/wallet-selector) with MyNearWallet, Meteor,
  HERE, Nightly and Sender. The wallet stack is lazy-loaded, so the demo stays light.
- **Uses your installed wallet.** If a NEAR wallet extension is already active in the browser
  (Meteor, Nightly, Sender or HERE), **Connect wallet** signs in with it directly instead of
  opening another wallet tab. The wallet you connected with last time is preferred. Use
  **Choose a wallet** to pick a different one.
- Browser-safe NEAR libraries: `src/polyfills.ts` provides the Node globals (`Buffer`, `global`)
  that some wallet packages expect, so wallet setup works on a plain static host like GitHub Pages.
- Money is handled as `u128` yoctoNEAR strings end-to-end; the UI formats to NEAR.
- Vite + React + TypeScript, no UI framework lock-in.

---

## Payments and guest checkout

This is the part of the project that deserves a clear-eyed explanation — because the demo does
**not** yet do what a Stripe checkout does, and it's important to understand both what it does
today and where it goes.

### How an invoice gets paid

There are exactly two authorised ways for money to move:

1. **Wallet path (works today, everywhere).** The customer opens the shareable payment link,
   connects their NEAR wallet, and signs `pay_invoice(owner_id, invoice_id)` with exactly the
   invoice total attached as deposit. The smart contract verifies `attached_deposit == total`,
   flips the invoice to `Paid`, records the NEP-297 `invoice_paid` event, and forwards the
   attached NEAR to the business owner atomically. No relayer, no custody, no off-chain bookkeeping.
2. **Guest path (sign in with Google).** The customer signs in with a Google account through
   NEAR Auth (Auth0). Auth0 issues a JWT, NEAR's on-chain guard verifies it, and the MPC network
   derives a unique key for that Google identity — no seed phrase, no extension, no custody. The
   account this key controls is a NEAR **universal account**.

### What "guest" means here — and what it does not mean (yet)

In the demo, signing in with Google on the checkout page is *identification*: it proves to the
merchant that a real person with a Google account is opening the invoice. It is honest, useful
(and it keeps strangers from being able to mark an invoice paid without an authenticated session),
but it is **not yet a full checkout** in the consumer sense. Specifically:

- The Google sign-in currently works on `http://localhost:3000` — the only callback origin the
  shared NEAR Auth testnet Auth0 application authorizes. The deployed GitHub Pages origin is not
  on that allowlist, so the deployed demo shows a clear explanation instead of the sign-in button.
  To use your own origin you need sponsorship from NEAR, or your own attested custom issuer
  (see [Roadmap](#roadmap)).
- The final signature today is produced by the customer's **wallet**, not by the MPC-derived key.
  The browser SDK does not yet ship the universal-account abstraction layer end-to-end for web
  apps, so a brand-new Google account cannot instantly become a spendable NEAR account with NEAR
  in it. The MPC-derived key exists and is usable in principle, but billing a stranger through it
  isn't wired up in this demo.
- Settlement is still one wallet → one invoice → one transaction, with exact-amount enforcement.

### The vision — why this beats both Stripe and a raw wallet send

A true Stripe-style checkout with a Web2 button would look like this:

1. **Click "Pay with Google."** A popup asks for your Google login. No password to the app, no
   seed phrase, no extension, no wallet install prompt.
2. **MPC derives your NEAR key** from your Google identity. The app never sees a private key.
3. **Your universal account already exists** (or is created by a sponsored relayer on the first
   purchase — the NEAR Auth relayer-assisted creation flow). The merchant never needs a customer
   to "get NEAR" before paying; the relayer can sponsor creation and gas from the price of the
   invoice.
4. **A meta-transaction pays the invoice.** You sign once in the Auth0 popup; the relayer wraps
   your signature in a NEP-366 meta-transaction, the contract executes `pay_invoice`, funds land
   in the merchant's account — and from the customer's perspective it felt identical to tapping
   "Confirm" on any modern checkout.

No card numbers on our servers. No account lists to leak. No seed phrases to lose. No custodial
balance at risk. And because the whole thing is just NEAR transactions and NEP-366 meta-transactions,
everything is auditable on-chain.

**What is deliberately not in this demo:** multi-token payment (NEP-141 stablecoins — the
contract currently only accepts native NEAR), subscriptions and split payments, refund flows,
and partial payment support. Those are the natural next steps.

### Why it isn't ready for strangers on arbitrary origins yet

- **Only NEAR-authorised origins can use the shared testnet Auth0 app** (`localhost:3000`).
  The callback allowlist is not ours to extend. Anyone shipping their own demo must run locally,
  or apply to NEAR Auth for a production/Auth0 tenant and build a custom attested issuer so our
  own origin is trusted (the NEAR Auth repository documents the custom-issuer path).
- The browser SDK / library support for **universal accounts in web apps** is still landing.
  The testnet faucet and the meta-transaction relayer pattern are proven in production for
  first-party NEAR apps; general third-party adoption is still early.
- Sponsoring customer-side gas requires either a relayer service or a product decision about
  who pays for each transaction (merchant, the NEAR Foundation, or the customer in NEAR).

### Honest summary for judges

| Property | Wallet path | Guest path (today) | Guest path (vision) |
| --- | --- | --- | --- |
| One-click payment | ✓ | Partial (identify only) | ✓ |
| Works offline / without Google | ✓ | ✓ (via wallet too) | — |
| No seed phrase for the customer | — | ✓ | ✓ |
| No customer wallet at all | — | — | ✓ |
| Settles to merchant wallet | ✓ | ✓ | ✓ |
| Exact-amount on-chain enforcement | ✓ | ✓ | ✓ |
| Refundable | soon | soon | soon |

---

## Architecture

```text
near-business-manager/
├── contracts/near-business/
│   ├── src/lib.rs              # contract: data model, methods, events, unit tests
│   ├── tests/test_basics.rs    # sandbox integration test
│   └── Cargo.toml
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # shell: header, mode switch, navigation, routing by tab
│   │   ├── pages/              # Onboarding, Overview, Invoices, Customers, Products, Settings
│   │   ├── components/         # Icon set and shared UI (stat cards, badges, modal, empty states)
│   │   ├── seed.ts             # sample workspace used by the demo
│   │   ├── near.ts             # wallet selector + RPC + typed contract calls
│   │   ├── demoStore.ts        # local engine mirroring the contract rules
│   │   ├── money.ts            # yoctoNEAR <-> NEAR formatting
│   │   ├── appTypes.ts         # UI-level types
│   │   ├── types.ts            # shared domain types
│   │   └── styles.css          # light design system
│   ├── index.html
│   ├── tsconfig.json
│   └── vite.config.ts
├── .github/workflows/deploy.yml # GitHub Pages deployment
└── README.md
```

**Stack**

| Layer | Technology |
| --- | --- |
| Smart contract | Rust + `near-sdk 5.30` |
| Network | NEAR testnet |
| Frontend | React 18, TypeScript, Vite 5 |
| Wallet | `@near-wallet-selector` (MyNearWallet, Meteor, HERE, Nightly, Sender) |
| Reads | NEAR JSON-RPC view calls |
| Hosting | GitHub Pages |

---

## Data model

```rust
Business   { name, handle, email, currency, tax_bps, created_at }
Customer   { id, name, email, created_at }
Product    { id, name, price /* yoctoNEAR */, active }
InvoiceItem{ description, quantity, unit_price, amount }
Invoice    { id, customer_id, items, subtotal, tax, total,
             status, created_at, due_date, paid_at }
Dashboard  { business, customers, products, invoices, revenue,
             next_customer_id, next_product_id, next_invoice_id }
```

- Money is stored as **yoctoNEAR** (`1 NEAR = 10^24 yoctoNEAR`) inside `U128` JSON wrappers.
- `tax_bps` is basis points: `1500 = 15%`. Tax is `subtotal * tax_bps / 10_000`.
- One `Dashboard` per account, keyed by `AccountId`.
- Invoice status: `Draft`, `Sent`, `Paid`, `Cancelled`.

---

## Contract API

### Writes

| Method | Deposit | Description |
| --- | --- | --- |
| `new()` | — | Initialize the contract. |
| `create_business(name, handle, email, currency, tax_bps)` | — | Create the caller's dashboard. |
| `update_business(name, handle, email, currency, tax_bps)` | — | Update the profile. |
| `add_customer(name, email)` | — | Add a customer. |
| `update_customer(customer_id, name, email)` | — | Edit a customer. |
| `remove_customer(customer_id)` | — | Delete a customer. |
| `add_product(name, price)` | — | Add a product/service. |
| `update_product(product_id, name, price, active)` | — | Edit or archive a product. |
| `remove_product(product_id)` | — | Delete a product. |
| `create_invoice(customer_id, items, due_days)` | — | Create an invoice; totals computed on-chain. |
| `set_invoice_status(invoice_id, status)` | — | Move draft → sent, or cancel. |
| `pay_invoice(owner_id, invoice_id)` | `total` | Pay a sent/draft invoice; funds forwarded to owner. |

### Views

| Method | Returns |
| --- | --- |
| `get_dashboard(account_id)` | Full `Dashboard` or `null` |
| `get_business(account_id)` | `Business` or `null` |
| `has_business(account_id)` | `bool` |
| `list_customers(account_id)` | `Customer[]` |
| `list_products(account_id)` | `Product[]` |
| `list_invoices(account_id)` | `Invoice[]` |
| `get_invoice(account_id, invoice_id)` | `Invoice` or `null` |
| `get_stats(account_id)` | `{ customers, products, invoices, paid_invoices, open_invoices, revenue, outstanding }` |

### Events (NEP-297 style)

```json
EVENT_JSON:{"standard":"nep297","version":"1.0.0","event":"invoice_paid","data":[{"owner":"shop.testnet","invoice_id":1,"payer":"client.testnet","amount":"1150000000000000000000000"}]}
```

---

## Run locally

**Requirements:** Node.js 20+, Rust, `wasm32-unknown-unknown` target (for a local contract build).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # optional: point at another contract
npm run dev
```

Open <http://localhost:3000>. The app starts in demo mode; switch to NEAR testnet in the header to
connect a wallet.

```bash
npm run build             # production build in frontend/dist
npm run preview
```

### Contract

```bash
cd contracts/near-business/near_business
cargo test                                  # 6 unit tests
cargo build --target wasm32-unknown-unknown --release
```

The wasm is written to
`target/wasm32-unknown-unknown/release/near_business.wasm`.

---

## Deploy your own

```bash
# 1. create a testnet account (or use an existing one)
near account create-account fund-myself my-business.testnet '5 NEAR' \
  autogenerate-new-keypair save-to-legacy-keychain \
  sign-as <funder.testnet> network-config testnet sign-with-keychain send

# 2. deploy + initialize
near contract deploy my-business.testnet \
  use-file target/wasm32-unknown-unknown/release/near_business.wasm \
  with-init-call new json-args '{}' \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config testnet sign-with-keychain send

# 3. point the frontend at it
cd ../../../frontend
echo 'VITE_CONTRACT_ID=my-business.testnet' > .env
npm run build
```

---

## Tests

```bash
cd contracts/near-business/near_business
cargo test --lib
```

```text
running 6 tests
test tests::creates_business_and_customer ... ok
test tests::rejects_duplicate_business ... ok
test tests::invoice_totals_apply_tax ... ok
test tests::pays_invoice_and_tracks_revenue ... ok
test tests::rejects_wrong_payment_amount ... ok
test tests::stats_count_open_invoices ... ok

test result: ok. 6 passed; 0 failed
```

Coverage includes: business creation, duplicate protection, tax math, revenue tracking, exact
payment enforcement and open-invoice analytics. A sandbox integration test
(`tests/test_basics.rs`) deploys the wasm to a local NEAR sandbox and exercises the contract over
real transactions.

---

## Hackathon track alignment

| Track | How this project qualifies |
| --- | --- |
| **Real world** | A working back-office for online businesses: customers, catalogue, invoicing and settlement. |
| **DeFi** | Native NEAR payments with exact-amount enforcement, revenue accounting and outstanding balances. |
| **Web2 onboarding** | Optional *Sign in with Google* guest checkout on the payment link, powered by NEAR Auth / Auth0 (testnet) — no seed phrase needed to identify the payer. |
| **Privacy** | Roadmap: confidential invoice amounts and customer identities using the commitment pattern from [`near-privacy-bridge`](https://github.com/Aryann-4/NEAR-privacy-bridge). |

---

## Security notes and limitations

- **Testnet only.** The contract has not been audited and is not deployed to mainnet.
- **One dashboard per account.** Multi-business support would key dashboards by `owner + business_id`.
- **Payments are pull-based by invoice total.** The payer must attach the exact total; partial
  payments are rejected. A production version should support partial payments and refunds.
- **Customer records are public** on-chain. Confidential customer data needs encryption or a
  commitment scheme.
- **The demo engine is not the contract.** Demo mode mirrors the rules in `demoStore.ts` for a
  wallet-free experience. Live mode always reads and writes the deployed contract.
- **Guest checkout = identifying, not paying, with Google.** The checkout page's *Sign in with Google*
  button is a real NEAR Auth (Auth0) login that only works on `http://localhost:3000` — the one
  callback origin the shared testnet client trusts. Even locally, the browser SDK can't derive
  universal accounts yet, so settlement still signs via the customer's wallet. To own your origin,
  set `VITE_FAST_AUTH_CLIENT_ID` at build time. See [Payments and guest checkout](#payments-and-guest-checkout).
- **Payment links reveal the invoice.** `?pay=<owner>:<invoiceId>` exposes the invoice id and amounts
  (invoices are public on-chain regardless). Treat the link as an identifier and avoid sharing it publicly.
- **Reliance on the indexer-free RPC.** Views use `rpc.testnet.near.org`; a production app should
  add failover RPCs.

---

## Roadmap

1. **Done** — contract, unit tests, testnet deployment, demo + live frontend, GitHub Pages demo.
   Payment links with a customer-facing checkout page, lazy-loaded Google sign-in via NEAR Auth
   (testnet) as guest identification, one-click payment that settles on-chain.
2. **Next** — full one-tap guest checkout: Google sign-in → NEP-366 meta-transaction → NEAR
   Universal Account auto-creation (needs relayer-assisted account creation), partial payments,
   refunds, PDF export.
3. **Then** — private invoices (commitments), multi-business workspaces, recurring invoices,
   multi-token payments (NEP-141 stablecoins), analytics charts, email notifications.
4. **Later** — mainnet hardening, NEAR Fast Auth production credentials, external audit.

---

## License

MIT
