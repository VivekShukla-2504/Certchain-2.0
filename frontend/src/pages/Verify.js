import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import api, { API_ORIGIN } from "../api";
import { Alert, Button } from "../components/UI";
import { connectMetaMaskWallet } from "../utils/web3";

const CONTRACT_ADDRESS = "0xCa70e753D2DFcd32532Fb3f236B66c9494F01330";

export default function Verify() {
  const { certificateId } = useParams();

  // Search input
  const [certId, setCertId] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [employerName, setEmployerName] = useState("");
  const [employerWallet, setEmployerWallet] = useState("");

  // Verification state
  const [verificationStatus, setVerificationStatus] = useState("idle"); // "idle" | "loading" | "pending" | "approved" | "not_found" | "error"
  const [statusMessage, setStatusMessage] = useState("");
  const [requestDetails, setRequestDetails] = useState(null);
  const [approvedDetails, setApprovedDetails] = useState(null);
  const [polling, setPolling] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState(true);
  const pollTimerRef = useRef(null);

  // Clear polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Pre-fill from URL param if accessed via QR code or direct link
  useEffect(() => {
    if (!certificateId) return;
    const normalized = decodeURIComponent(certificateId).trim().toUpperCase();
    setCertId(normalized);
    checkStatus(normalized);
  }, [certificateId]);

  // Connect MetaMask wallet
  async function handleConnectWallet() {
    try {
      const address = await connectMetaMaskWallet();
      setEmployerWallet(address);
    } catch (err) {
      alert(err.message);
    }
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

      if (res.data.approved) {
        setVerificationStatus("approved");
        setApprovedDetails(res.data);
        setStatusMessage(res.data.message || "Certificate verified and authorized on Ethereum.");
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setPolling(false);
        }
      } else {
        setVerificationStatus("pending");
        setRequestDetails(res.data);
        setStatusMessage(res.data.message || "Awaiting Institute verification.");
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

  // Submit Verification Request
  async function handleVerifySubmit(e) {
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
        employerWallet: employerWallet.trim()
      });

      if (res.data.approved) {
        await checkStatus(normalized);
      } else {
        setVerificationStatus("pending");
        setRequestDetails(res.data);
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

  function startPolling(targetCertId) {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setPolling(true);
    pollTimerRef.current = setInterval(() => {
      checkStatus(targetCertId, true);
    }, 3500);
  }

  return (
    <div className="page public-verify-page" style={{ maxWidth: 980, margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Clean, Focused Header */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "1px", color: "var(--cc-blue)", textTransform: "uppercase" }}>
          💼 Employer Verification
        </span>
        <h1 style={{ fontSize: "2rem", margin: "0.4rem 0 0.5rem" }}>Verify Candidate Certificate</h1>
        <p className="muted small" style={{ maxWidth: 600, margin: "0 auto" }}>
          Verify academic degrees and transcripts anchored to Ethereum Sepolia.
        </p>
      </div>

      {/* Primary Verification Search Bar */}
      <div className="card card-pad" style={{ marginBottom: "2rem", borderTop: "4px solid #2563eb" }}>
        <form onSubmit={handleVerifySubmit}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.95rem" }}>
            Candidate Certificate ID:
          </label>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "stretch" }}>
            <input
              type="text"
              className="input"
              style={{
                flex: 1,
                minWidth: "min(280px, 100%)",
                fontFamily: "monospace",
                fontSize: "1rem",
                letterSpacing: "0.5px"
              }}
              placeholder="e.g. CERT-7F3A2B9C..."
              value={certId}
              onChange={(e) => {
                setCertId(e.target.value);
                if (verificationStatus !== "idle") setVerificationStatus("idle");
              }}
              required
            />
            <Button type="submit" loading={verificationStatus === "loading"}>
              {verificationStatus === "loading" ? "Verifying..." : "🔍 Verify"}
            </Button>
            {certId && verificationStatus !== "idle" && (
              <Button type="button" variant="secondary" onClick={() => checkStatus(certId)}>
                🔄 Refresh
              </Button>
            )}
          </div>

          {/* Optional Organization Details Toggle */}
          <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--cc-line)" }}>
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              style={{
                background: "none",
                border: "none",
                color: "var(--cc-blue)",
                fontSize: "0.85rem",
                cursor: "pointer",
                padding: 0,
                fontWeight: 600
              }}
            >
              {showOptions ? "▾ Hide Organization Details" : "▸ Add Organization Name / Wallet (Optional)"}
            </button>

            {showOptions && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
                <label className="field" style={{ margin: 0 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Your Company / Organization</span>
                  <input
                    className="input"
                    style={{ fontSize: "0.85rem" }}
                    placeholder="e.g. Google HR, Tata Motors"
                    value={employerName}
                    onChange={(e) => setEmployerName(e.target.value)}
                  />
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", fontWeight: 600 }}>
                    <span>Your Sepolia Wallet Address</span>
                    <button
                      type="button"
                      onClick={handleConnectWallet}
                      style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "0.75rem", padding: 0 }}
                    >
                      🦊 Connect MetaMask
                    </button>
                  </span>
                  <input
                    className="input mono"
                    style={{ fontSize: "0.85rem" }}
                    placeholder="0x..."
                    value={employerWallet}
                    onChange={(e) => setEmployerWallet(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* 1. Pending Gate State */}
      {verificationStatus === "pending" && (
        <div className="card card-pad" style={{ borderLeft: "5px solid #f59e0b", background: "#fffdf5", marginBottom: "2rem" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
            <div style={{ fontSize: "2rem" }}>⏳</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <h3 style={{ margin: 0, color: "#92400e" }}>Verification Request Submitted</h3>
                <span className="badge" style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" }}>
                  Awaiting Institute Signature
                </span>
              </div>
              <p style={{ color: "#78350f", margin: "0.5rem 0 1rem", fontSize: "0.9rem" }}>
                Certificate <strong>{certId}</strong> has been located in the blockchain registry. The issuing institution (<strong>{requestDetails?.institutionId || "University"}</strong>) has been requested to verify candidate identity and release academic records.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <span style={{ color: "#059669", fontWeight: 600, fontSize: "0.85rem" }}>
                  {polling ? "● Polling blockchain for instant approval..." : "Waiting"}
                </span>
                <Button type="button" variant="secondary" onClick={() => checkStatus(certId)} style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}>
                  🔄 Check Status Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Approved & Fully Verified Credential View */}
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
                  📥 Download PDF
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

            {/* Official Document Preview */}
            <div style={{ marginTop: "1.5rem", borderTop: "1px solid #bbf7d0", paddingTop: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>📄 Official Verified Certificate Document</strong>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                  onClick={() => setShowDocPreview(!showDocPreview)}
                >
                  {showDocPreview ? "Hide Preview" : "Show Embedded Document"}
                </button>
              </div>

              {showDocPreview && (
                <div style={{ height: "clamp(380px, 60vh, 550px)", width: "100%", borderRadius: "8px", overflow: "hidden", border: "1px solid #cbd5e1", background: "#f8fafc" }}>
                  <iframe
                    src={`${API_ORIGIN}/api/verify/${encodeURIComponent(certId)}/document`}
                    title="Official Verified Academic Document"
                    style={{ width: "100%", height: "100%", border: "none" }}
                  />
                </div>
              )}
            </div>

            {/* On-Chain Verification Proofs (Clean & Compact) */}
            <div style={{ marginTop: "1.5rem", padding: "1rem", background: "var(--cc-cloud)", borderRadius: "8px", border: "1px solid var(--cc-line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <strong style={{ fontSize: "0.85rem" }}>⛓️ Ethereum Sepolia Blockchain Proof</strong>
                <a
                  href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "0.8rem", color: "#2563eb", textDecoration: "underline", fontFamily: "monospace" }}
                >
                  Contract: {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)} ↗
                </a>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "0.75rem", fontSize: "0.8rem" }}>
                <div>
                  <span className="meta-label">Issuer Authority</span>
                  <span style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                    {approvedDetails.issuerWallet ? approvedDetails.issuerWallet.slice(0, 10) + "..." + approvedDetails.issuerWallet.slice(-6) : approvedDetails.institutionId}
                  </span>
                </div>
                <div>
                  <span className="meta-label">Student Recipient</span>
                  <span style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                    {approvedDetails.studentWallet ? approvedDetails.studentWallet.slice(0, 10) + "..." + approvedDetails.studentWallet.slice(-6) : "Assigned"}
                  </span>
                </div>
                <div>
                  <span className="meta-label">On-Chain Transaction</span>
                  {approvedDetails.txHash && approvedDetails.txHash.startsWith("0x") ? (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${approvedDetails.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#2563eb", textDecoration: "underline", fontFamily: "monospace" }}
                    >
                      {approvedDetails.txHash.slice(0, 10)}... ↗
                    </a>
                  ) : (
                    <span style={{ color: "#059669", fontWeight: 600 }}>✓ Confirmed on Sepolia</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Not Found State */}
      {verificationStatus === "not_found" && (
        <div className="card card-pad" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
          <span style={{ fontSize: "2rem" }}>❓</span>
          <h3 style={{ margin: "0.5rem 0" }}>Certificate Not Found</h3>
          <p className="muted small" style={{ maxWidth: 450, margin: "0 auto 1.25rem" }}>
            No certificate record was found matching <code>{certId}</code>. Please double-check the ID shared by the candidate.
          </p>
          <Button type="button" variant="secondary" onClick={() => setVerificationStatus("idle")}>
            Try Another Certificate ID
          </Button>
        </div>
      )}

      {/* 4. Error State */}
      {verificationStatus === "error" && (
        <Alert style={{ marginBottom: "1.5rem" }}>{statusMessage}</Alert>
      )}
    </div>
  );
}
