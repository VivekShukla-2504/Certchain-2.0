import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Alert, Button } from "../components/UI";
import { connectMetaMaskWallet } from "../utils/web3";

export default function StudentPortal() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [certificates, setCertificates] = useState([]);
  const [copiedId, setCopiedId] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    if (e) e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setError("Please enter your Student Wallet Address (0x...) or Certificate ID (CERT-...)");
      return;
    }
    setError("");
    setLoading(true);
    setSearched(true);
    try {
      if (cleanQuery.startsWith("0x")) {
        // Search by Student Wallet Address
        const res = await api.get(`/certificates/student/${encodeURIComponent(cleanQuery)}`);
        setCertificates(res.data.certificates || []);
      } else {
        // Search by Certificate ID
        const res = await api.get(`/verify/status/${encodeURIComponent(cleanQuery.toUpperCase())}`);
        if (res.data.certificate || res.data.candidateName) {
          setCertificates([
            {
              certId: cleanQuery.toUpperCase(),
              candidateName: res.data.certificate?.candidateName || res.data.candidateName || "Student",
              course: res.data.certificate?.course || "Academic Credential",
              grade: res.data.certificate?.grade || "-",
              issueDate: res.data.issuedAt || new Date().toISOString(),
              documentType: res.data.certificate?.documentType || "Degree",
              institutionId: res.data.institutionId,
              studentWallet: res.data.studentWallet || "",
              revoked: res.data.revoked || false
            }
          ]);
        } else {
          setCertificates([]);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "No certificate records found matching your credentials.");
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(certId) {
    navigator.clipboard.writeText(certId);
    setCopiedId(certId);
    setTimeout(() => setCopiedId(""), 2000);
  }

  async function handleConnectMetaMask() {
    setError("");
    try {
      const address = await connectMetaMaskWallet();
      setQuery(address);
      setLoading(true);
      setSearched(true);
      const res = await api.get(`/certificates/student/${encodeURIComponent(address)}`);
      setCertificates(res.data.certificates || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page student-portal-page" style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem" }}>
      <div className="page-header" style={{ marginBottom: "2rem" }}>
        <div>
          <span className="eyebrow">🎓 Student Self-Sovereign Credential Hub</span>
          <h1>My Academic Credentials</h1>
          <p className="lead">
            Access your blockchain-anchored academic degrees, verify ownership, and copy your <strong>Certificate ID</strong> to share with employers.
          </p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: "2rem" }}>
        <form onSubmit={handleSearch}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
            Enter your Student Wallet Public Address or Certificate ID:
          </label>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <input
              type="text"
              className="input"
              style={{ flex: 1, minWidth: 280 }}
              placeholder="e.g. 0xStudentWallet... or CERT-7A3B..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Querying Blockchain..." : "Lookup My Credentials"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleConnectMetaMask} disabled={loading}>
              🦊 Connect MetaMask (Sepolia)
            </Button>
          </div>
        </form>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", paddingTop: "0.5rem", borderTop: "1px solid var(--border-color, #e2e8f0)" }}>
          <span className="muted small">Don't have an Ethereum Key Pair yet?</span>
          <Link to="/keys" className="button button-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}>
            🔑 Generate My Student Web3 Keys
          </Link>
        </div>
      </div>

      {error && <Alert style={{ marginBottom: "1.5rem" }}>{error}</Alert>}

      {searched && !loading && certificates.length === 0 && !error && (
        <div className="card card-pad" style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <span style={{ fontSize: "2.5rem" }}>📂</span>
          <h3>No Certificates Found</h3>
          <p className="muted small">
            We couldn't find any issued certificate anchored to this address or ID yet. Please check with your institution.
          </p>
        </div>
      )}

      {certificates.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Issued Credentials ({certificates.length})</h3>
            <span className="badge badge-success">✓ Verified on Ethereum Ledger</span>
          </div>

          {certificates.map((cert) => (
            <div key={cert.certId} className="card card-pad" style={{ borderLeft: "4px solid var(--color-primary, #2563eb)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <span className="badge badge-neutral" style={{ marginBottom: "0.5rem" }}>{cert.documentType || "Degree"}</span>
                  <h2 style={{ margin: "0.25rem 0" }}>{cert.course}</h2>
                  <p className="muted" style={{ margin: 0 }}>
                    Issued by <strong>{cert.institutionId}</strong> to <strong>{cert.candidateName}</strong>
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={`badge ${cert.revoked ? "badge-revoked" : "badge-success"}`}>
                    {cert.revoked ? "Revoked" : "Active & Verified"}
                  </span>
                  <p className="muted small" style={{ marginTop: "0.5rem" }}>
                    Issued: {cert.issueDate ? new Date(cert.issueDate).toLocaleDateString() : "-"}
                  </p>
                </div>
              </div>

              <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)", display: "block" }}>
                      Your Unique Certificate ID (Share this with Employers):
                    </span>
                    <strong style={{ fontFamily: "monospace", fontSize: "1.1rem" }}>{cert.certId}</strong>
                  </div>
                  <Button variant="secondary" onClick={() => copyToClipboard(cert.certId)}>
                    {copiedId === cert.certId ? "✓ Copied ID!" : "📋 Copy ID for Employer"}
                  </Button>
                </div>

                {cert.studentWallet && (
                  <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px dashed #cbd5e1" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)" }}>Student Public Key:</span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.85rem", marginLeft: "0.5rem" }}>{cert.studentWallet}</span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <Link to={`/verify/${cert.certId}`} className="button button-primary">
                  🔍 View Public Verification
                </Link>
                <a
                  href={`/api/certificates/${cert.certId}/document`}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-secondary"
                >
                  📄 Download Official Document
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

