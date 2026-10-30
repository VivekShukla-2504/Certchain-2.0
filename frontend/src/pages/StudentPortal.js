import React, { useState, useEffect } from "react";
import api, { API_ORIGIN } from "../api";
import { Alert, Button } from "../components/UI";
import {
  connectMetaMaskWallet,
  getConnectedWallet,
  isSepoliaNetwork,
  ensureSepoliaNetwork,
  hasMetaMask,
  SEPOLIA_CHAIN_ID_DEC
} from "../utils/web3";

const CONTRACT_ADDRESS = "0x8a16Eb15A598DA4ed2E7211FEE12b37407907d90";

export default function StudentPortal() {
  const [activeTab, setActiveTab] = useState("credentials");
  const [walletAddress, setWalletAddress] = useState("");
  const [isSepolia, setIsSepolia] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [certificates, setCertificates] = useState([]);
  const [copiedId, setCopiedId] = useState("");
  const [selectedCert, setSelectedCert] = useState(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    async function initWallet() {
      if (hasMetaMask()) {
        const addr = await getConnectedWallet();
        if (addr) {
          setWalletAddress(addr);
          setQuery(addr);
          loadCertificates(addr);
        }
        const onSepolia = await isSepoliaNetwork();
        setIsSepolia(onSepolia);
      }
    }
    initWallet();
  }, []);

  async function loadCertificates(identifier) {
    if (!identifier || !identifier.trim()) return;
    setError("");
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get(`/certificates/student/${encodeURIComponent(identifier.trim())}`);
      setCertificates(res.data.certificates || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load student credentials");
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectMetaMask() {
    setError("");
    try {
      await ensureSepoliaNetwork();
      const address = await connectMetaMaskWallet();
      setWalletAddress(address);
      setIsSepolia(true);
      setQuery(address);
      loadCertificates(address);
    } catch (err) {
      setError("MetaMask connection failed: " + err.message);
    }
  }

  function handleSearch(e) {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setError("Please enter your Student Wallet Address (0x...) or Roll Number.");
      return;
    }
    loadCertificates(query);
  }

  function copyToClipboard(certId) {
    navigator.clipboard.writeText(certId);
    setCopiedId(certId);
    setTimeout(() => setCopiedId(""), 2000);
  }

  const activeCerts = certificates.filter((c) => !c.revoked);
  const revokedCerts = certificates.filter((c) => c.revoked);

  return (
    <div className="page student-portal-page" style={{ maxWidth: 1040, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Header Banner */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <span className="eyebrow">🎓 Decentralized Student Credential Vault</span>
          <h1 style={{ margin: "0.25rem 0" }}>Student Dashboard</h1>
          <p className="lead" style={{ margin: 0 }}>
            Inspect, download, and share your tamper-proof academic credentials anchored to <strong>Ethereum Sepolia</strong>.
          </p>
        </div>

        {/* Student Wallet Status Badge */}
        <div className="card" style={{ padding: "0.75rem 1.25rem", background: "#f8fafc", borderColor: "#cbd5e1", minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Student Wallet
            </span>
            <span style={{ fontSize: "0.75rem", background: isSepolia ? "#dcfce7" : "#fee2e2", color: isSepolia ? "#166534" : "#991b1b", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
              {isSepolia ? `Sepolia (${SEPOLIA_CHAIN_ID_DEC})` : "Sepolia"}
            </span>
          </div>

          {walletAddress ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
              <a
                href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
              >
                {walletAddress.slice(0, 10)}...{walletAddress.slice(-6)} ↗
              </a>
            </div>
          ) : (
            <Button variant="secondary" onClick={handleConnectMetaMask} style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", width: "100%" }}>
              🦊 Connect Student MetaMask
            </Button>
          )}
        </div>
      </div>

      {/* Query Bar */}
      <div className="card card-pad" style={{ marginBottom: "1.75rem" }}>
        <form onSubmit={handleSearch}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.9rem" }}>
            Query Credentials by Student Wallet Address or Roll Number:
          </label>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <input
              type="text"
              className="input mono"
              style={{ flex: 1, minWidth: "min(280px, 100%)", fontSize: "0.85rem" }}
              placeholder="e.g. 0xStudentAddress... or Roll Number (2022CS101)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Querying Sepolia..." : "Lookup Credentials"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleConnectMetaMask}>
              🦊 Sync MetaMask
            </Button>
          </div>
        </form>
      </div>

      {error && (
        <div style={{ marginBottom: "1.5rem" }}>
          <Alert>{error}</Alert>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="dashboard-nav-tabs" aria-label="Student views">
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "credentials" ? "active" : ""}`}
          onClick={() => setActiveTab("credentials")}
        >
          📜 My Credentials ({certificates.length})
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          📊 Overview
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "details" ? "active" : ""}`}
          onClick={() => setActiveTab("details")}
        >
          🔍 Cryptographic Details
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "wallet" ? "active" : ""}`}
          onClick={() => setActiveTab("wallet")}
        >
          🦊 Web3 Identity & Key Info
        </button>
      </nav>

      {/* TAB 1: MY CREDENTIALS */}
      {activeTab === "credentials" && (
        <div>
          {searched && certificates.length === 0 && !loading && !error && (
            <div className="card card-pad" style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <span style={{ fontSize: "2.5rem" }}>📜</span>
              <h3 style={{ marginTop: "1rem" }}>No Credentials Found</h3>
              <p className="muted small" style={{ maxWidth: 480, margin: "0.5rem auto 1.5rem" }}>
                No blockchain credentials were found for <code>{query}</code>. Ensure your institution has registered and issued your certificate to your wallet address.
              </p>
              <Button variant="secondary" onClick={handleConnectMetaMask}>
                Connect With Another MetaMask Account
              </Button>
            </div>
          )}

          <div style={{ display: "grid", gap: "1.5rem" }}>
            {certificates.map((cert) => (
              <div
                key={cert.certId}
                className="card card-pad"
                style={{
                  borderLeft: `5px solid ${cert.revoked ? "#ef4444" : "#10b981"}`,
                  display: "grid",
                  gap: "1rem"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <span className="eyebrow" style={{ color: "#2563eb" }}>
                      {cert.institutionId} · {cert.documentType || "Degree"}
                    </span>
                    <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.35rem" }}>{cert.course}</h2>
                    <p className="muted small" style={{ margin: 0 }}>
                      Candidate: <strong>{cert.candidateName}</strong> · Roll No: <code>{cert.rollNumber}</code>
                    </p>
                  </div>
                  <span
                    className={`badge ${cert.revoked ? "badge-revoked" : "badge-success"}`}
                    style={{ fontWeight: 700, fontSize: "0.8rem", padding: "4px 10px" }}
                  >
                    {cert.revoked ? "🔴 REVOKED ON SEPOLIA" : "🟢 ACTIVE & ON-CHAIN VERIFIED"}
                  </span>
                </div>

                {/* Shareable Certificate ID Box */}
                <div
                  style={{
                    background: "#f8fafc",
                    padding: "0.85rem 1.15rem",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block" }}>
                      Unique Certificate ID (Share this with Employers)
                    </span>
                    <strong style={{ fontFamily: "monospace", fontSize: "1.05rem", color: "#1e293b", letterSpacing: "0.5px" }}>
                      {cert.certId}
                    </strong>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => copyToClipboard(cert.certId)}
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                  >
                    {copiedId === cert.certId ? "✓ Copied to Clipboard!" : "📋 Copy ID for Employer"}
                  </Button>
                </div>

                {/* Credential Details Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", fontSize: "0.85rem" }}>
                  <div>
                    <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>Grade / CGPA</span>
                    <strong>{cert.grade || "Distinction"}</strong>
                  </div>
                  <div>
                    <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>Issue Date</span>
                    <strong>{new Date(cert.issueDate || cert.createdAt).toLocaleDateString()}</strong>
                  </div>
                  <div>
                    <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>Issuing Institute Authority</span>
                    <span style={{ fontFamily: "monospace", color: "#2563eb" }}>
                      {cert.issuerWallet ? cert.issuerWallet.slice(0, 10) + "..." : cert.institutionId}
                    </span>
                  </div>
                  <div>
                    <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>Blockchain Transaction</span>
                    {cert.txHash && cert.txHash.startsWith("0x") ? (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${cert.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontFamily: "monospace", color: "#2563eb", textDecoration: "underline" }}
                      >
                        {cert.txHash.slice(0, 10)}... ↗
                      </a>
                    ) : (
                      <span className="muted">Confirmed</span>
                    )}
                  </div>
                </div>

                {/* Actions Bar */}
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", paddingTop: "0.5rem", borderTop: "1px solid #f1f5f9" }}>
                  <a
                    href={`${API_ORIGIN}/api/certificates/${cert.certId}/download-student`}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-primary"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}
                  >
                    📥 Download Original PDF Certificate
                  </a>
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}
                    onClick={() => {
                      setSelectedCert(cert);
                      setActiveTab("details");
                    }}
                  >
                    🔍 Inspect Cryptographic Fingerprint
                  </button>
                  <a
                    href={`/verify/${cert.certId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-secondary"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}
                  >
                    🛡️ Employer Verification View ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: OVERVIEW */}
      {activeTab === "overview" && (
        <div>
          <section className="dashboard-stats" aria-label="Student overview stats">
            <StatCard label="Total Degrees & Credentials" value={certificates.length} detail="Issued to your student identity" tone="blue" />
            <StatCard label="Active Credentials" value={activeCerts.length} detail="Legally verifiable" tone="green" />
            <StatCard label="Revoked Credentials" value={revokedCerts.length} detail="Revoked by issuing authority" tone="red" />
          </section>

          <div style={{ marginTop: "1.5rem" }}>
            <article className="card card-pad">
              <h3 style={{ margin: "0 0 0.5rem" }}>💡 How to Verify Your Degree with Employers</h3>
              <ol style={{ paddingLeft: "1.25rem", lineHeight: "1.7", fontSize: "0.9rem", color: "#334155" }}>
                <li>Copy your <strong>Unique Certificate ID</strong> from the Credentials tab.</li>
                <li>Share this Certificate ID on your CV, LinkedIn, or directly with your prospective employer.</li>
                <li>The employer enters your Certificate ID on the <strong>Employer Verification Portal</strong>.</li>
                <li>The Ethereum Sepolia smart contract cryptographically validates that the certificate hash matches the issuing authority's signature.</li>
                <li>Your credential cannot be faked or tampered with by any third party.</li>
              </ol>
            </article>
          </div>
        </div>
      )}

      {/* TAB 3: CRYPTOGRAPHIC DETAILS */}
      {activeTab === "details" && (
        <article className="card card-pad" style={{ maxWidth: 840, margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 0.5rem" }}>Cryptographic Credential Inspection</h2>
          <p className="muted small" style={{ margin: "0 0 1.5rem" }}>
            Inspect raw on-chain cryptographic proofs, SHA-256 hashes, and smart contract state on Ethereum Sepolia.
          </p>

          {selectedCert ? (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 0.5rem" }}>{selectedCert.course} [{selectedCert.certId}]</h4>
                <div style={{ display: "grid", gap: "0.75rem", fontSize: "0.85rem" }}>
                  <div>
                    <span className="muted small" style={{ display: "block" }}>SHA-256 Document Commitment Hash (Exact PDF Bytes):</span>
                    <code style={{ wordBreak: "break-all", color: "#0f172a", fontSize: "0.8rem" }}>
                      {selectedCert.documentHash || selectedCert.certHash}
                    </code>
                  </div>
                  <div>
                    <span className="muted small" style={{ display: "block" }}>Smart Contract Address:</span>
                    <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" style={{ fontFamily: "monospace", color: "#2563eb" }}>
                      {CONTRACT_ADDRESS} ↗
                    </a>
                  </div>
                  <div>
                    <span className="muted small" style={{ display: "block" }}>Blockchain Transaction Hash:</span>
                    <a href={`https://sepolia.etherscan.io/tx/${selectedCert.txHash}`} target="_blank" rel="noreferrer" style={{ fontFamily: "monospace", color: "#2563eb" }}>
                      {selectedCert.txHash || "Confirmed"} ↗
                    </a>
                  </div>
                  {selectedCert.blockNumber && (
                    <div>
                      <span className="muted small" style={{ display: "block" }}>Block Number:</span>
                      <strong>{selectedCert.blockNumber}</strong>
                    </div>
                  )}
                  <div>
                    <span className="muted small" style={{ display: "block" }}>Recipient Student Wallet:</span>
                    <code style={{ fontFamily: "monospace" }}>{selectedCert.studentWallet}</code>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <p className="muted">Please click "Inspect Cryptographic Fingerprint" on any certificate in the Credentials tab to view its raw blockchain proof.</p>
              <Button onClick={() => setActiveTab("credentials")}>View Credentials</Button>
            </div>
          )}
        </article>
      )}

      {/* TAB 4: WALLET INFORMATION */}
      {activeTab === "wallet" && (
        <article className="card card-pad" style={{ maxWidth: 740, margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 0.5rem" }}>Student Web3 Identity</h2>
          <p className="muted small" style={{ margin: "0 0 1.5rem" }}>
            Every stakeholder in CertChain has an independent, self-sovereign Ethereum wallet identity.
          </p>

          <div style={{ background: "#f8fafc", padding: "1.25rem", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: "1.5rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <span className="muted small" style={{ display: "block" }}>Connected Public Address:</span>
              <strong style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "#0f172a" }}>
                {walletAddress || "No wallet connected"}
              </strong>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <span className="muted small" style={{ display: "block" }}>Blockchain Network:</span>
              <strong>Ethereum Sepolia Testnet (Chain ID: 11155111)</strong>
            </div>

            <div>
              <span className="muted small" style={{ display: "block" }}>Network Status:</span>
              <span style={{ color: isSepolia ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                {isSepolia ? "✓ Connected to Sepolia Testnet" : "⚠️ Incorrect network. Switch to Sepolia in MetaMask."}
              </span>
            </div>
          </div>

          <Button onClick={handleConnectMetaMask} style={{ width: "100%" }}>
            🦊 Reconnect / Switch MetaMask Account
          </Button>
        </article>
      )}
    </div>
  );
}
