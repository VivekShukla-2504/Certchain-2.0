import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import { Alert, Button } from "../components/UI";
import { connectMetaMaskWallet } from "../utils/web3";

export default function Verify() {
  const { certificateId } = useParams();
  const [activeTab, setActiveTab] = useState("employer"); // "employer" | "pdf_hash"

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
  const [polling, setPolling] = useState(false);
  const pollTimerRef = useRef(null);

  // Manual PDF Integrity fields (Secondary mode)
  const [certificateFields, setCertificateFields] = useState({
    candidateName: "",
    rollNumber: "",
    institutionId: "",
    documentType: "Degree",
    course: "",
    grade: "",
    issueDate: ""
  });
  const [documentFile, setDocumentFile] = useState(null);
  const [pdfResult, setPdfResult] = useState(null);
  const [pdfState, setPdfState] = useState("idle");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");

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

    try {
      const res = await api.post("/verify/request", {
        certId: normalized,
        employerName: employerName.trim() || "Prospective Employer",
        employerWallet: employerWallet.trim(),
        employerEmail: employerEmail.trim()
      });

      if (res.data.approved) {
        // Already approved! Fetch full status
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

  // Secondary mode: direct file hash check
  async function handlePdfVerify(e) {
    e.preventDefault();
    const normalized = certId.trim().toUpperCase();
    if (!normalized) {
      setPdfError("Enter a certificate ID");
      setPdfState("error");
      return;
    }
    setPdfLoading(true);
    setPdfError("");
    setPdfResult(null);
    setPdfState("loading");

    try {
      const payload = new FormData();
      payload.append("certId", normalized);
      if (documentFile) payload.append("document", documentFile);
      Object.entries(certificateFields).forEach(([k, v]) => payload.append(k, v.trim()));

      const res = await api.post("/verify", payload);
      setPdfResult(res.data);
      setPdfState(res.data.revoked ? "revoked" : res.data.verified ? "verified" : "invalid");
    } catch (err) {
      setPdfState("error");
      setPdfError(err.response?.data?.message || "Verification failed");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="page public-verify-page">
      <div className="verify-hero">
        <span className="eyebrow">Enterprise & Academic Verification</span>
        <h1>Employer Credential Verification</h1>
        <p className="lead">
          3-Stakeholder Asymmetric Architecture: Student shares <code>certId</code> ➔ Employer requests verification ➔ Issuing Institute cryptographically authorizes on-chain ➔ Official credentials and verified document are unlocked.
        </p>

        {/* Tab Selection */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <button
            type="button"
            className={`button ${activeTab === "employer" ? "button-primary" : "button-secondary"}`}
            onClick={() => setActiveTab("employer")}
          >
            🏢 Employer Verification (With Institute Approval)
          </button>
          <button
            type="button"
            className={`button ${activeTab === "pdf_hash" ? "button-primary" : "button-secondary"}`}
            onClick={() => setActiveTab("pdf_hash")}
          >
            🔍 Direct PDF Hash Check
          </button>
        </div>

        {/* Employer Verification Form */}
        {activeTab === "employer" && (
          <form className="verify-form card card-pad" onSubmit={handleEmployerSubmit} style={{ marginBottom: "2rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>1. Enter Certificate ID & Employer Identity</h3>
            <p className="muted small" style={{ marginBottom: "1.25rem" }}>
              Provide the Certificate ID shared by the student. Your verification request will be forwarded to the issuing institute for cryptographic approval.
            </p>

            <div className="verify-entry-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label className="field">
                <span>Certificate ID (from Student) *</span>
                <input
                  className="input"
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
                <span>Employer / Organization Name</span>
                <input
                  className="input"
                  placeholder="e.g. Google HR / Tata Consultancy Services"
                  value={employerName}
                  onChange={(e) => setEmployerName(e.target.value)}
                />
              </label>
            </div>

            <div className="verify-entry-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.75rem" }}>
              <label className="field">
                <span style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Employer Sepolia Public Key (Wallet)</span>
                  <button
                    type="button"
                    onClick={handleConnectEmployerMetaMask}
                    style={{ background: "none", border: "none", color: "var(--color-primary, #2563eb)", cursor: "pointer", fontSize: "0.85rem", padding: 0, fontWeight: 600 }}
                  >
                    🦊 Connect MetaMask (Sepolia)
                  </button>
                </span>
                <input
                  className="input"
                  placeholder="0x... (Sepolia Wallet)"
                  value={employerWallet}
                  onChange={(e) => setEmployerWallet(e.target.value)}
                />
              </label>

              <label className="field">
                <span>Employer Recruiter Email (Optional)</span>
                <input
                  className="input"
                  type="email"
                  placeholder="recruiter@company.com"
                  value={employerEmail}
                  onChange={(e) => setEmployerEmail(e.target.value)}
                />
              </label>
            </div>

            <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}>
              <Button type="submit" loading={verificationStatus === "loading"}>
                {verificationStatus === "loading" ? "Submitting Request..." : "Verify Credential with Institute"}
              </Button>
              {certId && (
                <Button type="button" variant="secondary" onClick={() => checkStatus(certId)}>
                  🔄 Check Status Directly
                </Button>
              )}
            </div>
          </form>
        )}

        {/* Direct PDF Hash Check Form */}
        {activeTab === "pdf_hash" && (
          <form className="verify-form verify-form-stacked card card-pad" onSubmit={handlePdfVerify} style={{ marginBottom: "2rem" }}>
            <h3 style={{ marginTop: 0 }}>Cryptographic Hash Commitment Check</h3>
            <p className="muted small">Directly recalculates the SHA-256 byte digest and tests against the on-chain smart contract hash.</p>
            <div className="verify-entry-row">
              <input
                className="input"
                placeholder="Certificate ID *"
                value={certId}
                onChange={(e) => setCertId(e.target.value)}
                required
              />
              <input
                className="input"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
              />
            </div>
            <Button type="submit" loading={pdfLoading}>{pdfLoading ? "Verifying..." : "Verify Hash Integrity"}</Button>
          </form>
        )}
      </div>

      {/* Loading Indicator */}
      {verificationStatus === "loading" && (
        <div className="verification-loading card card-pad">
          <span className="verification-loader" />
          <div>
            <h3>Consulting Blockchain & Institution Registry</h3>
            <p>Querying smart contract authorization and verification requests...</p>
          </div>
        </div>
      )}

      {/* State: Awaiting Institute Verification & Approval */}
      {verificationStatus === "pending" && (
        <div className="verification-state card card-pad" style={{ borderLeft: "5px solid #f59e0b", background: "#fffbeb" }}>
          <div className="verification-state-icon" style={{ background: "#fef3c7", color: "#b45309" }}>⏳</div>
          <div className="verification-state-copy" style={{ width: "100%" }}>
            <div className="verification-state-title">
              <div>
                <span className="eyebrow" style={{ color: "#b45309" }}>Authorization Gate</span>
                <h2 style={{ color: "#92400e" }}>Awaiting Institute Verification & Approval</h2>
              </div>
              <span className="badge" style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" }}>
                Pending Institute Approval
              </span>
            </div>

            <p style={{ color: "#78350f", fontSize: "0.95rem" }}>
              Certificate <strong>{certId}</strong> has been located in the registry! In accordance with strict academic privacy and tamper-prevention rules, <strong>the issuing institution ({requestDetails?.institutionId || "Institute"}) must review and authorize access</strong> before the official document and candidate credentials can be disclosed.
            </p>

            <div className="public-result-meta" style={{ background: "#ffffff", padding: "1rem", borderRadius: "8px", border: "1px solid #fde68a" }}>
              {requestDetails?.requestId && (
                <div>
                  <span className="meta-label">Request ID</span>
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
                <span className="meta-label">Real-Time Poller</span>
                <span style={{ color: "#059669", fontWeight: 600 }}>
                  {polling ? "● Live polling for Institute signature..." : "Paused"}
                </span>
              </div>
            </div>

            <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
              <Button type="button" variant="secondary" onClick={() => checkStatus(certId)}>
                🔄 Refresh Status Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* State: Verified & Approved by Institute */}
      {verificationStatus === "approved" && approvedDetails && (
        <div className="verification-state card card-pad verified" style={{ borderLeft: "5px solid #10b981" }}>
          <div className="verification-state-icon" style={{ background: "#d1fae5", color: "#047857" }}>✓</div>
          <div className="verification-state-copy" style={{ width: "100%" }}>
            <div className="verification-state-title">
              <div>
                <span className="eyebrow" style={{ color: "#059669" }}>On-Chain Verification Complete</span>
                <h2 style={{ color: "#065f46" }}>Verified & Authorized by Issuing Institute</h2>
              </div>
              <span className="badge badge-success">Authentic & Approved</span>
            </div>

            <p style={{ color: "#065f46" }}>
              {statusMessage || "The issuing institution has reviewed and cryptographically authorized access to this certificate on the blockchain."}
            </p>

            {/* Candidate Details */}
            {approvedDetails.certificate && (
              <>
                <h3 style={{ marginTop: "1.25rem", marginBottom: "0.5rem" }}>Academic Credential Details</h3>
                <div className="public-result-meta">
                  <div>
                    <span className="meta-label">Candidate Name</span>
                    <strong>{approvedDetails.certificate.candidateName}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Roll Number</span>
                    <strong>{approvedDetails.certificate.rollNumber}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Course / Degree</span>
                    <strong>{approvedDetails.certificate.course}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Grade / CGPA</span>
                    <strong>{approvedDetails.certificate.grade}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Document Type</span>
                    <strong>{approvedDetails.certificate.documentType}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Issue Date</span>
                    <strong>{new Date(approvedDetails.certificate.issueDate).toLocaleDateString()}</strong>
                  </div>
                </div>
              </>
            )}

            {/* Cryptographic Proofs */}
            <h3 style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>Cryptographic & Blockchain Proofs</h3>
            <div className="public-result-meta">
              <div>
                <span className="meta-label">🏛️ Institute Public Key (Issuer)</span>
                <strong style={{ fontFamily: "monospace", fontSize: "0.85rem", wordBreak: "break-all" }}>
                  {approvedDetails.issuerWallet}
                </strong>
              </div>
              {approvedDetails.studentWallet && (
                <div>
                  <span className="meta-label">🎓 Student Public Key (Recipient)</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "0.85rem", wordBreak: "break-all" }}>
                    {approvedDetails.studentWallet}
                  </strong>
                </div>
              )}
              {approvedDetails.ipfsCid && (
                <div>
                  <span className="meta-label">📦 Decentralized IPFS CID</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "0.85rem", wordBreak: "break-all" }}>
                    {approvedDetails.ipfsCid}
                  </strong>
                </div>
              )}
              {approvedDetails.txHash && (
                <div>
                  <span className="meta-label">⛓️ On-Chain Authorization Hash</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "0.85rem", wordBreak: "break-all" }}>
                    {approvedDetails.txHash}
                  </strong>
                </div>
              )}
            </div>

            {/* View Official Document */}
            <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}>
              <a
                href={`/api/verify/${encodeURIComponent(certId)}/document`}
                target="_blank"
                rel="noreferrer"
                className="button button-primary"
              >
                📄 View Official Verified Document (PDF)
              </a>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setVerificationStatus("idle");
                  setCertId("");
                }}
              >
                Verify Another Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State: Not Found */}
      {verificationStatus === "not_found" && (
        <div className="verification-state card card-pad not-found">
          <div className="verification-state-icon">?</div>
          <div>
            <span className="eyebrow">Record Not Found</span>
            <h2>Certificate Not Found</h2>
            <p>{statusMessage}</p>
            <button className="text-action" onClick={() => setVerificationStatus("idle")}>Try another ID</button>
          </div>
        </div>
      )}

      {/* State: Error */}
      {verificationStatus === "error" && (
        <Alert>{statusMessage}</Alert>
      )}

      {/* Direct PDF Hash Results */}
      {pdfResult && (
        <div className={`verification-state card card-pad ${pdfState}`} style={{ marginTop: "2rem" }}>
          <div className="verification-state-icon">{pdfState === "verified" ? "✓" : "×"}</div>
          <div className="verification-state-copy">
            <div className="verification-state-title">
              <h2>{pdfState === "verified" ? "PDF Hash Integrity Confirmed" : "Hash Mismatch / Invalid"}</h2>
              <span className={`badge ${pdfState === "verified" ? "badge-success" : "badge-neutral"}`}>
                {pdfState === "verified" ? "Intact" : "Altered"}
              </span>
            </div>
            <p>{pdfResult.message}</p>
          </div>
        </div>
      )}
      {pdfError && <Alert style={{ marginTop: "1rem" }}>{pdfError}</Alert>}
    </div>
  );
}
