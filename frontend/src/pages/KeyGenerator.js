import React, { useState, useEffect } from "react";
import { Alert, Button } from "../components/UI";
import { connectMetaMaskWallet } from "../utils/web3";

const CONTRACT_ADDRESS = "0xCa70e753D2DFcd32532Fb3f236B66c9494F01330";
const INSTITUTE_ADDRESS = "0x8A8edFB602AA8D7479160bC42815B6271d4B70B3";

export default function KeyGenerator() {
  const [connectedWallet, setConnectedWallet] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    // Auto-detect if MetaMask is already connected
    if (window.ethereum?.selectedAddress) {
      setConnectedWallet(window.ethereum.selectedAddress);
    }
  }, []);

  async function handleConnect() {
    setError("");
    setConnecting(true);
    try {
      const address = await connectMetaMaskWallet();
      setConnectedWallet(address);
    } catch (err) {
      setError(err.message || "Failed to connect to MetaMask.");
    } finally {
      setConnecting(false);
    }
  }

  function copy(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <div className="page keys-page" style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem" }}>
      <div className="page-header" style={{ marginBottom: "2rem" }}>
        <div>
          <span className="eyebrow">Public Blockchain Infrastructure</span>
          <h1>Ethereum Sepolia Network & Wallets</h1>
          <p className="lead">
            CertChain runs natively on the <strong>Ethereum Sepolia Testnet</strong>. Every stakeholder interacts using authentic cryptographic EVM accounts managed via MetaMask or hardware wallets.
          </p>
        </div>
      </div>

      {error && <Alert style={{ marginBottom: "1.5rem" }}>{error}</Alert>}

      {/* 1. Connect MetaMask Account */}
      <div className="card card-pad" style={{ marginBottom: "2rem", borderLeft: "5px solid #3b82f6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h3 style={{ margin: 0 }}>🦊 Your MetaMask Sepolia Wallet</h3>
            <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
              {connectedWallet
                ? "Connected to Ethereum Sepolia (Chain ID: 11155111)"
                : "Connect your personal MetaMask wallet to view your on-chain identity"}
            </p>
          </div>
          <Button onClick={handleConnect} loading={connecting}>
            {connecting ? "Connecting..." : connectedWallet ? "🦊 Re-Connect Wallet" : "🦊 Connect MetaMask (Sepolia)"}
          </Button>
        </div>

        {connectedWallet && (
          <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <span className="meta-label">Connected Sepolia Public Address</span>
                <strong style={{ fontFamily: "monospace", fontSize: "0.95rem", wordBreak: "break-all" }}>
                  {connectedWallet}
                </strong>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                  onClick={() => copy(connectedWallet, "user")}
                >
                  {copied === "user" ? "✓ Copied!" : "📋 Copy"}
                </button>
                <a
                  href={`https://sepolia.etherscan.io/address/${connectedWallet}`}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-secondary"
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                >
                  🔍 View on Etherscan ↗
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. On-Chain Smart Contract Details */}
      <div className="card card-pad" style={{ marginBottom: "2rem" }}>
        <h3 style={{ marginTop: 0 }}>⛓️ Deployed Smart Contract Infrastructure</h3>
        <p className="muted small" style={{ marginBottom: "1.5rem" }}>
          The immutable anchor contract where certificate hashes, student recipients, and IPFS CIDs are registered on Ethereum.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
          <div style={{ padding: "1rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <span className="meta-label">CertificateRegistry Contract Address (Sepolia)</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
              <strong style={{ fontFamily: "monospace", fontSize: "0.95rem" }}>{CONTRACT_ADDRESS}</strong>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                  onClick={() => copy(CONTRACT_ADDRESS, "contract")}
                >
                  {copied === "contract" ? "✓ Copied" : "📋 Copy"}
                </button>
                <a
                  href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-secondary"
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                >
                  🔍 Etherscan Contract ↗
                </a>
              </div>
            </div>
          </div>

          <div style={{ padding: "1rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <span className="meta-label">🏛️ Authorized Institute Issuer Wallet (Sepolia)</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
              <strong style={{ fontFamily: "monospace", fontSize: "0.95rem" }}>{INSTITUTE_ADDRESS}</strong>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                  onClick={() => copy(INSTITUTE_ADDRESS, "institute")}
                >
                  {copied === "institute" ? "✓ Copied" : "📋 Copy"}
                </button>
                <a
                  href={`https://sepolia.etherscan.io/address/${INSTITUTE_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-secondary"
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                >
                  🔍 Etherscan Wallet ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 3-Stakeholder Asymmetric Cryptography Summary */}
      <div className="card card-pad" style={{ marginBottom: "2rem" }}>
        <h3 style={{ marginTop: 0 }}>🔐 3-Stakeholder Asymmetric Keys in Ethereum</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          <div style={{ padding: "1rem", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
            <strong style={{ color: "#1e40af" }}>🏛️ 1. Institute (Issuer)</strong>
            <p className="small" style={{ margin: "0.5rem 0 0", color: "#1e3a8a" }}>
              Uses its private key to cryptographically sign certificate transactions and authorize employer verification requests on Sepolia.
            </p>
          </div>
          <div style={{ padding: "1rem", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
            <strong style={{ color: "#166534" }}>🎓 2. Student (Recipient)</strong>
            <p className="small" style={{ margin: "0.5rem 0 0", color: "#14532d" }}>
              Owns their Sepolia EVM address. The certificate is immutably anchored to this recipient address on-chain.
            </p>
          </div>
          <div style={{ padding: "1rem", background: "#fefce8", borderRadius: "8px", border: "1px solid #fef08a" }}>
            <strong style={{ color: "#854d0e" }}>🏢 3. Employer (Verifier)</strong>
            <p className="small" style={{ margin: "0.5rem 0 0", color: "#713f12" }}>
              Connects via MetaMask, requests verification, and queries the Ethereum smart contract directly without central intermediaries.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Sepolia Test ETH Faucets */}
      <div className="card card-pad" style={{ background: "#fafafa" }}>
        <h3 style={{ marginTop: 0 }}>⛽ Need Free Sepolia Testnet ETH?</h3>
        <p className="muted small" style={{ marginBottom: "1rem" }}>
          Sepolia ETH is completely free for testing and development. You can claim it from verified faucets:
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <a
            href="https://sepoliafaucet.com/"
            target="_blank"
            rel="noreferrer"
            className="button button-secondary"
          >
            Alchemy Sepolia Faucet ↗
          </a>
          <a
            href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
            target="_blank"
            rel="noreferrer"
            className="button button-secondary"
          >
            Google Cloud Web3 Faucet ↗
          </a>
          <a
            href="https://infura.io/faucet/sepolia"
            target="_blank"
            rel="noreferrer"
            className="button button-secondary"
          >
            Infura Sepolia Faucet ↗
          </a>
        </div>
      </div>
    </div>
  );
}
