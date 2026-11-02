import React from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/UI";

const CONTRACT_ADDRESS = "0x8a16Eb15A598DA4ed2E7211FEE12b37407907d90";

export default function Home() {
  return (
    <main className="home-page" style={{ maxWidth: 1120, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
      {/* Live Blockchain Protocol Banner */}
      <div style={{ background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)", borderRadius: 10, padding: "0.75rem 1.25rem", color: "#f8fafc", marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", border: "1px solid #334155" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#166534", color: "#dcfce7", padding: "2px 8px", borderRadius: "9999px", fontWeight: 700, fontSize: "0.75rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
            LIVE ON SEPOLIA (EIP-155: 11155111)
          </span>
          <span style={{ color: "#cbd5e1" }}>Proof-of-Stake Consensus (Gasper)</span>
          <span style={{ color: "#64748b" }}>|</span>
          <span style={{ color: "#cbd5e1" }}>Decentralized IPFS Storage</span>
          <span style={{ color: "#64748b" }}>|</span>
          <span style={{ color: "#cbd5e1" }}>W3C Verifiable Credentials Standard</span>
        </div>
        <a
          href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
          style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#38bdf8", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          📜 Contract: {CONTRACT_ADDRESS.slice(0, 8)}...{CONTRACT_ADDRESS.slice(-4)} ↗
        </a>
      </div>

      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">Enterprise Ethereum Credential Infrastructure</span>
          <h1>Tamper-Proof Academic Credentials on Ethereum Sepolia</h1>
          <p className="home-lead">
            A decentralized, zero-trust verification architecture uniting <strong>Academic Institutions</strong>, <strong>Students</strong>, and <strong>Employers</strong> with cryptographic hash commitments anchored directly to Ethereum EVM storage.
          </p>
          <div className="home-actions" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
            <Link className="button button-primary" to="/student" style={{ background: "#2563eb", fontWeight: 700 }}>
              🎓 Student Vault
            </Link>
            <Link className="button button-primary" to="/verify" style={{ background: "#059669", fontWeight: 700 }}>
              💼 Employer Verify
            </Link>
            <Link className="button button-secondary" to="/dashboard" style={{ fontWeight: 600 }}>
              🏛️ University Dashboard
            </Link>
            <Link className="button button-secondary" to="/keys" style={{ fontWeight: 600 }}>
              ⛓️ Sepolia Architecture
            </Link>
          </div>
          <p className="home-note">No centralized trust needed — authenticated on-chain via OpenZeppelin AccessControl smart contracts.</p>
        </div>

        <div className="home-proof-card" aria-label="Certificate verification preview">
          <div className="proof-card-top">
            <span className="proof-mark">✓</span>
            <span className="badge badge-success">On-Chain Sepolia Record</span>
          </div>
          <div className="proof-card-title">Cryptographic Integrity Proof</div>
          <div className="proof-row">
            <span>Certificate ID</span>
            <strong className="mono">CERT-DEPLOYER-TEST</strong>
          </div>
          <div className="proof-row">
            <span>Issuing Institute</span>
            <strong>DEPLOYER_PRIMARY (JNU)</strong>
          </div>
          <div className="proof-row">
            <span>Tamper Detection</span>
            <strong className="proof-status" style={{ color: "#059669" }}>
              <span className="status-dot" /> 🟢 NOT TAMPERED
            </strong>
          </div>
          <div className="proof-line" />
          <div className="proof-footer">
            <span>SHA-256 Byte Digest Commitment</span>
            <span>Ethereum Sepolia (11155111)</span>
          </div>
        </div>
      </section>

      {/* 3-Stakeholder Architecture Cards */}
      <section style={{ marginTop: "3rem", marginBottom: "3rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <span className="eyebrow">Decentralized Web3 Ecosystem</span>
          <h2 style={{ fontSize: "1.75rem", margin: "0.25rem 0" }}>Three Sovereign Stakeholders, One Immutable Ledger</h2>
          <p className="muted" style={{ maxWidth: 640, margin: "0 auto" }}>
            Every participant interacts via their own independent Ethereum cryptographic keypair with mathematical trust guarantees.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
          {/* Card 1: Student */}
          <div className="card card-pad" style={{ borderTop: "4px solid #2563eb", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🎓</div>
              <h3 style={{ margin: "0 0 0.5rem" }}>Student (Credential Owner)</h3>
              <p className="muted small" style={{ lineHeight: 1.6 }}>
                Students enjoy <strong>Self-Sovereign Identity</strong>. Degrees are mapped directly to student wallet addresses on-chain (`studentCertificates[student]`), granting perpetual ownership without university hostage risks.
              </p>
              <ul style={{ fontSize: "0.85rem", color: "#334155", paddingLeft: "1.25rem", margin: "1rem 0" }}>
                <li>MetaMask wallet login via EIP-191 signed challenge</li>
                <li>1-Click shareable verification URLs for recruiters</li>
                <li>Download machine-readable W3C Verifiable Credentials</li>
              </ul>
            </div>
            <Link to="/student" className="button button-secondary" style={{ textAlign: "center", marginTop: "1rem" }}>
              Open Student Portal ↗
            </Link>
          </div>

          {/* Card 2: Institute */}
          <div className="card card-pad" style={{ borderTop: "4px solid #7c3aed", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🏛️</div>
              <h3 style={{ margin: "0 0 0.5rem" }}>Academic Institution (Issuer)</h3>
              <p className="muted small" style={{ lineHeight: 1.6 }}>
                Universities hold <strong>`INSTITUTE_ROLE`</strong> enforced by OpenZeppelin AccessControl. Authorized issuers compute SHA-256 document commitments and pin decentralized PDFs to IPFS.
              </p>
              <ul style={{ fontSize: "0.85rem", color: "#334155", paddingLeft: "1.25rem", margin: "1rem 0" }}>
                <li>Automated PDF rendering with embedded security QR</li>
                <li>On-Chain Credential Revocation with audit trail</li>
                <li>Batch Cohort Issuance via Merkle Trees (95%+ gas saved)</li>
              </ul>
            </div>
            <Link to="/dashboard" className="button button-secondary" style={{ textAlign: "center", marginTop: "1rem" }}>
              University Dashboard ↗
            </Link>
          </div>

          {/* Card 3: Employer */}
          <div className="card card-pad" style={{ borderTop: "4px solid #059669", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>💼</div>
              <h3 style={{ margin: "0 0 0.5rem" }}>Employer / Recruiter (Verifier)</h3>
              <p className="muted small" style={{ lineHeight: 1.6 }}>
                Employers execute <strong>Zero-Trust Auditing</strong>. Independent verification runs directly against the Ethereum EVM node with zero backend server or database dependency.
              </p>
              <ul style={{ fontSize: "0.85rem", color: "#334155", paddingLeft: "1.25rem", margin: "1rem 0" }}>
                <li>Byte-level SHA-256 Document Tampering Detection</li>
                <li>Live camera webcam QR scanner for physical degrees</li>
                <li>Download printable Official Blockchain Audit Reports</li>
              </ul>
            </div>
            <Link to="/verify" className="button button-secondary" style={{ textAlign: "center", marginTop: "1rem" }}>
              Verify Candidate Degree ↗
            </Link>
          </div>
        </div>
      </section>

      {/* Why Blockchain vs Traditional DB Comparison */}
      <section className="card card-pad" style={{ marginBottom: "3rem", background: "#f8fafc", border: "1px solid #cbd5e1" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", textAlign: "center" }}>
          ⚖️ Why Ethereum Blockchain Database vs Traditional MongoDB / SQL
        </h3>
        <p className="muted small" style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 1.5rem" }}>
          How CertChain solves the core vulnerabilities of centralized databases in academic credentialing.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#e2e8f0", textAlign: "left" }}>
                <th style={{ padding: "0.6rem 1rem" }}>Feature</th>
                <th style={{ padding: "0.6rem 1rem", color: "#991b1b" }}>❌ Traditional MongoDB / SQL</th>
                <th style={{ padding: "0.6rem 1rem", color: "#166534" }}>✅ CertChain (Ethereum Sepolia EVM)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600 }}>Tamper Resistance</td>
                <td style={{ padding: "0.6rem 1rem" }}>DB Admin can alter grades, names, or backdate degrees.</td>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600, color: "#166534" }}>Immutable. Once confirmed in block, math prevents alteration.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600 }}>Counterfeit Detection</td>
                <td style={{ padding: "0.6rem 1rem" }}>Paper / PDF inspection prone to Photoshop forgery.</td>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600, color: "#166534" }}>SHA-256 Avalanche Effect: 1-bit change breaks the hash.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600 }}>Uptime & Verification</td>
                <td style={{ padding: "0.6rem 1rem" }}>Server down or hacked = entire verification offline.</td>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600, color: "#166534" }}>Decentralized EVM nodes provide 100% trustless uptime 24/7.</td>
              </tr>
              <tr>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600 }}>Student Ownership</td>
                <td style={{ padding: "0.6rem 1rem" }}>University controls portal; degree hostage risk.</td>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600, color: "#166534" }}>Self-Sovereign Identity: Mapped to student's private key wallet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Trust Lifecycle Row */}
      <section className="home-trust-row" aria-label="CertChain 3-Stakeholder Lifecycle" style={{ marginBottom: "2.5rem" }}>
        <div>
          <span className="trust-number">01</span>
          <div>
            <strong>1. Institution Issues on Sepolia</strong>
            <p>Signs document commitment via private key, generates certId, pins encrypted PDF to IPFS, and dispatches to student.</p>
          </div>
        </div>
        <div>
          <span className="trust-number">02</span>
          <div>
            <strong>2. Student Accesses & Shares</strong>
            <p>Authenticates via MetaMask, retrieves self-sovereign credentials, and copies unique certId or W3C JSON-LD to share.</p>
          </div>
        </div>
        <div>
          <span className="trust-number">03</span>
          <div>
            <strong>3. Employer Verifies Independently</strong>
            <p>Verifies directly against Ethereum Sepolia, detects document modifications with SHA-256, and downloads audit certificate.</p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <Brand />
        <span>Ethereum Sepolia Academic Registry — Powered by OpenZeppelin AccessControl, Pinata IPFS & W3C Standards.</span>
      </footer>
    </main>
  );
}
