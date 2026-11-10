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
- Product/service catalogue with archive + delete.
- Invoice builder with multiple line items, live totals and automatic tax.
- Invoice lifecycle: **Draft → Sent → Paid**, or **Cancelled**.
- One-click payment in NEAR from the UI.
- Dashboard analytics: revenue, outstanding, customer count, invoice counts.
- Responsive dark UI with an onboarding flow and a seeded sample workspace.

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
  [NEAR Wallet Selector](https://github.com/near/wallet-selector) (MyNearWallet).
- Money is handled as `u128` yoctoNEAR strings end-to-end; the UI formats to NEAR.
- Vite + React + TypeScript, no UI framework lock-in.

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
│   │   ├── App.tsx             # dashboard UI (overview, invoices, customers, products, settings)
│   │   ├── near.ts             # wallet selector + RPC + typed contract calls
│   │   ├── demoStore.ts        # local engine mirroring the contract rules
│   │   ├── money.ts            # yoctoNEAR <-> NEAR formatting
│   │   ├── types.ts            # shared types
│   │   └── styles.css          # design system
│   ├── index.html
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
| Wallet | `@near-wallet-selector` (MyNearWallet) |
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

Open <http://localhost:5173>. The app starts in demo mode; switch to NEAR testnet in the header to
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
- **Reliance on the indexer-free RPC.** Views use `rpc.testnet.near.org`; a production app should
  add failover RPCs.

---

## Roadmap

1. **Done** — contract, unit tests, testnet deployment, demo + live frontend, GitHub Pages demo.
2. **Next** — payment links per invoice, partial payments, refunds, PDF export.
3. **Then** — private invoices (commitments), multi-business workspaces, recurring invoices,
   analytics charts, email notifications.
4. **Later** — mainnet hardening and an external audit.

---

## License

MIT
