import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import api, { API_ORIGIN } from "../api";
import { Alert, Button } from "../components/UI";
import { connectMetaMaskWallet } from "../utils/web3";

export default function Verify() {
  const { certificateId } = useParams();

  // Employer verification form state
  const [certId, setCertId] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [employerWallet, setEmployerWallet] = useState("");
  const [employerEmail, setEmployerEmail] = useState("");

  // Status & result state
  const [verificationStatus, setVerificationStatus] = useState("idle"); // "idle" | "loading" | "pending" | "approved" | "not_found" | "error"
  const [statusMessage, setStatusMessage] = useState("");
  const [requestDetails, setRequestDetails] = useState(null);
  const [approvedDetails, setApprovedDetails] = useState(null);
  const [attestation, setAttestation] = useState(null);
  const [polling, setPolling] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState(true);
  const pollTimerRef = useRef(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Pre-fill from URL param if present
  useEffect(() => {
    if (!certificateId) return;
    const normalized = decodeURIComponent(certificateId).trim().toUpperCase();
    setCertId(normalized);
    checkStatus(normalized);
  }, [certificateId]);

  // Connect MetaMask Sepolia wallet
  async function handleConnectEmployerMetaMask() {
    try {
      const address = await connectMetaMaskWallet();
      setEmployerWallet(address);
    } catch (err) {
      alert(err.message);
    }
  }

  // Check verification status from backend & smart contract
  async function checkStatus(targetCertId = certId, silent = false) {
    const normalized = targetCertId.trim().toUpperCase();
    if (!normalized) return;
    if (!silent) setVerificationStatus("loading");

    try {
      const res = await api.get(`/verify/status/${encodeURIComponent(normalized)}${employerWallet ? `?employerWallet=${employerWallet}` : ""}`);
      if (res.data.approved) {
        setVerificationStatus("approved");
        setApprovedDetails(res.data);
        setStatusMessage(res.data.message || "Certificate verified and authorized by issuing institution.");
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setPolling(false);
        }
        // Fetch formal attestation receipt
        try {
          const attestRes = await api.get(`/verify/${encodeURIComponent(normalized)}/attestation`);
          setAttestation(attestRes.data);
        } catch (e) {
          // ignore
        }
      } else {
        setVerificationStatus("pending");
        setRequestDetails(res.data);
        setStatusMessage(res.data.message || "Awaiting Institute verification and approval.");
      }
    } catch (err) {
      if (!silent) {
        if (err.response?.status === 404) {
          setVerificationStatus("not_found");
          setStatusMessage("No certificate found with ID: " + normalized);
        } else {
          setVerificationStatus("error");
          setStatusMessage(err.response?.data?.message || "Failed to connect to verification network.");
        }
      }
    }
  }

  // Submit Employer Verification Request
  async function handleEmployerSubmit(e) {
    e.preventDefault();
    const normalized = certId.trim().toUpperCase();
    if (!normalized) {
      setStatusMessage("Please enter a Certificate ID");
      setVerificationStatus("error");
      return;
    }

    setVerificationStatus("loading");
    setApprovedDetails(null);
    setRequestDetails(null);
    setAttestation(null);

    try {
      const res = await api.post("/verify/request", {
        certId: normalized,
        employerName: employerName.trim() || "Prospective Employer",
        employerWallet: employerWallet.trim(),
        employerEmail: employerEmail.trim()
      });

      if (res.data.approved) {
        await checkStatus(normalized);
      } else {
        setVerificationStatus("pending");
        setRequestDetails(res.data);
        setStatusMessage(res.data.message || "Verification request submitted to the issuing institution.");
        startPolling(normalized);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setVerificationStatus("not_found");
        setStatusMessage("Certificate not found in blockchain registry.");
      } else {
        setVerificationStatus("error");
        setStatusMessage(err.response?.data?.message || "Failed to submit verification request.");
      }
    }
  }

  // Poll status periodically until approved
  function startPolling(targetCertId) {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setPolling(true);
    pollTimerRef.current = setInterval(() => {
      checkStatus(targetCertId, true);
    }, 3500);
  }

  return (
    <div className="page public-verify-page" style={{ maxWidth: 1040, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Header */}
      <div className="verify-hero" style={{ textAlign: "center", marginBottom: "2rem" }}>
        <span className="eyebrow" style={{ letterSpacing: "1px", textTransform: "uppercase", color: "#2563eb", fontWeight: 700 }}>
          🔒 Enterprise Verification Portal
        </span>
        <h1 style={{ fontSize: "2.25rem", margin: "0.5rem 0" }}>Verify Candidate Credentials</h1>
        <p className="lead" style={{ maxWidth: 750, margin: "0 auto", color: "#64748b" }}>
          Enter the student's <strong>Certificate ID</strong> to request instant verification and unlock the authentic on-chain academic credential.
        </p>
      </div>

      {/* Verification Entry Form */}
      <form className="card card-pad" onSubmit={handleEmployerSubmit} style={{ marginBottom: "2rem", borderTop: "4px solid #2563eb" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ margin: 0 }}>Enter Candidate Certificate ID</h3>
            <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
              Provide the Certificate ID shared by the student candidate.
            </p>
          </div>
          <span className="badge badge-neutral">Ethereum Sepolia Powered</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
          <label className="field">
            <span style={{ fontWeight: 600 }}>Certificate ID (from Student) *</span>
            <input
              className="input"
              style={{ fontFamily: "monospace", letterSpacing: "0.5px" }}
              placeholder="e.g. CERT-7F3A2B..."
              value={certId}
              onChange={(e) => {
                setCertId(e.target.value);
                if (verificationStatus !== "idle") setVerificationStatus("idle");
              }}
              required
            />
          </label>

          <label className="field">
            <span style={{ fontWeight: 600 }}>Employer / Organization Name</span>
            <input
              className="input"
              placeholder="e.g. Google HR, Tata Consultancy Services"
              value={employerName}
              onChange={(e) => setEmployerName(e.target.value)}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
          <label className="field">
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>Employer Wallet (Optional)</span>
              <button
                type="button"
                onClick={handleConnectEmployerMetaMask}
                style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "0.85rem", padding: 0, fontWeight: 600 }}
              >
                🦊 Connect MetaMask
              </button>
            </span>
            <input
              className="input"
              style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
              placeholder="0x... (Your Sepolia Address)"
              value={employerWallet}
              onChange={(e) => setEmployerWallet(e.target.value)}
            />
          </label>

          <label className="field">
            <span style={{ fontWeight: 600 }}>Recruiter Contact Email (Optional)</span>
            <input
              className="input"
              type="email"
              placeholder="recruiter@company.com"
              value={employerEmail}
              onChange={(e) => setEmployerEmail(e.target.value)}
            />
          </label>
        </div>

        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button type="submit" loading={verificationStatus === "loading"}>
            {verificationStatus === "loading" ? "Querying Blockchain..." : "🔍 Verify Credential"}
          </Button>
          {certId && (
            <Button type="button" variant="secondary" onClick={() => checkStatus(certId)}>
              🔄 Refresh Status
            </Button>
          )}
        </div>
      </form>

      {/* Pending Status Banner */}
      {verificationStatus === "pending" && (
        <div className="card card-pad" style={{ borderLeft: "6px solid #f59e0b", background: "#fffdf5", marginBottom: "2rem" }}>
          <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
            <div style={{ fontSize: "2.5rem" }}>⏳</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <h2 style={{ margin: 0, color: "#92400e" }}>Awaiting Institute Verification & On-Chain Approval</h2>
                <span className="badge" style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", padding: "0.35rem 0.75rem" }}>
                  Pending Institute Signature
                </span>
              </div>
              <p style={{ color: "#78350f", margin: "0.75rem 0 1rem", lineHeight: 1.6 }}>
                Certificate <strong>{certId}</strong> has been located in the blockchain registry! To prevent unauthorized public exposure of personal academic documents, <strong>the issuing institution ({requestDetails?.institutionId || "University"}) has been notified to verify candidate identity and grant access</strong>.
              </p>

              <div style={{ background: "#ffffff", padding: "1rem", borderRadius: "8px", border: "1px solid #fde68a", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                {requestDetails?.requestId && (
                  <div>
                    <span className="meta-label">Request Ticket</span>
                    <strong style={{ fontFamily: "monospace" }}>{requestDetails.requestId}</strong>
                  </div>
                )}
                {requestDetails?.institutionId && (
                  <div>
                    <span className="meta-label">Issuing Authority</span>
                    <strong>{requestDetails.institutionId}</strong>
                  </div>
                )}
                {requestDetails?.candidateName && (
                  <div>
                    <span className="meta-label">Candidate</span>
                    <strong>{requestDetails.candidateName}</strong>
                  </div>
                )}
                <div>
                  <span className="meta-label">Live Status Sync</span>
                  <span style={{ color: "#059669", fontWeight: 600 }}>
                    {polling ? "● Polling for smart contract authorization..." : "Idle"}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}>
                <Button type="button" variant="secondary" onClick={() => checkStatus(certId)}>
                  🔄 Check Status Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approved & Fully Verified Credential View (DigiLocker Style) */}
      {verificationStatus === "approved" && approvedDetails && (
        <div style={{ display: "grid", gap: "2rem", marginBottom: "2rem" }}>
          {/* DigiLocker Official Verification Badge Card */}
          <div
            className="card card-pad"
            style={{
              borderLeft: "6px solid #10b981",
              background: "linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)",
              boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.1)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "#d1fae5", color: "#065f46", padding: "0.35rem 0.75rem", borderRadius: "9999px", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                  <span>✓</span> 100% AUTHENTIC & VERIFIED CREDENTIAL
                </div>
                <h2 style={{ margin: "0.25rem 0 0.5rem", color: "#065f46" }}>
                  Academic Degree Confirmed on Ethereum Sepolia
                </h2>
                <p className="muted small" style={{ margin: 0 }}>
                  This credential has been mathematically verified against the smart contract and authorized by the issuing university.
                </p>
              </div>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => window.print()}
                style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
              >
                🖨️ Print Verification Proof
              </button>
            </div>

            {/* Candidate Academic Details */}
            {approvedDetails.certificate && (
              <div style={{ marginTop: "1.5rem", background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
                <h3 style={{ margin: "0 0 1rem", color: "#0f172a", fontSize: "1.1rem" }}>
                  🎓 Student Academic Record
                </h3>
                <div className="public-result-meta" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem" }}>
                  <div>
                    <span className="meta-label">Candidate Name</span>
                    <strong style={{ fontSize: "1.05rem", color: "#0f172a" }}>{approvedDetails.certificate.candidateName}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Roll Number / ID</span>
                    <strong style={{ fontSize: "1.05rem" }}>{approvedDetails.certificate.rollNumber}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Course / Degree</span>
                    <strong style={{ fontSize: "1.05rem", color: "#2563eb" }}>{approvedDetails.certificate.course}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Grade / CGPA</span>
                    <strong style={{ fontSize: "1.05rem", color: "#059669" }}>{approvedDetails.certificate.grade}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Document Type</span>
                    <strong>{approvedDetails.certificate.documentType}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Date of Issuance</span>
                    <strong>{new Date(approvedDetails.certificate.issueDate).toLocaleDateString()}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* 4 Cryptographic Trust Pillars */}
            <div style={{ marginTop: "1.5rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", color: "#0f172a", fontSize: "1.1rem" }}>
                ⛓️ On-Chain Cryptographic Proofs
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                <div style={{ padding: "0.85rem", background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span className="meta-label">🏛️ Institute Signer Address (Issuer)</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>
                    {approvedDetails.issuerWallet}
                  </strong>
                </div>

                <div style={{ padding: "0.85rem", background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span className="meta-label">🎓 Student Recipient Address (Owner)</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>
                    {approvedDetails.studentWallet || "Unassigned"}
                  </strong>
                </div>

                <div style={{ padding: "0.85rem", background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span className="meta-label">📦 Decentralized IPFS Content ID (CID)</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>
                    {approvedDetails.ipfsCid || "Pinned to IPFS"}
                  </strong>
                </div>

                <div style={{ padding: "0.85rem", background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span className="meta-label">⛓️ On-Chain Approval Transaction</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>
                    {approvedDetails.txHash || "Signed on Sepolia"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Embedded Official Document Preview */}
            <div style={{ marginTop: "2rem", borderTop: "1px solid #bbf7d0", paddingTop: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <h3 style={{ margin: 0, color: "#0f172a" }}>📄 Official Verified Certificate Document</h3>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                    onClick={() => setShowDocPreview(!showDocPreview)}
                  >
                    {showDocPreview ? "Hide Preview" : "Show Embedded Preview"}
                  </button>
                  <a
                    href={`${API_ORIGIN}/api/verify/${encodeURIComponent(certId)}/document`}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-primary"
                    style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                  >
                    ↗ Open Fullscreen PDF
                  </a>
                </div>
              </div>

              {showDocPreview && (
                <div style={{ height: "550px", width: "100%", borderRadius: "8px", overflow: "hidden", border: "1px solid #cbd5e1", background: "#f8fafc" }}>
                  <iframe
                    src={`${API_ORIGIN}/api/verify/${encodeURIComponent(certId)}/document`}
                    title="Official Verified Academic Document"
                    style={{ width: "100%", height: "100%", border: "none" }}
                  />
                </div>
              )}
            </div>

            {/* Attestation Summary Bar */}
            {attestation && (
              <div style={{ marginTop: "1.5rem", padding: "0.85rem 1rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <span className="muted small">
                  Attestation ID: <code style={{ fontWeight: 600 }}>{attestation.attestationId}</code> · Verified on Ethereum Sepolia
                </span>
                <span style={{ color: "#059669", fontWeight: 600, fontSize: "0.85rem" }}>
                  ✓ Digital Proof Stamped
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Not Found State */}
      {verificationStatus === "not_found" && (
        <div className="card card-pad not-found" style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <div style={{ fontSize: "2.5rem" }}>❓</div>
          <h2 style={{ marginTop: "0.75rem" }}>Certificate Not Found</h2>
          <p className="muted small" style={{ maxWidth: 500, margin: "0 auto 1.5rem" }}>
            No active certificate record was found matching ID: <code>{certId}</code>.
            Please ensure you entered the exact ID printed on the document or shared by the student.
          </p>
          <Button type="button" variant="secondary" onClick={() => setVerificationStatus("idle")}>
            Try Another Certificate ID
          </Button>
        </div>
      )}

      {/* Error State */}
      {verificationStatus === "error" && (
        <Alert style={{ marginBottom: "1.5rem" }}>{statusMessage}</Alert>
      )}
    </div>
  );
}
