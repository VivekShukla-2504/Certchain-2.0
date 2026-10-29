import React from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/UI";

export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <span className="eyebrow">Credential infrastructure for institutions</span>
          <h1>Proof that stands up to scrutiny.</h1>
          <p className="home-lead">Issue academic certificates with a tamper-evident record, then let anyone verify their authenticity in seconds.</p>
          <div className="home-actions">
            <Link className="button button-primary" to="/student">🎓 Student Portal</Link>
            <Link className="button button-primary" to="/verify" style={{ background: "#059669" }}>💼 Employer Verify</Link>
            <Link className="button button-secondary" to="/keys">⛓️ Sepolia Network</Link>
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
        <div><span className="trust-number">01</span><div><strong>Issue once</strong><p>Create a certificate record for every recipient.</p></div></div>
        <div><span className="trust-number">02</span><div><strong>Anchor securely</strong><p>Keep a tamper-evident fingerprint of the record.</p></div></div>
        <div><span className="trust-number">03</span><div><strong>Verify anywhere</strong><p>Share a certificate ID for fast public verification.</p></div></div>
      </section>
      <footer className="home-footer"><Brand /><span>Academic credentials, made verifiable.</span></footer>
    </main>
  );
}
