import React from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/UI";

export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">3-Stakeholder Blockchain Credential Infrastructure</span>
          <h1>Tamper-Proof Academic Certificates on Ethereum Sepolia</h1>
          <p className="home-lead">
            A decentralized, tamper-evident verification network connecting <strong>Institutions</strong>, <strong>Students</strong>, and <strong>Employers</strong> with cryptographic cryptographic proofs anchored directly to Ethereum.
          </p>
          <div className="home-actions" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
            <Link className="button button-primary" to="/student" style={{ background: "#2563eb" }}>
              🎓 Student Vault
            </Link>
            <Link className="button button-primary" to="/verify" style={{ background: "#059669" }}>
              💼 Employer Verify
            </Link>
            <Link className="button button-secondary" to="/login">
              🏛️ Institution Portal
            </Link>
            <Link className="button button-secondary" to="/keys">
              ⛓️ Sepolia Keys & Contract
            </Link>
          </div>
          <p className="home-note">No centralized authority needed — verified on-chain via smart contracts.</p>
        </div>

        <div className="home-proof-card" aria-label="Certificate verification preview">
          <div className="proof-card-top">
            <span className="proof-mark">✓</span>
            <span className="badge badge-success">On-Chain Sepolia Record</span>
          </div>
          <div className="proof-card-title">Cryptographic Integrity Proof</div>
          <div className="proof-row">
            <span>Certificate ID</span>
            <strong className="mono">CERT-2026-LIVE</strong>
          </div>
          <div className="proof-row">
            <span>Issuing Institute</span>
            <strong>Authorized Registry</strong>
          </div>
          <div className="proof-row">
            <span>Tamper Check</span>
            <strong className="proof-status" style={{ color: "#059669" }}>
              <span className="status-dot" /> 🟢 NOT TAMPERED
            </strong>
          </div>
          <div className="proof-line" />
          <div className="proof-footer">
            <span>Keccak-256 On-Chain Hash</span>
            <span>Ethereum Testnet (11155111)</span>
          </div>
        </div>
      </section>

      <section className="home-trust-row" aria-label="CertChain 3-Stakeholder Lifecycle">
        <div>
          <span className="trust-number">01</span>
          <div>
            <strong>1. Institution Issues on Sepolia</strong>
            <p>Signs certificate hash with its private key, issues certId, and auto-dispatches PDF & credentials to the student's email.</p>
          </div>
        </div>
        <div>
          <span className="trust-number">02</span>
          <div>
            <strong>2. Student Accesses & Shares</strong>
            <p>Accesses verified credentials in the Student Portal and copies unique certId to share with prospective employers.</p>
          </div>
        </div>
        <div>
          <span className="trust-number">03</span>
          <div>
            <strong>3. Employer Verifies with Approval</strong>
            <p>Enters certId. Institute verifies on-chain tamper integrity and approves authorization for employer to view the verified degree.</p>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <Brand />
        <span>Ethereum Sepolia Academic Registry — Tamper-Proof & Decentralized.</span>
      </footer>
    </main>
  );
}
