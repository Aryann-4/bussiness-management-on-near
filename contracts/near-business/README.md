# NEAR Business Manager — contract

Rust smart contract (`near-sdk 5.30`) for the NEAR Business Manager app.

One `Dashboard` per NEAR account holds a business profile, customers, products and
invoices. Invoices are paid in NEAR; the contract validates that the attached
deposit equals the invoice total and forwards the funds to the business owner.

## Layout

```text
src/lib.rs            data model, methods, NEP-297 events, unit tests
tests/test_basics.rs  sandbox integration test
```

## Build and test

```bash
cargo test --lib
cargo build --target wasm32-unknown-unknown --release
```

The wasm lands in `target/wasm32-unknown-unknown/release/near_business.wasm`.

## Deploy

```bash
near contract deploy <account>.testnet \
  use-file target/wasm32-unknown-unknown/release/near_business.wasm \
  with-init-call new json-args '{}' \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config testnet sign-with-keychain send
```

The live deployment used by the demo is `near-business-manager.testnet`.
