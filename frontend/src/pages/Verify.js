import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import api, { API_ORIGIN } from "../api";
import { Alert, Button, Field } from "../components/UI";
import {
  connectMetaMaskWallet,
  getConnectedWallet,
  isSepoliaNetwork,
  ensureSepoliaNetwork,
  hasMetaMask,
  SEPOLIA_CHAIN_ID_DEC
} from "../utils/web3";

const CONTRACT_ADDRESS = "0x8a16Eb15A598DA4ed2E7211FEE12b37407907d90";

function formatDate(value) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Compute client-side SHA-256 hash of uploaded file
async function computeSha256(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function Verify() {
  const { certificateId } = useParams();
  const [activeTab, setActiveTab] = useState("verify");

  // Employer Identity & Wallet
  const [employerName, setEmployerName] = useState(() => localStorage.getItem("certchain_employer_name") || "");
  const [employerEmail, setEmployerEmail] = useState(() => localStorage.getItem("certchain_employer_email") || "");
  const [employerWallet, setEmployerWallet] = useState("");
  const [isSepolia, setIsSepolia] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);

  // Search & Upload Input
  const [certId, setCertId] = useState("");
  const [uploadedPdf, setUploadedPdf] = useState(null);
  const [computedFileHash, setComputedFileHash] = useState("");
  const [showOptions, setShowOptions] = useState(false);

  // Verification State
  const [verificationStatus, setVerificationStatus] = useState("idle");
  // "idle" | "loading" | "pending" | "approved" | "tampered" | "revoked" | "rejected" | "not_found" | "error"
  const [statusMessage, setStatusMessage] = useState("");
  const [requestDetails, setRequestDetails] = useState(null);
  const [approvedDetails, setApprovedDetails] = useState(null);
  const [tamperDetails, setTamperDetails] = useState(null);
  const [revokedDetails, setRevokedDetails] = useState(null);
  const [rejectedDetails, setRejectedDetails] = useState(null);

  // Verification Requests History (for employer dashboard)
  const [employerRequests, setEmployerRequests] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Polling
  const [polling, setPolling] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState(true);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Initialize wallet connection and prefill URL params
  useEffect(() => {
    async function initWallet() {
      if (hasMetaMask()) {
        const addr = await getConnectedWallet();
        if (addr) setEmployerWallet(addr);
        const onSepolia = await isSepoliaNetwork();
        setIsSepolia(onSepolia);
      }
    }
    initWallet();

    if (certificateId) {
      const normalized = decodeURIComponent(certificateId).trim().toUpperCase();
      setCertId(normalized);
      checkStatus(normalized);
    }
  }, [certificateId]);

  // Load employer's requests history
  useEffect(() => {
    if (activeTab === "requests" || activeTab === "history" || activeTab === "overview") {
      fetchEmployerHistory();
    }
  }, [activeTab, employerWallet, employerEmail]);

  async function fetchEmployerHistory() {
    setLoadingHistory(true);
    try {
      const queryParam = employerWallet
        ? `?employerWallet=${encodeURIComponent(employerWallet)}`
        : employerEmail
        ? `?employerEmail=${encodeURIComponent(employerEmail)}`
        : "";
      const res = await api.get(`/verify/employer/requests${queryParam}`);
      setEmployerRequests(res.data.requests || []);
    } catch (e) {
      // Ignore background load error
    } finally {
      setLoadingHistory(false);
    }
  }

  // Connect MetaMask
  async function handleConnectWallet() {
    setConnectingWallet(true);
    try {
      await ensureSepoliaNetwork();
      const address = await connectMetaMaskWallet();
      setEmployerWallet(address);
      setIsSepolia(true);
    } catch (err) {
      alert("Failed to connect MetaMask: " + err.message);
    } finally {
      setConnectingWallet(false);
    }
  }

  // Handle PDF file selection & SHA-256 calculation
  async function handlePdfSelect(file) {
    if (!file) {
      setUploadedPdf(null);
      setComputedFileHash("");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please upload a valid PDF document.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      alert("File size exceeds 15 MB limit.");
      return;
    }
    setUploadedPdf(file);
    const hash = await computeSha256(file);
    setComputedFileHash(hash);
  }

  // Check verification status
  async function checkStatus(targetCertId = certId, silent = false) {
    const normalized = targetCertId.trim().toUpperCase();
    if (!normalized) return;
    if (!silent) setVerificationStatus("loading");

    try {
      const res = await api.get(
        `/verify/status/${encodeURIComponent(normalized)}${employerWallet ? `?employerWallet=${employerWallet}` : ""}`
      );

      if (res.data.revoked) {
        setVerificationStatus("revoked");
        setRevokedDetails(res.data);
        setStatusMessage(res.data.message || "This credential has been revoked on Ethereum Sepolia.");
        stopPolling();
      } else if (res.data.status === "rejected") {
        setVerificationStatus("rejected");
        setRejectedDetails(res.data);
        setStatusMessage(res.data.message || "Verification request was rejected by the issuing institution.");
        stopPolling();
      } else if (res.data.approved) {
        setVerificationStatus("approved");
        setApprovedDetails(res.data);
        setStatusMessage(res.data.message || "Certificate verified and authorized on Ethereum Sepolia.");
        stopPolling();
      } else {
        setVerificationStatus("pending");
        setRequestDetails(res.data);
        setStatusMessage(res.data.message || "Awaiting Institute review and on-chain signature.");
      }
    } catch (err) {
      if (!silent) {
        if (err.response?.status === 404) {
          setVerificationStatus("not_found");
          setStatusMessage("No certificate record found matching: " + normalized);
        } else {
          setVerificationStatus("error");
          setStatusMessage(err.response?.data?.message || "Failed to query verification network.");
        }
      }
    }
  }

  // Submit Verification Request
  async function handleVerifySubmit(e) {
    e.preventDefault();
    const normalized = certId.trim().toUpperCase();
    if (!normalized) {
      setStatusMessage("Please enter a Certificate ID");
      setVerificationStatus("error");
      return;
    }

    // Persist employer contact info locally for convenience
    if (employerName) localStorage.setItem("certchain_employer_name", employerName);
    if (employerEmail) localStorage.setItem("certchain_employer_email", employerEmail);

    setVerificationStatus("loading");
    setApprovedDetails(null);
    setRequestDetails(null);
    setTamperDetails(null);
    setRevokedDetails(null);
    setRejectedDetails(null);

    try {
      const formData = new FormData();
      formData.append("certId", normalized);
      formData.append("employerName", employerName.trim() || "Prospective Employer");
      formData.append("employerEmail", employerEmail.trim());
      formData.append("employerWallet", employerWallet.trim());
      if (uploadedPdf) {
        formData.append("document", uploadedPdf);
      }

      const res = await api.post("/verify/request", formData);

      if (res.data.tamperStatus === "TAMPERED") {
        setVerificationStatus("tampered");
        setTamperDetails(res.data);
        setStatusMessage(res.data.message);
      } else if (res.data.tamperStatus === "REVOKED") {
        setVerificationStatus("revoked");
        setRevokedDetails(res.data);
        setStatusMessage("This credential has been revoked on Ethereum Sepolia.");
      } else if (res.data.approved) {
        await checkStatus(normalized);
      } else {
        setVerificationStatus("pending");
        setRequestDetails(res.data);
        startPolling(normalized);
      }

      fetchEmployerHistory();
    } catch (err) {
      if (err.response?.status === 404) {
        setVerificationStatus("not_found");
        setStatusMessage("Certificate ID not found on Ethereum Sepolia.");
      } else {
        setVerificationStatus("error");
        setStatusMessage(err.response?.data?.message || "Failed to submit verification request.");
      }
    }
  }

  function startPolling(targetCertId) {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setPolling(true);
    pollTimerRef.current = setInterval(() => {
      checkStatus(targetCertId, true);
    }, 3500);
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPolling(false);
  }

  return (
    <div className="page public-verify-page" style={{ maxWidth: 1040, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Header Banner */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.75rem" }}>
        <div>
          <span className="eyebrow">💼 Stakeholder 2: Employer Verification Workspace</span>
          <h1 style={{ margin: "0.25rem 0" }}>Employer Dashboard & Verification Portal</h1>
          <p className="lead" style={{ margin: 0 }}>
            Independently verify academic certificates, inspect on-chain hashes, and detect document tampering using <strong>Ethereum Sepolia</strong>.
          </p>
        </div>

        {/* Employer Web3 Status Badge */}
        <div className="card" style={{ padding: "0.75rem 1.25rem", background: "#f8fafc", borderColor: "#cbd5e1", minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Employer Wallet
            </span>
            <span style={{ fontSize: "0.75rem", background: isSepolia ? "#dcfce7" : "#fee2e2", color: isSepolia ? "#166534" : "#991b1b", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
              {isSepolia ? `Sepolia (${SEPOLIA_CHAIN_ID_DEC})` : "Sepolia"}
            </span>
          </div>

          {employerWallet ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
              <a
                href={`https://sepolia.etherscan.io/address/${employerWallet}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
              >
                {employerWallet.slice(0, 10)}...{employerWallet.slice(-6)} ↗
              </a>
            </div>
          ) : (
            <Button variant="secondary" onClick={handleConnectWallet} loading={connectingWallet} style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", width: "100%" }}>
              🦊 Connect Employer Wallet
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="dashboard-nav-tabs" aria-label="Employer views">
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "verify" ? "active" : ""}`}
          onClick={() => setActiveTab("verify")}
        >
          🔍 Verify Certificate
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          📊 Overview
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
        >
          📋 Verification Requests ({employerRequests.length})
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "wallet" ? "active" : ""}`}
          onClick={() => setActiveTab("wallet")}
        >
          🦊 Employer Key & Wallet Info
        </button>
      </nav>

      {/* TAB 1: VERIFY CERTIFICATE */}
      {activeTab === "verify" && (
        <div>
          {/* Main Verification Card */}
          <div className="card card-pad" style={{ marginBottom: "2rem", borderTop: "4px solid #2563eb" }}>
            <form onSubmit={handleVerifySubmit}>
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem", fontSize: "0.95rem" }}>
                  Step 1: Enter Candidate Certificate ID *
                </label>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    className="input mono"
                    style={{ flex: 1, minWidth: "min(280px, 100%)", fontSize: "1rem" }}
                    placeholder="e.g. CERT-7F3A2B9C0E1D2F..."
                    value={certId}
                    onChange={(e) => {
                      setCertId(e.target.value);
                      if (verificationStatus !== "idle") setVerificationStatus("idle");
                    }}
                    required
                  />
                  <Button type="submit" loading={verificationStatus === "loading"}>
                    {verificationStatus === "loading" ? "Validating On-Chain..." : "🔍 Check & Request Verification"}
                  </Button>
                </div>
              </div>

              {/* Step 2: Upload Certificate PDF for SHA-256 Tampering Detection */}
              <div style={{ padding: "1.25rem", background: "#f8fafc", borderRadius: 8, border: "2px dashed #cbd5e1", marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    Step 2: Upload Certificate PDF (Optional for Cryptographic Tamper Detection)
                  </label>
                  <span className="crypto-badge">SHA-256 Integrity</span>
                </div>
                <p className="muted small" style={{ margin: "0 0 0.75rem" }}>
                  Upload the PDF document shared by the candidate. The system calculates its exact SHA-256 hash and compares it against the Ethereum Sepolia smart contract to detect any alterations in grades, names, or qualification dates.
                </p>

                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handlePdfSelect(e.target.files?.[0])}
                  style={{ marginBottom: "0.5rem" }}
                />

                {computedFileHash && (
                  <div style={{ marginTop: "0.75rem", background: "#fff", padding: "0.75rem", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#166534", display: "block" }}>
                      ✓ Uploaded Document Cryptographic SHA-256 Fingerprint:
                    </span>
                    <code style={{ fontSize: "0.8rem", wordBreak: "break-all", color: "#0f172a" }}>
                      {computedFileHash}
                    </code>
                  </div>
                )}
              </div>

              {/* Step 3: Organization Details */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowOptions(!showOptions)}
                  style={{ background: "none", border: "none", color: "#2563eb", fontSize: "0.85rem", cursor: "pointer", padding: 0, fontWeight: 600 }}
                >
                  {showOptions ? "▾ Hide Organization Details" : "▸ Add Employer Organization / Recruiter Contact (Optional)"}
                </button>

                {showOptions && (
                  <div className="form-grid-2" style={{ marginTop: "0.75rem" }}>
                    <Field label="Employer / Company Name">
                      <input
                        className="input"
                        placeholder="e.g. Google HR, Tata Consultancy Services"
                        value={employerName}
                        onChange={(e) => setEmployerName(e.target.value)}
                      />
                    </Field>

                    <Field label="Recruiter Email (For Decision Notification)">
                      <input
                        type="email"
                        className="input"
                        placeholder="hr@company.com"
                        value={employerEmail}
                        onChange={(e) => setEmployerEmail(e.target.value)}
                      />
                    </Field>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* STATUS 1: TAMPERED STATE */}
          {verificationStatus === "tampered" && (
            <div className="card card-pad" style={{ borderLeft: "6px solid #dc2626", background: "#fef2f2", marginBottom: "2rem" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "2.5rem" }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <h2 style={{ color: "#991b1b", margin: 0, fontSize: "1.35rem" }}>
                      🔴 DOCUMENT TAMPERING DETECTED!
                    </h2>
                    <span className="badge badge-revoked" style={{ fontWeight: 700 }}>
                      HASH MISMATCH
                    </span>
                  </div>
                  <p style={{ color: "#7f1d1d", margin: "0.5rem 0 1rem", fontSize: "0.95rem" }}>
                    The cryptographic SHA-256 hash of the uploaded PDF <strong>does not match</strong> the immutable commitment stored on Ethereum Sepolia for Certificate ID <code>{certId}</code>.
                  </p>

                  <div style={{ background: "#fff", padding: "1rem", borderRadius: 8, border: "1px solid #fecaca", fontSize: "0.85rem", display: "grid", gap: "0.5rem" }}>
                    <div>
                      <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>Uploaded PDF Hash:</span>
                      <code style={{ wordBreak: "break-all", color: "#dc2626" }}>{tamperDetails?.uploadedDocumentHash}</code>
                    </div>
                    <div>
                      <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>Authentic On-Chain Blockchain Hash:</span>
                      <code style={{ wordBreak: "break-all", color: "#166534" }}>{tamperDetails?.blockchainHash}</code>
                    </div>
                  </div>

                  <p style={{ color: "#991b1b", fontSize: "0.85rem", marginTop: "0.75rem", marginBottom: 0 }}>
                    ⛔ <strong>Notice for Employer:</strong> This document has been altered after its official issuance. The issuing institution has been flagged and will not approve this document.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STATUS 2: REVOKED STATE */}
          {verificationStatus === "revoked" && (
            <div className="card card-pad" style={{ borderLeft: "6px solid #b91c1c", background: "#fef2f2", marginBottom: "2rem" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "2.5rem" }}>🚫</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <h2 style={{ color: "#991b1b", margin: 0, fontSize: "1.35rem" }}>
                      Credential Revoked on Ethereum Sepolia
                    </h2>
                    <span className="badge badge-revoked" style={{ fontWeight: 700 }}>
                      REVOKED
                    </span>
                  </div>
                  <p style={{ color: "#7f1d1d", margin: "0.5rem 0 1rem", fontSize: "0.95rem" }}>
                    Certificate <strong>{certId}</strong> has been revoked by issuing authority <strong>{revokedDetails?.institutionId || "the University"}</strong>.
                  </p>
                  {revokedDetails?.revocationTxHash && (
                    <div style={{ fontSize: "0.85rem" }}>
                      <span className="muted">On-Chain Revocation Transaction: </span>
                      <a href={`https://sepolia.etherscan.io/tx/${revokedDetails.revocationTxHash}`} target="_blank" rel="noreferrer" style={{ fontFamily: "monospace", color: "#b91c1c", textDecoration: "underline" }}>
                        {revokedDetails.revocationTxHash.slice(0, 14)}... ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STATUS 3: REJECTED STATE */}
          {verificationStatus === "rejected" && (
            <div className="card card-pad" style={{ borderLeft: "6px solid #dc2626", background: "#fff1f2", marginBottom: "2rem" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "2.5rem" }}>✕</span>
                <div style={{ flex: 1 }}>
                  <h2 style={{ color: "#9f1239", margin: "0 0 0.5rem", fontSize: "1.35rem" }}>
                    Verification Request Rejected by Institution
                  </h2>
                  <p style={{ color: "#881337", margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
                    The issuing institution reviewed this request and declined authorization.
                  </p>
                  {rejectedDetails?.rejectionReason && (
                    <div style={{ background: "#fff", padding: "0.75rem", borderRadius: 6, border: "1px solid #fecdd3", fontSize: "0.85rem" }}>
                      <strong>Institution Feedback:</strong> {rejectedDetails.rejectionReason}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STATUS 4: PENDING GATE STATE */}
          {verificationStatus === "pending" && (
            <div className="card card-pad" style={{ borderLeft: "6px solid #f59e0b", background: "#fffdf5", marginBottom: "2rem" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div style={{ fontSize: "2.5rem" }}>⏳</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <h2 style={{ margin: 0, color: "#92400e", fontSize: "1.35rem" }}>
                      Verification Request Awaiting Institute Approval
                    </h2>
                    <span className="badge" style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" }}>
                      Pending Institute Review
                    </span>
                  </div>
                  <p style={{ color: "#78350f", margin: "0.5rem 0 1rem", fontSize: "0.95rem" }}>
                    Certificate <strong>{certId}</strong> was located in the blockchain registry. The issuing institution (<strong>{requestDetails?.institutionId || "University"}</strong>) has been notified to verify candidate identity and approve record disclosure.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <span style={{ color: "#059669", fontWeight: 600, fontSize: "0.85rem" }}>
                      {polling ? "● Polling blockchain for instant approval..." : "Waiting for review"}
                    </span>
                    <Button type="button" variant="secondary" onClick={() => checkStatus(certId)} style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}>
                      🔄 Check Status Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STATUS 5: APPROVED & FULLY VERIFIED CREDENTIAL VIEW */}
          {verificationStatus === "approved" && approvedDetails && (
            <div style={{ display: "grid", gap: "1.5rem", marginBottom: "2rem" }}>
              {/* Official Verification Header */}
              <div
                className="card card-pad"
                style={{
                  borderLeft: "6px solid #10b981",
                  background: "linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#d1fae5", color: "#065f46", padding: "3px 10px", borderRadius: "9999px", fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.5rem" }}>
                      <span>✓</span> 100% AUTHENTIC & VERIFIED CREDENTIAL
                    </span>
                    <h2 style={{ margin: "0.25rem 0 0.25rem", color: "#065f46", fontSize: "1.5rem" }}>
                      Academic Credential Confirmed on Ethereum
                    </h2>
                    <p className="muted small" style={{ margin: 0 }}>
                      Issued by <strong>{approvedDetails.institutionId}</strong> · Tamper-proof cryptographic record verified.
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => window.print()}
                      style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                    >
                      🖨️ Print Proof
                    </button>
                    <a
                      href={`${API_ORIGIN}/api/verify/${encodeURIComponent(certId)}/document`}
                      target="_blank"
                      rel="noreferrer"
                      className="button button-primary"
                      style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                    >
                      📥 Download Original PDF
                    </a>
                  </div>
                </div>

                {/* Candidate Academic Details */}
                {approvedDetails.certificate && (
                  <div style={{ marginTop: "1.25rem", background: "#ffffff", padding: "1.25rem", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                    <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "#0f172a" }}>
                      🎓 Candidate Academic Record
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: "1rem" }}>
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

                {/* Independent Blockchain Evidence Section */}
                <div style={{ marginTop: "1.5rem", borderTop: "1px solid #bbf7d0", paddingTop: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h4 style={{ margin: 0, color: "#166534" }}>🛡️ Independent Blockchain Verification Evidence</h4>
                    <span className="crypto-badge">Ethereum Sepolia (11155111)</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", fontSize: "0.85rem", background: "#f8fafc", padding: "1rem", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div>
                      <span className="meta-label">Registry Contract</span>
                      <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" style={{ fontFamily: "monospace", color: "#2563eb" }}>
                        {CONTRACT_ADDRESS.slice(0, 10)}... ↗
                      </a>
                    </div>
                    <div>
                      <span className="meta-label">Issuing Authority Wallet</span>
                      <a href={`https://sepolia.etherscan.io/address/${approvedDetails.issuerWallet}`} target="_blank" rel="noreferrer" style={{ fontFamily: "monospace", color: "#2563eb" }}>
                        {approvedDetails.issuerWallet ? approvedDetails.issuerWallet.slice(0, 10) + "..." : approvedDetails.institutionId} ↗
                      </a>
                    </div>
                    <div>
                      <span className="meta-label">Student Recipient Wallet</span>
                      <span style={{ fontFamily: "monospace" }}>
                        {approvedDetails.studentWallet ? approvedDetails.studentWallet.slice(0, 10) + "..." : "Self-Sovereign Identity"}
                      </span>
                    </div>
                    <div>
                      <span className="meta-label">Sepolia Transaction Hash</span>
                      {approvedDetails.txHash && approvedDetails.txHash.startsWith("0x") ? (
                        <a href={`https://sepolia.etherscan.io/tx/${approvedDetails.txHash}`} target="_blank" rel="noreferrer" style={{ fontFamily: "monospace", color: "#2563eb", textDecoration: "underline" }}>
                          {approvedDetails.txHash.slice(0, 10)}... ↗
                        </a>
                      ) : (
                        <span style={{ color: "#059669", fontWeight: 600 }}>Confirmed on Sepolia</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STATUS 6: NOT FOUND STATE */}
          {verificationStatus === "not_found" && (
            <div className="card card-pad" style={{ textAlign: "center", padding: "2.5rem 1rem", marginBottom: "2rem" }}>
              <span style={{ fontSize: "2.5rem" }}>❓</span>
              <h3 style={{ margin: "0.5rem 0" }}>Certificate Not Found on Blockchain</h3>
              <p className="muted small" style={{ maxWidth: 460, margin: "0 auto 1.25rem" }}>
                No academic credential record was found on Ethereum Sepolia matching <code>{certId}</code>. Please double-check the ID shared by the candidate.
              </p>
              <Button type="button" variant="secondary" onClick={() => setVerificationStatus("idle")}>
                Try Another Certificate ID
              </Button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OVERVIEW */}
      {activeTab === "overview" && (
        <div>
          <section className="dashboard-stats" aria-label="Employer verification stats">
            <StatCard label="Total Verified" value={employerRequests.filter((r) => r.status === "approved").length} detail="Authenticated degrees" tone="green" />
            <StatCard label="Pending Review" value={employerRequests.filter((r) => r.status === "pending").length} detail="Awaiting institute" tone="blue" />
            <StatCard label="Tamper Flags" value={employerRequests.filter((r) => r.tamperStatus === "TAMPERED").length} detail="Hash mismatches" tone="red" />
            <StatCard label="Total Queries" value={employerRequests.length} detail="All verification attempts" tone="blue" />
          </section>

          <article className="card card-pad" style={{ marginTop: "1.5rem" }}>
            <h3 style={{ margin: "0 0 0.5rem" }}>💡 CertChain Three-Stakeholder Verification Flow</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
              <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <strong>1. Blockchain Verification</strong>
                <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                  Reads the immutable smart contract record on Sepolia to verify the credential was issued by an authorized institute and remains active.
                </p>
              </div>
              <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <strong>2. Document Integrity Check</strong>
                <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                  Hashes the candidate's uploaded PDF with SHA-256. If even one letter or grade digit is modified, tampering is instantly flagged.
                </p>
              </div>
              <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <strong>3. Institute Authorization</strong>
                <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                  The issuing institution's authorized administrative wallet confirms and signs the disclosure of student records to the employer.
                </p>
              </div>
            </div>
          </article>
        </div>
      )}

      {/* TAB 3: VERIFICATION REQUESTS QUEUE & HISTORY */}
      {(activeTab === "requests" || activeTab === "history") && (
        <article className="card dashboard-panel">
          <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2>Your Verification Requests History</h2>
              <p className="muted small">All certificate queries and authorization decisions for your organization.</p>
            </div>
            <Button variant="secondary" onClick={fetchEmployerHistory} loading={loadingHistory} style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}>
              🔄 Refresh History
            </Button>
          </div>

          {employerRequests.length === 0 ? (
            <div className="dashboard-empty" style={{ padding: "3rem 1rem", textAlign: "center" }}>
              <h3>No verification requests found</h3>
              <p className="muted small">Enter a Certificate ID in the "Verify Certificate" tab to submit your first query.</p>
              <Button onClick={() => setActiveTab("verify")}>Verify a Certificate</Button>
            </div>
          ) : (
            <div className="certificate-table-wrap">
              <table className="certificate-table">
                <thead>
                  <tr>
                    <th>Certificate ID</th>
                    <th>Candidate</th>
                    <th>Course & Institution</th>
                    <th>Tamper Check</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employerRequests.map((req) => (
                    <tr key={req.requestId || req._id}>
                      <td data-label="Certificate ID">
                        <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563eb" }}>
                          {req.certId}
                        </span>
                      </td>
                      <td data-label="Candidate">
                        <strong>{req.candidateName || "Student"}</strong>
                      </td>
                      <td data-label="Course">
                        <strong>{req.course || "Degree"}</strong>
                        <small>{req.institutionId}</small>
                      </td>
                      <td data-label="Tamper Check">
                        {req.tamperStatus === "NOT_TAMPERED" ? (
                          <span style={{ color: "#065f46", background: "#ecfdf5", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: "0.75rem" }}>
                            🟢 HASH MATCH
                          </span>
                        ) : req.tamperStatus === "TAMPERED" ? (
                          <span style={{ color: "#991b1b", background: "#fef2f2", padding: "2px 8px", borderRadius: 4, fontWeight: 700, fontSize: "0.75rem" }}>
                            🔴 TAMPERED
                          </span>
                        ) : req.tamperStatus === "REVOKED" ? (
                          <span style={{ color: "#991b1b", background: "#fef2f2", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: "0.75rem" }}>
                            🚫 REVOKED
                          </span>
                        ) : (
                          <span style={{ color: "#64748b", background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem" }}>
                            ⚪ NO PDF
                          </span>
                        )}
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${req.status === "approved" ? "badge-success" : req.status === "rejected" ? "badge-revoked" : "badge-neutral"}`}>
                          {req.status === "approved" ? "✓ VERIFIED" : req.status === "rejected" ? "REJECTED" : "⏳ PENDING"}
                        </span>
                      </td>
                      <td data-label="Date">
                        <small>{formatDate(req.requestedAt)}</small>
                      </td>
                      <td data-label="Action">
                        <Button
                          type="button"
                          variant="secondary"
                          style={{ fontSize: "0.75rem", padding: "0.3rem 0.5rem" }}
                          onClick={() => {
                            setCertId(req.certId);
                            setActiveTab("verify");
                            checkStatus(req.certId);
                          }}
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}

      {/* TAB 4: EMPLOYER WALLET INFO */}
      {activeTab === "wallet" && (
        <article className="card card-pad" style={{ maxWidth: 740, margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 0.5rem" }}>Employer Web3 Identity & Key Management</h2>
          <p className="muted small" style={{ margin: "0 0 1.5rem" }}>
            Employers interact with CertChain through their individual Ethereum wallet identity.
          </p>

          <div style={{ background: "#f8fafc", padding: "1.25rem", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: "1.5rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <span className="muted small" style={{ display: "block" }}>Connected Public Address:</span>
              <strong style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "#0f172a" }}>
                {employerWallet || "No wallet connected"}
              </strong>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <span className="muted small" style={{ display: "block" }}>Blockchain Network:</span>
              <strong>Ethereum Sepolia Testnet (Chain ID: 11155111)</strong>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <span className="muted small" style={{ display: "block" }}>Network Status:</span>
              <span style={{ color: isSepolia ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                {isSepolia ? "✓ Connected to Sepolia Testnet" : "⚠️ Incorrect network. Switch to Sepolia in MetaMask."}
              </span>
            </div>

            <div>
              <span className="muted small" style={{ display: "block" }}>Security Boundary:</span>
              <span style={{ fontSize: "0.85rem", color: "#334155" }}>
                Employers can submit verification requests and inspect on-chain proofs. Smart contract access control ensures employers cannot issue, modify, or revoke academic credentials.
              </span>
            </div>
          </div>

          <Button onClick={handleConnectWallet} style={{ width: "100%" }}>
            🦊 Reconnect / Switch Employer MetaMask Account
          </Button>
        </article>
      )}
    </div>
  );
}
