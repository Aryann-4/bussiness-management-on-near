use near_api::AccountId;
use near_sdk::serde_json::json;

#[derive(near_sdk::serde::Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Business {
    pub name: String,
    pub handle: String,
    pub tax_bps: u16,
}

async fn test_basics_on(contract_wasm: Vec<u8>) -> testresult::TestResult<()> {
    let sandbox = near_sandbox::Sandbox::start_sandbox().await?;
    let sandbox_network =
        near_api::NetworkConfig::from_rpc_url("sandbox", sandbox.rpc_addr.parse()?);

    let owner = create_subaccount(&sandbox, "owner.sandbox").await?;
    let contract = create_subaccount(&sandbox, "contract.sandbox")
        .await?
        .as_contract();

    let signer = near_api::Signer::from_secret_key(
        near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY
            .parse()
            .unwrap(),
    )?;

    near_api::Contract::deploy(contract.account_id().clone())
        .use_code(contract_wasm)
        .with_init_call("new", json!({}))?
        .with_signer(signer.clone())
        .send_to(&sandbox_network)
        .await?
        .assert_success();

    contract
        .call_function(
            "create_business",
            json!({
                "name": "Acme Studio",
                "handle": "acme",
                "email": "hi@acme.test",
                "currency": "NEAR",
                "tax_bps": 1500
            }),
        )
        .transaction()
        .with_signer(owner.account_id().clone(), signer.clone())
        .send_to(&sandbox_network)
        .await?
        .assert_success();

    let business: Business = contract
        .call_function("get_business", json!({ "account_id": owner.account_id() }))
        .read_only()
        .fetch_from(&sandbox_network)
        .await?
        .data;

    assert_eq!(business.name, "Acme Studio");
    assert_eq!(business.handle, "acme");
    assert_eq!(business.tax_bps, 1500);

    let stats: near_sdk::serde_json::Value = contract
        .call_function("get_stats", json!({ "account_id": owner.account_id() }))
        .read_only()
        .fetch_from(&sandbox_network)
        .await?
        .data;
    assert_eq!(stats["customers"], 0);
    assert_eq!(stats["invoices"], 0);

    let _: AccountId = owner.account_id().clone();
    Ok(())
}

async fn create_subaccount(
    sandbox: &near_sandbox::Sandbox,
    name: &str,
) -> testresult::TestResult<near_api::Account> {
    let account_id: AccountId = name.parse().unwrap();
    sandbox
        .create_account(account_id.clone().as_str().parse()?)
        .initial_balance(near_api::NearToken::from_near(10))
        .send()
        .await?;
    Ok(near_api::Account(account_id))
}

#[tokio::test]
async fn test_contract_is_operational() -> testresult::TestResult<()> {
    let contract_wasm_path = cargo_near_build::build_with_cli(Default::default())?;
    let contract_wasm = std::fs::read(contract_wasm_path)?;
    test_basics_on(contract_wasm).await
}
