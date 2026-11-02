import React, { useState, useEffect } from "react";
import api, { API_ORIGIN } from "../api";
import { Alert, Button, StatCard } from "../components/UI";
import {
  connectMetaMaskWallet,
  getConnectedWallet,
  isSepoliaNetwork,
  ensureSepoliaNetwork,
  hasMetaMask,
  SEPOLIA_CHAIN_ID_DEC,
  getStudentCertificatesDirect,
  authenticateStakeholderWallet,
  disconnectWallet
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
  const [sbtModalCert, setSbtModalCert] = useState(null);

  // Registered Student Identity & Web3 Session State
  const [studentProfile, setStudentProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("certchain_student") || "null");
    } catch {
      return null;
    }
  });
  const [isWalletAuthenticated, setIsWalletAuthenticated] = useState(() => {
    return localStorage.getItem("certchain_role") === "student" && !!localStorage.getItem("certchain_token");
  });
  const [signingIn, setSigningIn] = useState(false);

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
      if (res.data.student) {
        setStudentProfile(res.data.student);
        // Do NOT set localStorage on read search — prevents role leakage
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load student credentials");
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  }

  // Web3 Cryptographic Wallet Authentication (Challenge -> MetaMask Signature -> JWT Session)
  async function handleSignInWithWallet() {
    setError("");
    setSigningIn(true);
    try {
      await ensureSepoliaNetwork();
      const auth = await authenticateStakeholderWallet("student");
      // Clean up other stakeholder sessions
      localStorage.removeItem("certchain_institution");
      localStorage.removeItem("certchain_employer_wallet");
      localStorage.removeItem("certchain_employer_name");
      localStorage.removeItem("certchain_employer_email");

      localStorage.setItem("certchain_token", auth.token);
      localStorage.setItem("certchain_role", "student");
      localStorage.setItem("certchain_student_wallet", auth.walletAddress);

      if (auth.student) {
        localStorage.setItem("certchain_student", JSON.stringify(auth.student));
        setStudentProfile(auth.student);
      }

      setWalletAddress(auth.walletAddress);
      setIsWalletAuthenticated(true);
      setIsSepolia(true);
      setQuery(auth.walletAddress);
      await loadCertificates(auth.walletAddress);
    } catch (err) {
      setError("Web3 Wallet Authentication failed: " + err.message);
    } finally {
      setSigningIn(false);
    }
  }

  function handleLogout() {
    disconnectWallet();
    localStorage.removeItem("certchain_token");
    localStorage.removeItem("certchain_role");
    localStorage.removeItem("certchain_student");
    localStorage.removeItem("certchain_student_wallet");
    setWalletAddress("");
    setStudentProfile(null);
    setIsWalletAuthenticated(false);
    setCertificates([]);
    setSearched(false);
    setQuery("");
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
          <span className="eyebrow">Decentralized Student Credential Vault</span>
          <h1 style={{ margin: "0.25rem 0" }}>Student Credential Vault</h1>
          <p className="lead" style={{ margin: 0 }}>
            Inspect, export, and cryptographically share your sovereign academic credentials anchored to <strong>Ethereum Sepolia</strong>.
          </p>
        </div>

        {/* Student Wallet Status Badge */}
        <div className="card" style={{ padding: "0.75rem 1.25rem", background: "var(--cc-cloud)", borderColor: "var(--cc-line)", minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--cc-subtle)", textTransform: "uppercase" }}>
              Student Wallet
            </span>
            <span style={{ fontSize: "0.75rem", background: isSepolia ? "#dcfce7" : "#fee2e2", color: isSepolia ? "#166534" : "#991b1b", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
              {isSepolia ? `Sepolia (${SEPOLIA_CHAIN_ID_DEC})` : "Sepolia"}
            </span>
          </div>

          {walletAddress ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                  <a
                    href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
                  >
                    {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)} ↗
                  </a>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    color: "#ef4444",
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                  title="Sign out of student wallet session"
                >
                  Sign Out ⎋
                </button>
              </div>

              {!isWalletAuthenticated && (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handleSignInWithWallet}
                  disabled={signingIn}
                  style={{ fontSize: "0.75rem", padding: "3px 8px", width: "100%", marginTop: "4px", borderColor: "#10b981", color: "#10b981" }}
                >
                  {signingIn ? "Signing via MetaMask..." : "🦊 Sign In with Web3 Signature"}
                </button>
              )}
            </div>
          ) : (
            <Button
              variant="secondary"
              onClick={handleSignInWithWallet}
              loading={signingIn}
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.6rem", width: "100%" }}
            >
              🦊 Sign In with MetaMask
            </Button>
          )}
        </div>
      </div>

      {/* Registered Student Identity Banner */}
      {studentProfile && (
        <div
          className="card"
          style={{
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            background: "rgba(16, 185, 129, 0.08)",
            borderColor: "rgba(16, 185, 129, 0.3)",
            borderRadius: 8
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.3rem" }}>🎓</span>
                <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{studentProfile.fullName}</h2>
                <span className="badge badge-success" style={{ fontSize: "0.75rem" }}>Registered Student</span>
              </div>
              <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                Enrollment / Roll No: <strong style={{ fontFamily: "monospace" }}>{studentProfile.enrollmentNumber}</strong> · Course: <strong>{studentProfile.course}</strong> · Department: <strong>{studentProfile.department}</strong> ({studentProfile.academicSession})
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button
                variant="secondary"
                onClick={handleLogout}
                style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
                title="Sign out of student portal session"
              >
                Sign Out ⎋
              </Button>
            </div>
          </div>
        </div>
      )}

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
              Sync MetaMask
            </Button>
          </div>
          <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Demo Quick-Fill:</span>
            <button
              type="button"
              className="quick-test-tag"
              onClick={() => {
                const demoAddr = "0x8A8edFB602AA8D7479160bC42815B6271d4B70B3";
                setQuery(demoAddr);
                loadCertificates(demoAddr);
              }}
            >
              Primary Student Wallet (Demo)
            </button>
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
          My Credentials ({certificates.length})
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "details" ? "active" : ""}`}
          onClick={() => setActiveTab("details")}
        >
          Cryptographic Details
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "wallet" ? "active" : ""}`}
          onClick={() => setActiveTab("wallet")}
        >
          Identity & Keys
        </button>
      </nav>

      {/* TAB 1: MY CREDENTIALS */}
      {activeTab === "credentials" && (
        <div>
          {searched && certificates.length === 0 && !loading && !error && (
            <div className="card card-pad" style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <div style={{ display: "inline-flex", padding: "0.75rem", borderRadius: "12px", background: "rgba(100, 116, 139, 0.1)", color: "var(--cc-subtle)", marginBottom: "0.75rem" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <h3 style={{ marginTop: "0.5rem" }}>No Credentials Found</h3>
              <p className="muted small" style={{ maxWidth: 480, margin: "0.5rem auto 1.5rem" }}>
                No blockchain credentials were found for <code>{query}</code>. Ensure your institution has issued your certificate to your wallet address or roll number.
              </p>
              <Button variant="secondary" onClick={handleConnectMetaMask}>
                Connect With Another Wallet
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
                  {cert.revoked ? (
                    <span className="status-pill status-pill-danger">
                      <span className="status-dot danger" /> Revoked on Ledger
                    </span>
                  ) : (
                    <span className="status-pill status-pill-success">
                      <span className="status-dot success" /> Validated Authentic
                    </span>
                  )}
                </div>

                {/* Shareable Certificate ID Box */}
                <div
                  style={{
                    background: "var(--cc-cloud)",
                    padding: "0.85rem 1.15rem",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    border: "1px solid var(--cc-line)"
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--cc-subtle)", textTransform: "uppercase", display: "block" }}>
                      Unique Certificate ID (Share this with Employers)
                    </span>
                    <strong style={{ fontFamily: "monospace", fontSize: "1.05rem", color: "var(--cc-ink)", letterSpacing: "0.5px" }}>
                      {cert.certId}
                    </strong>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => copyToClipboard(cert.certId)}
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                  >
                    {copiedId === cert.certId ? "✓ Copied to Clipboard!" : "Copy ID for Employer"}
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
                    <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>Issuing Authority</span>
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
                    Download Official PDF
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
                    Inspect Fingerprint
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem", color: "#2563eb", fontWeight: 600 }}
                    onClick={() => {
                      const url = `${window.location.origin}/verify/${cert.certId}`;
                      navigator.clipboard.writeText(url);
                      setCopiedId(`URL-${cert.certId}`);
                      setTimeout(() => setCopiedId(""), 2500);
                    }}
                  >
                    {copiedId === `URL-${cert.certId}` ? "✓ Verification Link Copied!" : "Copy Verification Link"}
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem", color: "#b45309", fontWeight: 700, borderColor: "#fde68a", background: "#fffbeb" }}
                    onClick={() => setSbtModalCert(cert)}
                    title="View ERC-5192 Non-Transferable Soulbound Token representation"
                  >
                    Soulbound Token (ERC-5192)
                  </button>
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
              <h3 style={{ margin: "0 0 0.5rem" }}>How to Verify Your Degree with Employers</h3>
              <ol style={{ paddingLeft: "1.25rem", lineHeight: "1.7", fontSize: "0.9rem", color: "var(--cc-muted)" }}>
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
              <div style={{ background: "var(--cc-cloud)", padding: "1rem", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
                <h4 style={{ margin: "0 0 0.5rem" }}>{selectedCert.course} [{selectedCert.certId}]</h4>
                <div style={{ display: "grid", gap: "0.75rem", fontSize: "0.85rem" }}>
                  <div>
                    <span className="muted small" style={{ display: "block" }}>SHA-256 Document Commitment Hash (Exact PDF Bytes):</span>
                    <code style={{ wordBreak: "break-all", color: "var(--cc-ink)", fontSize: "0.8rem" }}>
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

          <div style={{ background: "var(--cc-cloud)", padding: "1.25rem", borderRadius: 8, border: "1px solid var(--cc-line)", marginBottom: "1.5rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <span className="muted small" style={{ display: "block" }}>Connected Public Address:</span>
              <strong style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "var(--cc-ink)" }}>
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

      {/* SOULBOUND TOKEN (SBT) MODAL */}
      {sbtModalCert && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
          <div style={{ background: "linear-gradient(135deg, #090d16 0%, #111827 50%, #1e1b4b 100%)", borderRadius: 16, maxWidth: 520, width: "100%", padding: "2rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", border: "2px solid #eab308", color: "#f8fafc", position: "relative" }}>
            <button
              type="button"
              onClick={() => setSbtModalCert(null)}
              style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", color: "#94a3b8", fontSize: "1.25rem", cursor: "pointer" }}
            >
              ✕
            </button>

            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <span style={{ display: "inline-block", background: "rgba(234, 179, 8, 0.15)", border: "1px solid #ca8a04", color: "#fef08a", padding: "4px 12px", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase" }}>
                ERC-5192 SOULBOUND TOKEN (NON-TRANSFERABLE)
              </span>
              <div style={{ display: "inline-flex", padding: "1rem", borderRadius: "50%", background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.3)", color: "#facc15", margin: "1rem auto 0.5rem" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
              </div>
              <h2 style={{ margin: "0.25rem 0", color: "#fef08a", fontSize: "1.4rem", letterSpacing: "0.5px" }}>
                {sbtModalCert.course}
              </h2>
              <span style={{ fontSize: "0.85rem", color: "#93c5fd" }}>
                {sbtModalCert.institutionId} · Academic Qualification
              </span>
            </div>

            <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: 10, padding: "1.25rem", border: "1px solid rgba(255, 255, 255, 0.1)", marginBottom: "1.5rem", display: "grid", gap: "0.75rem", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.35rem" }}>
                <span style={{ color: "#94a3b8" }}>Graduate Candidate:</span>
                <strong style={{ color: "#ffffff" }}>{sbtModalCert.candidateName}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.35rem" }}>
                <span style={{ color: "#94a3b8" }}>Roll / Enrollment:</span>
                <strong style={{ fontFamily: "monospace", color: "#67e8f9" }}>{sbtModalCert.rollNumber}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.35rem" }}>
                <span style={{ color: "#94a3b8" }}>Grade / CGPA:</span>
                <strong style={{ color: "#4ade80" }}>{sbtModalCert.grade || "First Class"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.35rem" }}>
                <span style={{ color: "#94a3b8" }}>Token ID:</span>
                <strong style={{ fontFamily: "monospace", color: "#cbd5e1" }}>{sbtModalCert.certId}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Bound Student Key:</span>
                <code style={{ fontSize: "0.75rem", color: "#38bdf8" }}>
                  {sbtModalCert.studentWallet ? sbtModalCert.studentWallet.slice(0, 10) + "..." + sbtModalCert.studentWallet.slice(-6) : "Sovereign Identity"}
                </code>
              </div>
            </div>

            <p style={{ fontSize: "0.75rem", color: "#94a3b8", textAlign: "center", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
              <strong>Non-Transferable Attestation:</strong> This Soulbound Token is mathematically locked to the recipient's private key. Transfer, sale, and tampering are permanently prohibited on Ethereum Sepolia.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setSbtModalCert(null)}
                style={{ width: "100%", background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                Close Badge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
