//! NEAR Business Manager — on-chain operations for online businesses.
//!
//! Each NEAR account owns one dashboard containing a business profile,
//! customers, products/services and invoices. Invoices are paid in NEAR and
//! funds are forwarded to the business owner in the same transaction.

use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise, Timestamp};
use near_sdk::store::LookupMap;

const EVENT_JSON: &str = "EVENT_JSON:";
const BPS_DENOMINATOR: u128 = 10_000;

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Business {
    pub name: String,
    pub handle: String,
    pub email: String,
    pub currency: String,
    /// Tax rate in basis points (e.g. 1500 = 15%).
    pub tax_bps: u16,
    pub created_at: Timestamp,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Customer {
    pub id: u32,
    pub name: String,
    pub email: String,
    pub created_at: Timestamp,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Product {
    pub id: u32,
    pub name: String,
    /// Unit price in yoctoNEAR.
    pub price: U128,
    pub active: bool,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct InvoiceItem {
    pub description: String,
    pub quantity: u64,
    /// Unit price in yoctoNEAR.
    pub unit_price: U128,
    /// quantity * unit_price in yoctoNEAR.
    pub amount: U128,
}

/// Input shape used when creating an invoice (amount is computed on-chain).
#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct InvoiceItemInput {
    pub description: String,
    pub quantity: u64,
    pub unit_price: U128,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub enum InvoiceStatus {
    Draft,
    Sent,
    Paid,
    Cancelled,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Invoice {
    pub id: u32,
    pub customer_id: u32,
    pub items: Vec<InvoiceItem>,
    pub subtotal: U128,
    pub tax: U128,
    pub total: U128,
    pub status: InvoiceStatus,
    pub created_at: Timestamp,
    pub due_date: Timestamp,
    pub paid_at: Option<Timestamp>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Stats {
    pub customers: u32,
    pub products: u32,
    pub invoices: u32,
    pub paid_invoices: u32,
    pub open_invoices: u32,
    /// Lifetime revenue in yoctoNEAR.
    pub revenue: U128,
    /// Outstanding amount on sent/draft invoices in yoctoNEAR.
    pub outstanding: U128,
}

/// Everything owned by a single NEAR account.
#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Dashboard {
    pub business: Business,
    pub customers: Vec<Customer>,
    pub products: Vec<Product>,
    pub invoices: Vec<Invoice>,
    pub revenue: U128,
    pub next_customer_id: u32,
    pub next_product_id: u32,
    pub next_invoice_id: u32,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    dashboards: LookupMap<AccountId, Dashboard>,
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            dashboards: LookupMap::new(b"d"),
        }
    }

    // -- business profile ---------------------------------------------------

    /// Create the caller's business profile. One dashboard per account.
    pub fn create_business(
        &mut self,
        name: String,
        handle: String,
        email: String,
        currency: String,
        tax_bps: u16,
    ) -> Dashboard {
        let owner = env::predecessor_account_id();
        require!(!name.trim().is_empty(), "Business name is required");
        require!(tax_bps <= 5_000, "Tax cannot exceed 50%");
        require!(
            self.dashboards.get(&owner).is_none(),
            "Business already exists for this account"
        );

        let dashboard = Dashboard {
            business: Business {
                name: name.trim().to_string(),
                handle: handle.trim().to_lowercase(),
                email: email.trim().to_string(),
                currency: if currency.trim().is_empty() {
                    "NEAR".to_string()
                } else {
                    currency.trim().to_uppercase()
                },
                tax_bps,
                created_at: env::block_timestamp(),
            },
            customers: Vec::new(),
            products: Vec::new(),
            invoices: Vec::new(),
            revenue: U128(0),
            next_customer_id: 1,
            next_product_id: 1,
            next_invoice_id: 1,
        };

        self.dashboards.insert(owner.clone(), dashboard.clone());
        log_event(
            "business_created",
            format!(
                r#"{{"account":"{}","name":"{}","handle":"{}"}}"#,
                owner, dashboard.business.name, dashboard.business.handle
            ),
        );
        dashboard
    }

    pub fn update_business(
        &mut self,
        name: String,
        handle: String,
        email: String,
        currency: String,
        tax_bps: u16,
    ) -> Dashboard {
        let owner = env::predecessor_account_id();
        let mut dashboard = self.dashboard_of(&owner);
        require!(!name.trim().is_empty(), "Business name is required");
        require!(tax_bps <= 5_000, "Tax cannot exceed 50%");

        dashboard.business.name = name.trim().to_string();
        dashboard.business.handle = handle.trim().to_lowercase();
        dashboard.business.email = email.trim().to_string();
        dashboard.business.currency = currency.trim().to_uppercase();
        dashboard.business.tax_bps = tax_bps;

        self.dashboards.insert(owner.clone(), dashboard.clone());
        dashboard
    }

    pub fn get_dashboard(&self, account_id: AccountId) -> Option<Dashboard> {
        self.dashboards.get(&account_id).cloned()
    }

    pub fn get_business(&self, account_id: AccountId) -> Option<Business> {
        self.dashboards.get(&account_id).map(|d| d.business.clone())
    }

    pub fn has_business(&self, account_id: AccountId) -> bool {
        self.dashboards.get(&account_id).is_some()
    }

    // -- customers ----------------------------------------------------------

    pub fn add_customer(&mut self, name: String, email: String) -> Customer {
        let owner = env::predecessor_account_id();
        let mut dashboard = self.dashboard_of(&owner);
        require!(!name.trim().is_empty(), "Customer name is required");

        let customer = Customer {
            id: dashboard.next_customer_id,
            name: name.trim().to_string(),
            email: email.trim().to_string(),
            created_at: env::block_timestamp(),
        };
        dashboard.next_customer_id += 1;
        dashboard.customers.push(customer.clone());
        self.dashboards.insert(owner.clone(), dashboard);

        log_event(
            "customer_added",
            format!(
                r#"{{"account":"{}","customer_id":{},"name":"{}"}}"#,
                owner, customer.id, customer.name
            ),
        );
        customer
    }

    pub fn update_customer(&mut self, customer_id: u32, name: String, email: String) -> Customer {
        let owner = env::predecessor_account_id();
        let mut dashboard = self.dashboard_of(&owner);
        let index = dashboard
            .customers
            .iter()
            .position(|c| c.id == customer_id)
            .unwrap_or_else(|| env::panic_str("Customer not found"));

        let customer = &mut dashboard.customers[index];
        require!(!name.trim().is_empty(), "Customer name is required");
        customer.name = name.trim().to_string();
        customer.email = email.trim().to_string();
        let updated = customer.clone();

        self.dashboards.insert(owner.clone(), dashboard);
        updated
    }

    pub fn remove_customer(&mut self, customer_id: u32) {
        let owner = env::predecessor_account_id();
        let mut dashboard = self.dashboard_of(&owner);
        let before = dashboard.customers.len();
        dashboard.customers.retain(|c| c.id != customer_id);
        require!(dashboard.customers.len() != before, "Customer not found");
        self.dashboards.insert(owner.clone(), dashboard);
    }

    pub fn list_customers(&self, account_id: AccountId) -> Vec<Customer> {
        self.dashboards
            .get(&account_id)
            .map(|d| d.customers.clone())
            .unwrap_or_default()
    }

    // -- products / services ------------------------------------------------

    pub fn add_product(&mut self, name: String, price: U128) -> Product {
        let owner = env::predecessor_account_id();
        let mut dashboard = self.dashboard_of(&owner);
        require!(!name.trim().is_empty(), "Product name is required");

        let product = Product {
            id: dashboard.next_product_id,
            name: name.trim().to_string(),
            price,
            active: true,
        };
        dashboard.next_product_id += 1;
        dashboard.products.push(product.clone());
        self.dashboards.insert(owner.clone(), dashboard);

        log_event(
            "product_added",
            format!(
                r#"{{"account":"{}","product_id":{},"name":"{}"}}"#,
                owner, product.id, product.name
            ),
        );
        product
    }

    pub fn update_product(&mut self, product_id: u32, name: String, price: U128, active: bool) -> Product {
        let owner = env::predecessor_account_id();
        let mut dashboard = self.dashboard_of(&owner);
        let index = dashboard
            .products
            .iter()
            .position(|p| p.id == product_id)
            .unwrap_or_else(|| env::panic_str("Product not found"));

        let product = &mut dashboard.products[index];
        require!(!name.trim().is_empty(), "Product name is required");
        product.name = name.trim().to_string();
        product.price = price;
        product.active = active;
        let updated = product.clone();

        self.dashboards.insert(owner.clone(), dashboard);
        updated
    }

    pub fn remove_product(&mut self, product_id: u32) {
        let owner = env::predecessor_account_id();
        let mut dashboard = self.dashboard_of(&owner);
        let before = dashboard.products.len();
        dashboard.products.retain(|p| p.id != product_id);
        require!(dashboard.products.len() != before, "Product not found");
        self.dashboards.insert(owner.clone(), dashboard);
    }

    pub fn list_products(&self, account_id: AccountId) -> Vec<Product> {
        self.dashboards
            .get(&account_id)
            .map(|d| d.products.clone())
            .unwrap_or_default()
    }

    // -- invoices -----------------------------------------------------------

    pub fn create_invoice(
        &mut self,
        customer_id: u32,
        items: Vec<InvoiceItemInput>,
        due_days: u32,
    ) -> Invoice {
        let owner = env::predecessor_account_id();
        let mut dashboard = self.dashboard_of(&owner);
        require!(!items.is_empty(), "Invoice needs at least one line item");
        require!(
            dashboard.customers.iter().any(|c| c.id == customer_id),
            "Customer not found"
        );

        let mut subtotal: u128 = 0;
        let mut stored_items = Vec::with_capacity(items.len());
        for input in items {
            require!(input.quantity > 0, "Quantity must be positive");
            require!(!input.description.trim().is_empty(), "Item description required");
            let amount = input
                .unit_price
                .0
                .checked_mul(input.quantity as u128)
                .unwrap_or_else(|| env::panic_str("Amount overflow"));
            subtotal = subtotal
                .checked_add(amount)
                .unwrap_or_else(|| env::panic_str("Subtotal overflow"));
            stored_items.push(InvoiceItem {
                description: input.description.trim().to_string(),
                quantity: input.quantity,
                unit_price: input.unit_price,
                amount: U128(amount),
            });
        }

        let tax = subtotal * dashboard.business.tax_bps as u128 / BPS_DENOMINATOR;
        let total = subtotal + tax;
        let now = env::block_timestamp();
        let due_date = now + (due_days as u64) * 24 * 60 * 60 * 1_000_000_000;

        let invoice = Invoice {
            id: dashboard.next_invoice_id,
            customer_id,
            items: stored_items,
            subtotal: U128(subtotal),
            tax: U128(tax),
            total: U128(total),
            status: InvoiceStatus::Draft,
            created_at: now,
            due_date,
            paid_at: None,
        };
        dashboard.next_invoice_id += 1;
        dashboard.invoices.push(invoice.clone());
        self.dashboards.insert(owner.clone(), dashboard);

        log_event(
            "invoice_created",
            format!(
                r#"{{"account":"{}","invoice_id":{},"customer_id":{},"total":"{}"}}"#,
                owner, invoice.id, customer_id, total
            ),
        );
        invoice
    }

    pub fn set_invoice_status(&mut self, invoice_id: u32, status: InvoiceStatus) -> Invoice {
        let owner = env::predecessor_account_id();
        let mut dashboard = self.dashboard_of(&owner);
        let index = dashboard
            .invoices
            .iter()
            .position(|i| i.id == invoice_id)
            .unwrap_or_else(|| env::panic_str("Invoice not found"));
        require!(
            dashboard.invoices[index].status != InvoiceStatus::Paid,
            "Paid invoices cannot change status"
        );
        dashboard.invoices[index].status = status;
        let updated = dashboard.invoices[index].clone();
        self.dashboards.insert(owner.clone(), dashboard);
        updated
    }

    /// Pay an invoice. The attached deposit must equal the invoice total and is
    /// forwarded to the business owner.
    #[payable]
    pub fn pay_invoice(&mut self, owner_id: AccountId, invoice_id: u32) -> Invoice {
        let payer = env::predecessor_account_id();
        let mut dashboard = self.dashboard_of(&owner_id);
        let index = dashboard
            .invoices
            .iter()
            .position(|i| i.id == invoice_id)
            .unwrap_or_else(|| env::panic_str("Invoice not found"));

        require!(
            dashboard.invoices[index].status != InvoiceStatus::Paid,
            "Invoice already paid"
        );
        require!(
            dashboard.invoices[index].status != InvoiceStatus::Cancelled,
            "Invoice was cancelled"
        );

        let total = dashboard.invoices[index].total.0;
        let attached = env::attached_deposit();
        require!(
            attached == NearToken::from_yoctonear(total),
            "Attached deposit must equal the invoice total"
        );

        dashboard.invoices[index].status = InvoiceStatus::Paid;
        dashboard.invoices[index].paid_at = Some(env::block_timestamp());
        dashboard.revenue = U128(dashboard.revenue.0 + total);
        let paid = dashboard.invoices[index].clone();
        self.dashboards.insert(owner_id.clone(), dashboard);

        log_event(
            "invoice_paid",
            format!(
                r#"{{"owner":"{}","invoice_id":{},"payer":"{}","amount":"{}"}}"#,
                owner_id, invoice_id, payer, total
            ),
        );

        let _ = Promise::new(owner_id).transfer(NearToken::from_yoctonear(total));
        paid
    }

    pub fn get_invoice(&self, account_id: AccountId, invoice_id: u32) -> Option<Invoice> {
        self.dashboards
            .get(&account_id)
            .and_then(|d| d.invoices.iter().find(|i| i.id == invoice_id).cloned())
    }

    pub fn list_invoices(&self, account_id: AccountId) -> Vec<Invoice> {
        self.dashboards
            .get(&account_id)
            .map(|d| d.invoices.clone())
            .unwrap_or_default()
    }

    // -- analytics ----------------------------------------------------------

    pub fn get_stats(&self, account_id: AccountId) -> Stats {
        let Some(d) = self.dashboards.get(&account_id) else {
            return Stats {
                customers: 0,
                products: 0,
                invoices: 0,
                paid_invoices: 0,
                open_invoices: 0,
                revenue: U128(0),
                outstanding: U128(0),
            };
        };

        let mut paid_invoices = 0u32;
        let mut open_invoices = 0u32;
        let mut outstanding: u128 = 0;
        for invoice in &d.invoices {
            match invoice.status {
                InvoiceStatus::Paid => paid_invoices += 1,
                InvoiceStatus::Cancelled => {}
                _ => {
                    open_invoices += 1;
                    outstanding += invoice.total.0;
                }
            }
        }

        Stats {
            customers: d.customers.len() as u32,
            products: d.products.len() as u32,
            invoices: d.invoices.len() as u32,
            paid_invoices,
            open_invoices,
            revenue: d.revenue,
            outstanding: U128(outstanding),
        }
    }

    // -- internal -----------------------------------------------------------

    fn dashboard_of(&self, owner: &AccountId) -> Dashboard {
        self.dashboards
            .get(owner)
            .cloned()
            .unwrap_or_else(|| env::panic_str("Create a business profile first"))
    }
}

fn log_event(kind: &str, data: String) {
    env::log_str(&format!(
        r#"{} {{"standard":"nep297","version":"1.0.0","event":"{}","data":[{}]}}"#,
        EVENT_JSON, kind, data
    ));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, AccountId};

    fn context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor.clone())
            .predecessor_account_id(predecessor);
        builder
    }

    fn setup() -> (Contract, AccountId) {
        let owner: AccountId = "shop.testnet".parse().unwrap();
        testing_env!(context(owner.clone()).build());
        let contract = Contract::new();
        (contract, owner)
    }

    fn create_business(contract: &mut Contract) {
        contract.create_business(
            "Acme Studio".into(),
            "acme".into(),
            "hi@acme.test".into(),
            "NEAR".into(),
            1500,
        );
    }

    #[test]
    fn creates_business_and_customer() {
        let (mut contract, owner) = setup();
        create_business(&mut contract);
        contract.add_customer("Ada".into(), "ada@example.com".into());

        let dashboard = contract.get_dashboard(owner).unwrap();
        assert_eq!(dashboard.business.name, "Acme Studio");
        assert_eq!(dashboard.business.handle, "acme");
        assert_eq!(dashboard.customers.len(), 1);
        assert_eq!(dashboard.customers[0].name, "Ada");
    }

    #[test]
    #[should_panic(expected = "already exists")]
    fn rejects_duplicate_business() {
        let (mut contract, _) = setup();
        create_business(&mut contract);
        create_business(&mut contract);
    }

    #[test]
    fn invoice_totals_apply_tax() {
        let (mut contract, owner) = setup();
        create_business(&mut contract);
        let customer = contract.add_customer("Ada".into(), "ada@example.com".into());

        let invoice = contract.create_invoice(
            customer.id,
            vec![
                InvoiceItemInput {
                    description: "Design".into(),
                    quantity: 2,
                    unit_price: U128(100_000_000_000_000_000_000_000),
                },
                InvoiceItemInput {
                    description: "Hosting".into(),
                    quantity: 1,
                    unit_price: U128(50_000_000_000_000_000_000_000),
                },
            ],
            30,
        );

        assert_eq!(invoice.subtotal.0, 250_000_000_000_000_000_000_000);
        assert_eq!(invoice.tax.0, 37_500_000_000_000_000_000_000); // 15%, integer division
        assert_eq!(invoice.total.0, 287_500_000_000_000_000_000_000);

        let dashboard = contract.get_dashboard(owner).unwrap();
        assert_eq!(dashboard.invoices.len(), 1);
        assert_eq!(dashboard.next_invoice_id, 2);
    }

    #[test]
    fn pays_invoice_and_tracks_revenue() {
        let (mut contract, owner) = setup();
        create_business(&mut contract);
        let customer = contract.add_customer("Ada".into(), "ada@example.com".into());
        let invoice = contract.create_invoice(
            customer.id,
            vec![InvoiceItemInput {
                description: "Consulting".into(),
                quantity: 1,
                unit_price: U128(1_000_000_000_000_000_000_000_000),
            }],
            14,
        );

        let payer: AccountId = "client.testnet".parse().unwrap();
        let mut ctx = context(payer);
        ctx.attached_deposit(NearToken::from_yoctonear(invoice.total.0));
        testing_env!(ctx.build());

        let paid = contract.pay_invoice(owner.clone(), invoice.id);
        assert_eq!(paid.status, InvoiceStatus::Paid);
        assert!(paid.paid_at.is_some());

        let stats = contract.get_stats(owner);
        assert_eq!(stats.paid_invoices, 1);
        assert_eq!(stats.open_invoices, 0);
        assert_eq!(stats.revenue.0, invoice.total.0);
    }

    #[test]
    #[should_panic(expected = "must equal the invoice total")]
    fn rejects_wrong_payment_amount() {
        let (mut contract, owner) = setup();
        create_business(&mut contract);
        let customer = contract.add_customer("Ada".into(), "ada@example.com".into());
        let invoice = contract.create_invoice(
            customer.id,
            vec![InvoiceItemInput {
                description: "Item".into(),
                quantity: 1,
                unit_price: U128(100),
            }],
            7,
        );

        let mut ctx = context("client.testnet".parse().unwrap());
        ctx.attached_deposit(NearToken::from_yoctonear(invoice.total.0 - 1));
        testing_env!(ctx.build());
        contract.pay_invoice(owner, invoice.id);
    }

    #[test]
    fn stats_count_open_invoices() {
        let (mut contract, owner) = setup();
        create_business(&mut contract);
        let customer = contract.add_customer("Ada".into(), "ada@example.com".into());
        contract.create_invoice(
            customer.id,
            vec![InvoiceItemInput {
                description: "Item".into(),
                quantity: 3,
                unit_price: U128(10),
            }],
            7,
        );

        let stats = contract.get_stats(owner);
        assert_eq!(stats.invoices, 1);
        assert_eq!(stats.open_invoices, 1);
        assert_eq!(stats.outstanding.0, 34); // 30 + 4 tax
    }
}
