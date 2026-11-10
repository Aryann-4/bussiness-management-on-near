import React, { useState, useEffect } from "react";
import { Near, Account } from "near-api-js";

const nearConfig = {
  networkId: "testnet",
  nodeUrl: "https://rpc.testnet.near.org",
  walletUrl: "https://wallet.testnet.near.org",
  helperUrl: "https://explorer.testnet.near.org",
  apiUrl: "https://api.testnet.near.org",
  contractName: "near-business-manager.testnet",
};

const near = new Near(nearConfig);

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Not connected");
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  useEffect(() => {
    const checkStatus = async () => {
      const s = await near.connection.status();
      setStatus(s.status);
      setHasLoaded(true);
    };
    checkStatus();

    near.connection.on("status_change", (newStatus: string) => {
      setStatus(newStatus);
    });
  }, []);

  const connectWallet = async () => {
    try {
      const accountId = await near.wallet.requestAccounts();
      const account = accountId[0];
      setAccount(account);
      setHasLoaded(true);
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>🏢 NEAR Business Manager</h1>
      
      <div style={{ marginBottom: "1rem", padding: "1rem", background: "#f0f9ff", borderRadius: "8px" }}>
        <strong>Status:</strong> {status}
        {account && <span style={{ marginLeft: "2rem" }}>| Connected: {account}</span>}
      </div>
      
      <div style={{ marginBottom: "1rem" }}>
        {account ? (
          <>
            <button onClick={() => alert("Create Business")} style={{ padding: "0.5rem 1rem", marginRight: "0.5rem" }}>
              Create Business
            </button>
            <button onClick={() => alert("Create Invoice")} style={{ padding: "0.5rem 1rem" }}>
              Create Invoice
            </button>
          </>
        ) : (
          <button onClick={connectWallet} style={{ padding: "0.5rem 1rem" }}>
            Connect Wallet
          </button>
        )}
      </div>
      
      {hasLoaded && (
        <div style={{ marginTop: "2rem", borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
          <h2>Business Management on NEAR</h2>
          <p>Connect your NEAR wallet to manage businesses, create invoices, and process payments.</p>
          <p>This is a hackathon submission for NEAR Hackathon 2026.</p>
        </div>
      )}
    </div>
  );
}

export default App;