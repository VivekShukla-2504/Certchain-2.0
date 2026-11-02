import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import api, { API_ORIGIN } from "../api";
import { Alert, Button, Field, StatCard } from "../components/UI";
import {
  connectMetaMaskWallet,
  getConnectedWallet,
  isSepoliaNetwork,
  ensureSepoliaNetwork,
  hasMetaMask,
  SEPOLIA_CHAIN_ID_DEC,
  verifyDirectOnChain,
  authenticateStakeholderWallet,
  disconnectWallet
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
  const [employerWallet, setEmployerWallet] = useState(() => localStorage.getItem("certchain_employer_wallet") || "");
  const [isSepolia, setIsSepolia] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [isEmployerAuthenticated, setIsEmployerAuthenticated] = useState(() => {
    return localStorage.getItem("certchain_role") === "employer" && !!localStorage.getItem("certchain_token");
  });

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

  // Direct Trustless EVM Verification
  const [directEvmLoading, setDirectEvmLoading] = useState(false);
  const [isDirectEvmVerified, setIsDirectEvmVerified] = useState(false);

  // Printable Verification Audit Report Modal
  const [showAuditModal, setShowAuditModal] = useState(false);

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
      if (localStorage.getItem("certchain_role") === "employer" && !!localStorage.getItem("certchain_token")) {
        checkStatus(normalized);
      }
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
      const trackedJson = localStorage.getItem("certchain_employer_tracked_ids") || "[]";
      let tracked = [];
      try { tracked = JSON.parse(trackedJson); } catch (e) {}

      // If user hasn't connected wallet, hasn't entered email, and has no tracked requests
      if (!employerWallet && !employerEmail && tracked.length === 0) {
        setEmployerRequests([]);
        setLoadingHistory(false);
        return;
      }

      const params = new URLSearchParams();
      if (employerWallet) params.append("employerWallet", employerWallet.trim());
      if (employerEmail) params.append("employerEmail", employerEmail.trim());
      if (tracked.length > 0) params.append("requestIds", tracked.join(","));

      const res = await api.get(`/verify/employer/requests?${params.toString()}`);
      setEmployerRequests(res.data.requests || []);
    } catch (e) {
      // Ignore background load error
    } finally {
      setLoadingHistory(false);
    }
  }

  // Connect MetaMask (Standard Web3 connection)
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

  // Web3 Cryptographic Wallet Authentication for Recruiter Workspace
  async function handleSignInWithEmployerWallet() {
    setConnectingWallet(true);
    try {
      await ensureSepoliaNetwork();
      const auth = await authenticateStakeholderWallet("employer");
      // Clean up any stale sessions from other roles
      localStorage.removeItem("certchain_institution");
      localStorage.removeItem("certchain_student");
      localStorage.removeItem("certchain_student_wallet");

      localStorage.setItem("certchain_token", auth.token);
      localStorage.setItem("certchain_role", "employer");
      localStorage.setItem("certchain_employer_wallet", auth.walletAddress);

      setEmployerWallet(auth.walletAddress);
      setIsEmployerAuthenticated(true);
      setIsSepolia(true);
      fetchEmployerHistory();

      const targetCert = certId || (certificateId ? decodeURIComponent(certificateId).trim().toUpperCase() : "");
      if (targetCert) {
        checkStatus(targetCert);
      }
    } catch (err) {
      alert("Employer Web3 Authentication failed: " + err.message);
    } finally {
      setConnectingWallet(false);
    }
  }

  function handleEmployerLogout() {
    disconnectWallet();
    localStorage.removeItem("certchain_token");
    localStorage.removeItem("certchain_role");
    localStorage.removeItem("certchain_employer_wallet");
    setEmployerWallet("");
    setIsEmployerAuthenticated(false);
    setEmployerRequests([]);
    setVerificationStatus("idle");
    setApprovedDetails(null);
    setTamperDetails(null);
    setRevokedDetails(null);
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

      if (res.data.requestId) {
        const trackedJson = localStorage.getItem("certchain_employer_tracked_ids") || "[]";
        let tracked = [];
        try { tracked = JSON.parse(trackedJson); } catch (e) {}
        if (!tracked.includes(res.data.requestId)) {
          tracked.push(res.data.requestId);
          localStorage.setItem("certchain_employer_tracked_ids", JSON.stringify(tracked));
        }
      }

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

  async function handleDirectEvmVerify() {
    const normalized = certId.trim().toUpperCase();
    if (!normalized) {
      setStatusMessage("Please enter a Certificate ID first");
      setVerificationStatus("error");
      return;
    }
    setDirectEvmLoading(true);
    setVerificationStatus("loading");
    setStatusMessage("Querying Ethereum Sepolia Smart Contract directly (Zero Backend / MongoDB)...");
    setApprovedDetails(null);
    setRequestDetails(null);
    setTamperDetails(null);
    setRevokedDetails(null);
    setRejectedDetails(null);
    setIsDirectEvmVerified(false);

    try {
      const res = await verifyDirectOnChain(normalized, computedFileHash);
      if (!res.found) {
        setVerificationStatus("not_found");
        setStatusMessage(res.message);
      } else if (res.status === "REVOKED") {
        setVerificationStatus("revoked");
        setRevokedDetails({
          certId: res.certId,
          institutionId: res.institutionId,
          message: "Credential revoked on Ethereum Sepolia",
          revocationTxHash: ""
        });
        setStatusMessage("This credential has been revoked on Ethereum Sepolia.");
      } else if (res.status === "TAMPERED") {
        setVerificationStatus("tampered");
        setTamperDetails({
          certId: res.certId,
          uploadedDocumentHash: computedFileHash,
          blockchainHash: res.certHash
        });
        setStatusMessage("Cryptographic SHA-256 mismatch: Uploaded PDF has been modified!");
      } else {
        setIsDirectEvmVerified(true);
        setVerificationStatus("approved");
        setApprovedDetails({
          certId: res.certId,
          institutionId: res.institutionId,
          issuerWallet: res.issuer,
          studentWallet: res.recipient,
          ipfsCid: res.ipfsCid,
          certHash: res.certHash,
          directOnChain: true,
          issuedAt: res.issuedAtDate,
          certificate: {
            candidateName: "On-Chain Verified Graduate",
            rollNumber: res.recipient ? res.recipient.slice(0, 10) + "..." : "Sovereign Wallet",
            course: "Verified Academic Credential",
            grade: "Verified On-Chain",
            documentType: "Decentralized Degree / Diploma",
            issueDate: res.issuedAtDate
          }
        });
        setStatusMessage("100% Authenticated Directly from Ethereum Sepolia EVM (Zero Backend Dependency)");
      }
    } catch (err) {
      setVerificationStatus("error");
      setStatusMessage("Direct EVM query failed: " + err.message);
    } finally {
      setDirectEvmLoading(false);
    }
  }

  return (
    <div className="page public-verify-page" style={{ maxWidth: 1040, margin: "0 auto", padding: "2rem 1rem" }}>
      {!isEmployerAuthenticated ? (
        <div
          className="card card-pad text-center"
          style={{
            margin: "3rem auto",
            maxWidth: 620,
            padding: "3.5rem 2rem",
            borderTop: "4px solid #2563eb",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)"
          }}
        >
          <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🔐</div>
          <span className="eyebrow" style={{ color: "#2563eb", marginBottom: "0.5rem", display: "inline-block" }}>
            Access Restricted
          </span>
          <h2 style={{ margin: "0.25rem 0 0.75rem", fontSize: "1.6rem" }}>
            Employer Web3 Signature Required
          </h2>
          <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6, maxWidth: 500, margin: "0 auto 2rem" }}>
            To safeguard student privacy and verify credential authenticity, employers and recruiters must sign in using their Web3 wallet.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
            <Button
              variant="primary"
              onClick={handleSignInWithEmployerWallet}
              loading={connectingWallet}
              style={{ fontSize: "1rem", padding: "0.75rem 1.75rem" }}
            >
              🦊 Sign In with MetaMask
            </Button>
          </div>

          <div
            style={{
              marginTop: "2.25rem",
              padding: "1rem 1.25rem",
              background: "var(--cc-cloud)",
              borderRadius: 8,
              border: "1px solid var(--cc-line)",
              fontSize: "0.85rem",
              color: "#64748b",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem"
            }}
          >
            <span style={{ fontSize: "1.4rem" }}>🛡️</span>
            <div>
              <strong style={{ color: "var(--cc-ink)" }}>Gasless Cryptographic Authentication:</strong>
              <div>Signature is verified off-chain via EIP-191 / EIP-712. Zero gas fees are incurred.</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header Banner */}
          <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.75rem" }}>
            <div>
              <span className="eyebrow">Enterprise Verifier Workspace</span>
              <h1 style={{ margin: "0.25rem 0" }}>Employer Verification Portal</h1>
              <p className="lead" style={{ margin: 0 }}>
                Independently verify academic credentials, inspect on-chain hashes, and detect document tampering.
              </p>
            </div>

            {/* Employer Web3 Status Badge */}
            <div className="card" style={{ padding: "0.75rem 1.25rem", background: "var(--cc-cloud)", borderColor: "var(--cc-line)", minWidth: 280 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Employer Wallet
                </span>
              </div>

              {employerWallet ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.4rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                      <a
                        href={`https://sepolia.etherscan.io/address/${employerWallet}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
                      >
                        {employerWallet.slice(0, 8)}...{employerWallet.slice(-6)} ↗
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={handleEmployerLogout}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        color: "#ef4444",
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontWeight: 600
                      }}
                      title="Sign out of employer session"
                    >
                      Sign Out ⎋
                    </button>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "#10b981", display: "block", marginTop: "2px", fontWeight: 600 }}>
                    ✓ Web3 Verified Recruiter Session
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="dashboard-nav-tabs" aria-label="Employer views">
            <button
              type="button"
              className={`dashboard-nav-tab ${activeTab === "verify" ? "active" : ""}`}
              onClick={() => setActiveTab("verify")}
            >
              Verify Credential
            </button>
            <button
              type="button"
              className={`dashboard-nav-tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Protocol Overview
            </button>
            <button
              type="button"
              className={`dashboard-nav-tab ${activeTab === "requests" ? "active" : ""}`}
              onClick={() => setActiveTab("requests")}
            >
              Confidential Verification History ({employerRequests.length})
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
                      Enter Candidate Certificate ID *
                    </label>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "stretch" }}>
                      <input
                        type="text"
                        className="input mono"
                        style={{ flex: 1, minWidth: "min(280px, 100%)", fontSize: "1rem" }}
                        placeholder="e.g. CERT-7F3A2B9C0E1D2F..."
                        value={certId}
                        onChange={(e) => {
                          setCertId(e.target.value);
                          if (verificationStatus !== "idle") setVerificationStatus("idle");
                          setIsDirectEvmVerified(false);
                        }}
                        required
                      />
                      <Button type="submit" loading={verificationStatus === "loading" && !directEvmLoading}>
                        {verificationStatus === "loading" && !directEvmLoading ? "Validating On-Chain..." : "Verify & Request Access"}
                      </Button>
                      <button
                        type="button"
                        onClick={handleDirectEvmVerify}
                        className="button"
                        disabled={directEvmLoading}
                        style={{ background: "#7c3aed", color: "#fff", borderColor: "#6d28d9", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                        title="Direct EVM call to Sepolia node, completely bypassing MongoDB and Backend API"
                      >
                        {directEvmLoading ? "Querying EVM Node..." : "Direct Sepolia EVM Mode (Zero-Trust)"}
                      </button>
                    </div>
                    {isDirectEvmVerified && (
                      <div style={{ marginTop: "0.75rem", padding: "0.6rem 1rem", background: "rgba(124, 58, 237, 0.08)", border: "1px solid rgba(124, 58, 237, 0.25)", borderRadius: 8, display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7", display: "inline-block" }} />
                        <span style={{ fontSize: "0.85rem", color: "#a855f7", fontWeight: 700 }}>
                          Direct Trustless EVM Proof: Verified directly from Ethereum Sepolia smart contract storage mappings (Zero MongoDB or Backend server dependency).
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Organization Details */}
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
                <div style={{ display: "inline-flex", padding: "0.6rem", borderRadius: "8px", background: "#fee2e2", color: "#dc2626" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <span className="status-pill status-pill-danger" style={{ marginBottom: "0.35rem" }}>
                        <span className="status-dot danger" /> Cryptographic Integrity Failure
                      </span>
                      <h2 style={{ color: "#991b1b", margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                        Document Modification (Tampering) Detected
                      </h2>
                    </div>
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
                    <strong>Security Advisory:</strong> This document has been modified after official issuance. The issuing authority's cryptographic proof does not match this file.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STATUS 2: REVOKED STATE */}
          {verificationStatus === "revoked" && (
            <div className="card card-pad" style={{ borderLeft: "6px solid #b91c1c", background: "#fef2f2", marginBottom: "2rem" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div style={{ display: "inline-flex", padding: "0.6rem", borderRadius: "8px", background: "#fee2e2", color: "#dc2626" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <span className="status-pill status-pill-danger" style={{ marginBottom: "0.35rem" }}>
                        <span className="status-dot danger" /> Revoked on Ledger
                      </span>
                      <h2 style={{ color: "#991b1b", margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                        Credential Revoked on Ethereum Sepolia
                      </h2>
                    </div>
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
                  borderLeft: "6px solid var(--cc-green)",
                  background: "var(--cc-paper)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(16, 185, 129, 0.12)", color: "var(--cc-green)", padding: "3px 10px", borderRadius: "9999px", fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.5rem" }}>
                      <span>✓</span> 100% AUTHENTIC & VERIFIED CREDENTIAL
                    </span>
                    <h2 style={{ margin: "0.25rem 0 0.25rem", color: "var(--cc-green)", fontSize: "1.5rem" }}>
                      Academic Credential Confirmed on Ethereum
                    </h2>
                    <p className="muted small" style={{ margin: 0 }}>
                      Issued by <strong>{approvedDetails.institutionId}</strong> · Tamper-proof cryptographic record verified.
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      className="button"
                      onClick={() => setShowAuditModal(true)}
                      style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem", background: "#0284c7", color: "#fff", fontWeight: 700, borderColor: "#0369a1" }}
                    >
                      Audit Receipt
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => window.print()}
                      style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                    >
                      Print Proof
                    </button>
                  </div>
                </div>

                {/* Candidate Academic Details */}
                {approvedDetails.certificate && (
                  <div style={{ marginTop: "1.25rem", background: "var(--cc-cloud)", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--cc-line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                      <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--cc-ink)" }}>
                        🎓 Candidate Academic Record
                      </h3>
                    </div>
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
                <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--cc-line)", paddingTop: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h4 style={{ margin: 0, color: "var(--cc-green)" }}>🛡️ Independent Blockchain Verification Evidence</h4>
                    <span className="crypto-badge">Ethereum Sepolia (11155111)</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", fontSize: "0.85rem", background: "var(--cc-cloud)", padding: "1rem", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
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
              <div style={{ background: "var(--cc-cloud)", padding: "1rem", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
                <strong>1. Blockchain Verification</strong>
                <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                  Reads the immutable smart contract record on Sepolia to verify the credential was issued by an authorized institute and remains active.
                </p>
              </div>
              <div style={{ background: "var(--cc-cloud)", padding: "1rem", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
                <strong>2. Document Integrity Check</strong>
                <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                  Hashes the candidate's uploaded PDF with SHA-256. If even one letter or grade digit is modified, tampering is instantly flagged.
                </p>
              </div>
              <div style={{ background: "var(--cc-cloud)", padding: "1rem", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <span className="status-pill status-pill-verified">
                  <span className="status-dot verified" /> Cryptographically Isolated Session
                </span>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Zero Data Leakage Enforced</span>
              </div>
              <h2 style={{ margin: "0.25rem 0" }}>Confidential Verification History</h2>
              <p className="muted small" style={{ margin: 0 }}>
                Verification requests and candidate audit trails are strictly isolated to your organization's wallet or recruiter session.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <Button variant="secondary" onClick={fetchEmployerHistory} loading={loadingHistory} style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}>
                Refresh
              </Button>
              {employerRequests.length > 0 && (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    if (window.confirm("Clear all tracked background checks from this local workstation session?")) {
                      localStorage.removeItem("certchain_employer_tracked_ids");
                      setEmployerRequests([]);
                    }
                  }}
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", color: "#dc2626" }}
                  title="Wipe locally stored request tracking IDs from this device"
                >
                  Clear Session Cache
                </button>
              )}
            </div>
          </div>

          {employerRequests.length === 0 ? (
            <div className="confidential-vault-card">
              <div style={{ display: "inline-flex", padding: "0.75rem", borderRadius: "12px", background: "rgba(100, 116, 139, 0.1)", color: "var(--cc-subtle)", marginBottom: "0.75rem" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h3 style={{ margin: "0 0 0.5rem", color: "var(--cc-ink)", fontSize: "1.15rem" }}>
                Confidential Recruiter Workspace (Zero Data Leakage)
              </h3>
              <p className="muted small" style={{ maxWidth: 520, margin: "0 auto 1.25rem", lineHeight: 1.6 }}>
                Verification records and candidate background checks are cryptographically isolated. Unauthenticated visitors or other companies cannot view your requests. Connect your organization wallet ({employerWallet ? <code style={{ color: "#2563eb" }}>{employerWallet.slice(0, 10)}...</code> : "Not connected"}) or submit a certificate query to track candidates.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                <Button onClick={() => setActiveTab("verify")}>Submit New Background Check</Button>
                {!employerWallet && (
                  <Button variant="secondary" onClick={handleConnectWallet}>
                    Connect Employer Wallet
                  </Button>
                )}
              </div>
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
                          <span className="status-pill status-pill-success">
                            <span className="status-dot success" /> Hash Match
                          </span>
                        ) : req.tamperStatus === "TAMPERED" ? (
                          <span className="status-pill status-pill-danger">
                            <span className="status-dot danger" /> Tampered
                          </span>
                        ) : req.tamperStatus === "REVOKED" ? (
                          <span className="status-pill status-pill-danger">
                            <span className="status-dot danger" /> Revoked
                          </span>
                        ) : (
                          <span className="status-pill status-pill-neutral">
                            No PDF
                          </span>
                        )}
                      </td>
                      <td data-label="Status">
                        {req.status === "approved" ? (
                          <span className="status-pill status-pill-verified">
                            <span className="status-dot verified" /> Authorized On-Chain
                          </span>
                        ) : req.status === "rejected" ? (
                          <span className="status-pill status-pill-danger">
                            <span className="status-dot danger" /> Rejected
                          </span>
                        ) : (
                          <span className="status-pill status-pill-warning">
                            <span className="status-dot warning" /> Pending Review
                          </span>
                        )}
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

          <div style={{ background: "var(--cc-cloud)", padding: "1.25rem", borderRadius: 8, border: "1px solid var(--cc-line)", marginBottom: "1.5rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <span className="muted small" style={{ display: "block" }}>Connected Public Address:</span>
              <strong style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "var(--cc-ink)" }}>
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
              <span style={{ fontSize: "0.85rem", color: "var(--cc-muted)" }}>
                Employers can submit verification requests and inspect on-chain proofs. Smart contract access control ensures employers cannot issue, modify, or revoke academic credentials.
              </span>
            </div>
          </div>

          <Button onClick={handleConnectWallet} style={{ width: "100%" }}>
            Reconnect / Switch Employer Account
          </Button>
        </article>
      )}
      </>
    )}

      {/* MODAL: OFFICIAL BLOCKCHAIN VERIFICATION AUDIT CERTIFICATE */}
      {showAuditModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
          <div style={{ background: "var(--cc-paper)", color: "var(--cc-ink)", borderRadius: 12, maxWidth: 660, width: "100%", padding: "2rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", maxHeight: "90vh", overflowY: "auto", border: "2px solid #0284c7" }}>
            <div style={{ textAlign: "center", borderBottom: "2px solid var(--cc-line)", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "inline-flex", padding: "0.75rem", borderRadius: "12px", background: "rgba(2, 132, 199, 0.12)", color: "#0284c7", marginBottom: "0.5rem" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h2 style={{ margin: "0.25rem 0", color: "var(--cc-ink)", textTransform: "uppercase", letterSpacing: "1px", fontSize: "1.35rem" }}>
                Cryptographic Credential Attestation
              </h2>
              <span style={{ fontSize: "0.8rem", color: "var(--cc-subtle)", fontWeight: 700, letterSpacing: "0.5px" }}>
                ETHEREUM SEPOLIA DECENTRALIZED ACADEMIC REGISTRY
              </span>
            </div>

            <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 8, padding: "1rem", textAlign: "center", marginBottom: "1.5rem" }}>
              <span style={{ fontSize: "1.25rem", color: "var(--cc-green)", fontWeight: 800, letterSpacing: "0.5px" }}>
                ✓ 100% VERIFIED AUTHENTIC & UNTAMPERED
              </span>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--cc-green)" }}>
                Cryptographically anchored on Ethereum Sepolia Proof-of-Stake consensus at {new Date().toLocaleString()}.
              </p>
            </div>

            <div style={{ display: "grid", gap: "0.75rem", fontSize: "0.9rem", marginBottom: "1.5rem", background: "var(--cc-cloud)", padding: "1.25rem", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cc-line)", paddingBottom: "0.4rem" }}>
                <span style={{ color: "var(--cc-subtle)" }}>Certificate ID:</span>
                <strong style={{ fontFamily: "monospace", color: "var(--cc-ink)" }}>{certId}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cc-line)", paddingBottom: "0.4rem" }}>
                <span style={{ color: "var(--cc-subtle)" }}>Candidate Name:</span>
                <strong>{approvedDetails?.certificate?.candidateName || "Verified Graduate"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cc-line)", paddingBottom: "0.4rem" }}>
                <span style={{ color: "var(--cc-subtle)" }}>Qualification / Degree:</span>
                <strong style={{ color: "var(--cc-blue)" }}>{approvedDetails?.certificate?.course || "Academic Credential"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cc-line)", paddingBottom: "0.4rem" }}>
                <span style={{ color: "var(--cc-subtle)" }}>Issuing Institution:</span>
                <strong>{approvedDetails?.institutionId || "Authorized University"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cc-line)", paddingBottom: "0.4rem" }}>
                <span style={{ color: "var(--cc-subtle)" }}>Smart Contract Address:</span>
                <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--cc-blue)" }}>
                  {CONTRACT_ADDRESS} ↗
                </a>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cc-line)", paddingBottom: "0.4rem" }}>
                <span style={{ color: "var(--cc-subtle)" }}>Issuer Wallet:</span>
                <code style={{ fontSize: "0.8rem" }}>{approvedDetails?.issuerWallet ? approvedDetails.issuerWallet.slice(0, 16) + "..." : "Authorized University"}</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cc-line)", paddingBottom: "0.4rem" }}>
                <span style={{ color: "var(--cc-subtle)" }}>Student Wallet:</span>
                <code style={{ fontSize: "0.8rem" }}>{approvedDetails?.studentWallet ? approvedDetails.studentWallet.slice(0, 16) + "..." : "Self-Sovereign Identity"}</code>
              </div>
              {approvedDetails?.ipfsCid && (
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--cc-line)", paddingBottom: "0.4rem" }}>
                  <span style={{ color: "var(--cc-subtle)" }}>Decentralized IPFS CID:</span>
                  <code style={{ fontSize: "0.8rem" }}>{approvedDetails.ipfsCid}</code>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--cc-subtle)" }}>Consensus Finality:</span>
                <span style={{ fontWeight: 700, color: "var(--cc-green)" }}>Ethereum PoS (Gasper Protocol)</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <button type="button" className="button button-secondary" onClick={() => setShowAuditModal(false)}>
                Close
              </button>
              <button type="button" className="button button-primary" onClick={() => window.print()}>
                Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
