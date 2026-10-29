import React, { useState } from "react";
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
          <span className="eyebrow">🎓 Student Portal</span>
          <h1>My Academic Credentials</h1>
          <p className="lead">
            Access your blockchain-anchored academic degrees, verify ownership, and copy your <strong>Certificate ID</strong> to share with employers.
          </p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: "2rem" }}>
        <form onSubmit={handleSearch}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
            Enter your Student Wallet Address (0x...) or Certificate ID:
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
              🦊 Connect MetaMask
            </Button>
          </div>
        </form>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", paddingTop: "0.5rem", borderTop: "1px solid var(--border-color, #e2e8f0)" }}>
          <span className="muted small">💡 Tip: Click "Connect MetaMask" to load credentials issued to your wallet automatically.</span>
        </div>
      </div>

      {error && <Alert style={{ marginBottom: "1.5rem" }}>{error}</Alert>}

      {searched && certificates.length === 0 && !loading && !error && (
        <div className="card card-pad" style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <span style={{ fontSize: "2.5rem" }}>📜</span>
          <h3 style={{ marginTop: "1rem" }}>No Certificates Found</h3>
          <p className="muted small">
            No active certificate records were found matching <code>{query}</code>.
            Verify that your institution has issued your credential to this wallet or ID.
          </p>
        </div>
      )}

      {certificates.length > 0 && (
        <div>
          <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem" }}>
            Your Verified Credentials ({certificates.length})
          </h2>
          <div style={{ display: "grid", gap: "1.25rem" }}>
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
                    <span className="eyebrow" style={{ color: "var(--color-primary, #2563eb)" }}>
                      {cert.institutionId} · {cert.documentType || "Degree"}
                    </span>
                    <h3 style={{ margin: "0.25rem 0 0" }}>{cert.course}</h3>
                    <p className="muted small" style={{ margin: 0 }}>Candidate: <strong>{cert.candidateName}</strong></p>
                  </div>
                  <span className={`badge ${cert.revoked ? "badge-revoked" : "badge-success"}`}>
                    {cert.revoked ? "Revoked" : "✓ On-Chain Verified"}
                  </span>
                </div>

                {/* Certificate ID Share Box */}
                <div
                  style={{
                    background: "var(--color-bg-subtle, #f8fafc)",
                    padding: "0.85rem 1rem",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    border: "1px solid var(--border-color, #e2e8f0)"
                  }}
                >
                  <div>
                    <span className="meta-label" style={{ fontSize: "0.75rem" }}>
                      Certificate ID (Share this with Employers for Verification)
                    </span>
                    <strong style={{ fontFamily: "monospace", fontSize: "1rem", letterSpacing: "0.5px" }}>
                      {cert.certId}
                    </strong>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => copyToClipboard(cert.certId)}
                    style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                  >
                    {copiedId === cert.certId ? "✓ Copied to Clipboard!" : "📋 Copy ID for Employer"}
                  </Button>
                </div>

                <div className="public-result-meta" style={{ marginTop: "0.25rem" }}>
                  {cert.grade && (
                    <div>
                      <span className="meta-label">Grade / CGPA</span>
                      <strong>{cert.grade}</strong>
                    </div>
                  )}
                  {cert.issueDate && (
                    <div>
                      <span className="meta-label">Issue Date</span>
                      <strong>{new Date(cert.issueDate).toLocaleDateString()}</strong>
                    </div>
                  )}
                  {cert.studentWallet && (
                    <div>
                      <span className="meta-label">Owner Wallet</span>
                      <strong style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{cert.studentWallet}</strong>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", paddingTop: "0.5rem" }}>
                  <a
                    href={`/api/verify/${encodeURIComponent(cert.certId)}/document?wallet=${encodeURIComponent(cert.studentWallet || query)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-primary"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                  >
                    📄 View & Download Official PDF
                  </a>
                  <a
                    href={`/verify/${cert.certId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-secondary"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                  >
                    🔍 View Employer Verification View
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
