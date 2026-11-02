import React from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/UI";

const CONTRACT_ADDRESS = "0x8a16Eb15A598DA4ed2E7211FEE12b37407907d90";

export default function Home() {
  return (
    <main className="home-page" style={{ maxWidth: 1120, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
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
              Student Vault
            </Link>
            <Link className="button button-primary" to="/verify" style={{ background: "#059669", fontWeight: 700 }}>
              Employer Verification
            </Link>
            <Link className="button button-secondary" to="/dashboard" style={{ fontWeight: 600 }}>
              Institution Dashboard
            </Link>
          </div>
          <p className="home-note">Zero centralized dependencies — authenticated on-chain via OpenZeppelin AccessControl smart contracts.</p>
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
            <span className="status-pill status-pill-success">
              <span className="status-dot success" /> Cryptographically Authentic
            </span>
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
              <div style={{ display: "inline-flex", padding: "0.5rem", borderRadius: "8px", background: "rgba(37, 99, 235, 0.1)", color: "#2563eb", marginBottom: "0.75rem" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              </div>
              <h3 style={{ margin: "0 0 0.5rem" }}>Student (Credential Owner)</h3>
              <p className="muted small" style={{ lineHeight: 1.6 }}>
                Students enjoy <strong>Self-Sovereign Identity</strong>. Degrees are mapped directly to student wallet addresses on-chain (`studentCertificates[student]`), granting perpetual ownership without university hostage risks.
              </p>
              <ul style={{ fontSize: "0.85rem", color: "var(--cc-muted)", paddingLeft: "1.25rem", margin: "1rem 0" }}>
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
              <div style={{ display: "inline-flex", padding: "0.5rem", borderRadius: "8px", background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed", marginBottom: "0.75rem" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 3l9 7H3z"/></svg>
              </div>
              <h3 style={{ margin: "0 0 0.5rem" }}>Academic Institution (Issuer)</h3>
              <p className="muted small" style={{ lineHeight: 1.6 }}>
                Universities hold <strong>`INSTITUTE_ROLE`</strong> enforced by OpenZeppelin AccessControl. Authorized issuers compute SHA-256 document commitments and pin decentralized PDFs to IPFS.
              </p>
              <ul style={{ fontSize: "0.85rem", color: "var(--cc-muted)", paddingLeft: "1.25rem", margin: "1rem 0" }}>
                <li>Automated PDF rendering with embedded security QR</li>
                <li>On-Chain Credential Revocation with audit trail</li>
                <li>Batch Cohort Issuance via Merkle Trees (95%+ gas saved)</li>
              </ul>
            </div>
            <Link to="/dashboard" className="button button-secondary" style={{ textAlign: "center", marginTop: "1rem" }}>
              Institution Dashboard ↗
            </Link>
          </div>

          {/* Card 3: Employer */}
          <div className="card card-pad" style={{ borderTop: "4px solid #059669", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "inline-flex", padding: "0.5rem", borderRadius: "8px", background: "rgba(5, 150, 105, 0.1)", color: "#059669", marginBottom: "0.75rem" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              </div>
              <h3 style={{ margin: "0 0 0.5rem" }}>Employer / Recruiter (Verifier)</h3>
              <p className="muted small" style={{ lineHeight: 1.6 }}>
                Employers execute <strong>Zero-Trust Auditing</strong>. Independent verification runs directly against the Ethereum EVM node with zero backend server or database dependency.
              </p>
              <ul style={{ fontSize: "0.85rem", color: "var(--cc-muted)", paddingLeft: "1.25rem", margin: "1rem 0" }}>
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
      <section className="card card-pad" style={{ marginBottom: "3rem" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", textAlign: "center" }}>
          Architectural Comparison: Ethereum Sepolia EVM vs Centralized Databases
        </h3>
        <p className="muted small" style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 1.5rem" }}>
          Why decentralized ledger architecture fundamentally resolves credential fraud and single-point-of-failure vulnerabilities.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "var(--cc-cloud)", textAlign: "left" }}>
                <th style={{ padding: "0.6rem 1rem", borderBottom: "1px solid var(--cc-line)" }}>Feature</th>
                <th style={{ padding: "0.6rem 1rem", borderBottom: "1px solid var(--cc-line)" }}>
                  <span className="status-pill status-pill-danger">Centralized Database (SQL / MongoDB)</span>
                </th>
                <th style={{ padding: "0.6rem 1rem", borderBottom: "1px solid var(--cc-line)" }}>
                  <span className="status-pill status-pill-success">CertChain EVM Smart Contracts</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid var(--cc-line)" }}>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600 }}>Tamper Resistance</td>
                <td style={{ padding: "0.6rem 1rem" }}>DB Admin can alter grades, names, or backdate degrees.</td>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600, color: "var(--cc-green)" }}>Immutable. Once confirmed in block, math prevents alteration.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--cc-line)" }}>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600 }}>Counterfeit Detection</td>
                <td style={{ padding: "0.6rem 1rem" }}>Paper / PDF inspection prone to Photoshop forgery.</td>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600, color: "var(--cc-green)" }}>SHA-256 Avalanche Effect: 1-bit change breaks the hash.</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--cc-line)" }}>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600 }}>Uptime & Verification</td>
                <td style={{ padding: "0.6rem 1rem" }}>Server down or hacked = entire verification offline.</td>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600, color: "var(--cc-green)" }}>Decentralized EVM nodes provide 100% trustless uptime 24/7.</td>
              </tr>
              <tr>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600 }}>Student Ownership</td>
                <td style={{ padding: "0.6rem 1rem" }}>University controls portal; degree hostage risk.</td>
                <td style={{ padding: "0.6rem 1rem", fontWeight: 600, color: "var(--cc-green)" }}>Self-Sovereign Identity: Mapped to student's private key wallet.</td>
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
