import React, { useState, useEffect } from "react";
import { Alert, Button } from "../components/UI";
import {
  connectMetaMaskWallet,
  authenticateStakeholderWallet,
  isSepoliaNetwork,
  ensureSepoliaNetwork
} from "../utils/web3";

const CONTRACT_ADDRESS = "0x8a16Eb15A598DA4ed2E7211FEE12b37407907d90";
const INSTITUTE_ADDRESS = "0x8A8edFB602AA8D7479160bC42815B6271d4B70B3";

export default function KeyGenerator() {
  const [connectedWallet, setConnectedWallet] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [selectedRole, setSelectedRole] = useState("institute");
  const [verificationResult, setVerificationResult] = useState(null);
  const [isSepolia, setIsSepolia] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (window.ethereum?.selectedAddress) {
      setConnectedWallet(window.ethereum.selectedAddress);
    }
    isSepoliaNetwork().then(setIsSepolia);

    if (window.ethereum?.on) {
      window.ethereum.on("accountsChanged", (accounts) => {
        setConnectedWallet(accounts[0] || "");
        setVerificationResult(null);
      });
      window.ethereum.on("chainChanged", () => {
        isSepoliaNetwork().then(setIsSepolia);
      });
    }
  }, []);

  async function handleConnect() {
    setError("");
    setConnecting(true);
    try {
      const address = await connectMetaMaskWallet();
      setConnectedWallet(address);
      setIsSepolia(await isSepoliaNetwork());
    } catch (err) {
      setError(err.message || "Failed to connect to MetaMask.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleVerifyStakeholderSignature() {
    setError("");
    setVerifying(true);
    setVerificationResult(null);
    try {
      await ensureSepoliaNetwork();
      const result = await authenticateStakeholderWallet(selectedRole);
      setVerificationResult(result);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Cryptographic signature verification failed.");
    } finally {
      setVerifying(false);
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
          <h1>Ethereum Sepolia Network & Stakeholder Wallets</h1>
          <p className="lead">
            CertChain runs natively on the <strong>Ethereum Sepolia Testnet</strong>. Every stakeholder (Institute, Student, Employer) interacts using independent cryptographic EVM accounts verified via signed challenges.
          </p>
        </div>
      </div>

      {!isSepolia && (
        <Alert type="warning" style={{ marginBottom: "1.5rem" }}>
          ⚠️ Your MetaMask wallet is not connected to Ethereum Sepolia. Click "Switch to Sepolia" to connect to Chain ID 11155111.
          <div style={{ marginTop: "0.5rem" }}>
            <Button variant="secondary" onClick={ensureSepoliaNetwork}>
              Switch to Sepolia
            </Button>
          </div>
        </Alert>
      )}

      {error && <Alert style={{ marginBottom: "1.5rem" }}>{error}</Alert>}

      {/* 1. Connect MetaMask Account */}
      <div className="card card-pad" style={{ marginBottom: "2rem", borderLeft: "5px solid #3b82f6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h3 style={{ margin: 0 }}>🦊 MetaMask Sepolia Stakeholder Identity</h3>
            <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
              {connectedWallet
                ? "Active Wallet Connected to Ethereum Sepolia (Chain ID: 11155111)"
                : "Connect your MetaMask wallet to view your cryptographic EVM address"}
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

            {/* Cryptographic Challenge-Response Signature Testing */}
            <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
              <span className="meta-label" style={{ display: "block", marginBottom: "0.5rem" }}>
                🔐 Cryptographic Signature Verification (Phase 1 Acceptance Test)
              </span>
              <p className="small muted" style={{ margin: "0 0 0.75rem" }}>
                Select a stakeholder role and sign a server-issued challenge nonce via MetaMask to prove private key ownership without revealing secrets:
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <select
                  className="select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  style={{ maxWidth: "200px" }}
                >
                  <option value="institute">🏛️ Institute</option>
                  <option value="student">🎓 Student</option>
                  <option value="employer">🏢 Employer</option>
                </select>
                <Button onClick={handleVerifyStakeholderSignature} loading={verifying}>
                  {verifying ? "Signing in MetaMask..." : "✍️ Sign Challenge & Verify Ownership"}
                </Button>
              </div>

              {verificationResult && (
                <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "6px" }}>
                  <span style={{ color: "#065f46", fontWeight: 700, display: "block" }}>
                    ✓ Cryptographic Ownership Verified for {verificationResult.stakeholder?.toUpperCase()}
                  </span>
                  <div style={{ fontSize: "0.75rem", color: "#047857", marginTop: "4px", fontFamily: "monospace", wordBreak: "break-all" }}>
                    Verified Address: {verificationResult.walletAddress || connectedWallet}<br />
                    Session Token: {verificationResult.token?.slice(0, 36)}...
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. On-Chain Smart Contract Details */}
      <div className="card card-pad" style={{ marginBottom: "2rem" }}>
        <h3 style={{ marginTop: 0 }}>⛓️ Deployed OpenZeppelin Smart Contract Infrastructure</h3>
        <p className="muted small" style={{ marginBottom: "1.5rem" }}>
          Live on Ethereum Sepolia Testnet with OpenZeppelin AccessControl role-based security.
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
                  🔍 View Contract on Etherscan ↗
                </a>
              </div>
            </div>
          </div>

          <div style={{ padding: "1rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <span className="meta-label">🏛️ Authorized Deployer / Institute Issuer Wallet (Sepolia)</span>
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

      {/* 3. 3-Stakeholder Asymmetric Cryptography Architecture */}
      <div className="card card-pad" style={{ marginBottom: "2rem" }}>
        <h3 style={{ marginTop: 0 }}>🔐 3-Stakeholder Cryptographic Identities</h3>
        <p className="muted small">
          Every stakeholder possesses an individual Ethereum public/private key pair managed via MetaMask. No shared keys or stored private keys.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          <div style={{ padding: "1rem", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
            <strong style={{ color: "#1e40af" }}>🏛️ 1. Institute (Issuer)</strong>
            <p className="small" style={{ margin: "0.5rem 0 0", color: "#1e3a8a" }}>
              Possesses an authorized Institute wallet on Sepolia. Signs certificate commitments and authorizes employer verification requests.
            </p>
          </div>
          <div style={{ padding: "1rem", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
            <strong style={{ color: "#166534" }}>🎓 2. Student (Recipient)</strong>
            <p className="small" style={{ margin: "0.5rem 0 0", color: "#14532d" }}>
              Possesses an independent EVM address. Credentials are permanently bound to the student's address on Ethereum.
            </p>
          </div>
          <div style={{ padding: "1rem", background: "#fefce8", borderRadius: "8px", border: "1px solid #fef08a" }}>
            <strong style={{ color: "#854d0e" }}>🏢 3. Employer (Verifier)</strong>
            <p className="small" style={{ margin: "0.5rem 0 0", color: "#713f12" }}>
              Connects an independent EVM wallet to submit verification requests and inspect on-chain immutable proofs without third-party brokers.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Sepolia Test ETH Faucets */}
      <div className="card card-pad" style={{ background: "#fafafa" }}>
        <h3 style={{ marginTop: 0 }}>⛽ Need Free Sepolia Testnet ETH?</h3>
        <p className="muted small" style={{ marginBottom: "1rem" }}>
          Sepolia ETH is completely free for testing and development:
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
