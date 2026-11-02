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

      <footer className="home-footer" style={{ marginTop: "4rem" }}>
        <Brand />
        <span>Ethereum Sepolia Academic Registry — Powered by OpenZeppelin AccessControl, Pinata IPFS & W3C Standards.</span>
      </footer>
    </main>
  );
}
