import React from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/UI";

export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">3-Stakeholder Blockchain Credential Infrastructure</span>
          <h1>Tamper-Proof Academic Certificates on Ethereum</h1>
          <p className="home-lead">
            An immutable, decentralized verification network connecting Institutions, Students, and Employers with zero risk of tampering.
          </p>
          <div className="home-actions">
            <Link className="button button-primary" to="/student">🎓 Student Portal</Link>
            <Link className="button button-primary" to="/verify" style={{ background: "#059669" }}>💼 Employer Verify</Link>
            <Link className="button button-secondary" to="/login">🏛️ Institution Portal</Link>
          </div>
          <p className="home-note">No account is needed to verify a certificate.</p>
        </div>
        <div className="home-proof-card" aria-label="Certificate verification preview">
          <div className="proof-card-top"><span className="proof-mark">✓</span><span className="badge badge-success">Verified record</span></div>
          <div className="proof-card-title">Certificate authenticity</div>
          <div className="proof-row"><span>Certificate ID</span><strong className="mono">CERT-7F3A2C</strong></div>
          <div className="proof-row"><span>Issued by</span><strong>Institution registry</strong></div>
          <div className="proof-row"><span>Record status</span><strong className="proof-status"><span className="status-dot" /> Confirmed</strong></div>
          <div className="proof-line" /><div className="proof-footer"><span>SHA-256 integrity check</span><span>On-chain record</span></div>
        </div>
      </section>
      <section className="home-trust-row" aria-label="CertChain capabilities">
        <div><span className="trust-number">01</span><div><strong>1. Institution Issues</strong><p>Signs certificate on Ethereum blockchain with IPFS hash.</p></div></div>
        <div><span className="trust-number">02</span><div><strong>2. Student Receives</strong><p>Owns digital credential bound to their public address.</p></div></div>
        <div><span className="trust-number">03</span><div><strong>3. Employer Verifies</strong><p>Requests verification & gets verified proof with institute approval.</p></div></div>
      </section>
      <footer className="home-footer"><Brand /><span>Academic credentials, made verifiable.</span></footer>
    </main>
  );
}
