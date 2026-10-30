import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import api from "../api";
import { Button, StatCard } from "../components/UI";
import {
  getConnectedWallet,
  requestWalletSignature,
  switchToSepolia,
  SEPOLIA_CHAIN_ID_DEC
} from "../utils/web3";
function canManageCertificates() {
  try {
    const inst = JSON.parse(localStorage.getItem("certchain_institution") || "null");
    return ["admin", "issuer"].includes(inst?.role || "admin");
  } catch {
    return false;
  }
}

const CONTRACT_ADDRESS = "0x8a16Eb15A598DA4ed2E7211FEE12b37407907d90";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "verifications" ? "verifications" : "overview";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Institution State
  const [institution, setInstitution] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("certchain_institution") || "null");
    } catch {
      return null;
    }
  });

  // Wallet State
  const [walletAddress, setWalletAddress] = useState("");
  const [isSepolia, setIsSepolia] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);

  // Core Data
  const [data, setData] = useState(null);
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [approvingId, setApprovingId] = useState("");

  const canManage = canManageCertificates();
  const navigate = useNavigate();

  // Load initial data and connect wallet
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [certRes, reqRes] = await Promise.all([
          api.get("/certificates"),
          api.get("/verify/requests").catch(() => ({ data: { requests: [] } }))
        ]);
        if (!active) return;
        setData(certRes.data);
        setVerificationRequests(reqRes.data.requests || []);
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Failed to load dashboard data");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    checkWalletStatus();

    return () => {
      active = false;
    };
  }, []);

  async function checkWalletStatus() {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        setIsSepolia(parseInt(chainId, 16) === SEPOLIA_CHAIN_ID_DEC);

        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        }
      } catch (e) {
        console.warn("Wallet check error:", e.message);
      }
    }
  }

  async function handleConnectWallet() {
    setConnectingWallet(true);
    setError("");
    try {
      await switchToSepolia();
      setIsSepolia(true);
      const addr = await getConnectedWallet();
      setWalletAddress(addr);

      // Verify wallet ownership with signed challenge
      const { challenge } = (await api.get(`/auth/challenge/${addr}`)).data;
      const signature = await requestWalletSignature(challenge, addr);
      await api.post("/auth/verify-signature", { walletAddress: addr, signature });
      setActionSuccess("Institute MetaMask wallet connected and cryptographically verified on Sepolia!");
    } catch (err) {
      setError(err.message || "Failed to connect wallet.");
    } finally {
      setConnectingWallet(false);
    }
  }

  // Handle Employer Request Approvals
  async function handleApprove(request) {
    if (approvingId) return;
    setApprovingId(request.requestId);
    setActionSuccess("");
    try {
      const res = await api.post(`/verify/approve/${encodeURIComponent(request.requestId)}`);
      setVerificationRequests((current) =>
        current.map((r) =>
          r.requestId === request.requestId
            ? { ...r, status: "approved", txHash: res.data.request?.txHash }
            : r
        )
      );
      setActionSuccess(`Certificate ${request.certId} verified and authorized for ${request.employerName} on Ethereum Sepolia!`);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve verification request.");
    } finally {
      setApprovingId("");
    }
  }

  async function handleReject(request) {
    if (!window.confirm(`Reject verification request for ${request.certId}?`)) return;
    try {
      await api.post(`/verify/reject/${encodeURIComponent(request.requestId)}`);
      setVerificationRequests((current) =>
        current.map((r) => (r.requestId === request.requestId ? { ...r, status: "rejected" } : r))
      );
      setActionSuccess(`Verification request for ${request.certId} rejected.`);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject request.");
    }
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    setSearchParams(tab === "verifications" ? { tab: "verifications" } : {});
  }

  if (loading) {
    return (
      <div className="page dashboard-page">
        <div className="page-header">
          <div>
            <span className="eyebrow">Ethereum Sepolia Academic Registry</span>
            <h1>Loading Dashboard...</h1>
          </div>
        </div>
        <div className="dashboard-skeleton" aria-label="Loading dashboard">
          <div /><div /><div /><div />
        </div>
      </div>
    );
  }

  const stats = data?.stats || { total: 0, verified: 0, revoked: 0, pending: null };
  const pendingRequestsCount = verificationRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="page dashboard-page" style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Header Banner */}
      <div
        className="page-header dashboard-heading"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem"
        }}
      >
        <div>
          <span className="eyebrow">🏛️ Authorized Academic Authority</span>
          <h1 style={{ margin: "0.25rem 0" }}>{institution?.name || "Institution Workspace"}</h1>
          <p className="lead" style={{ margin: 0 }}>
            Blockchain-Anchored Credential Registry on <strong>Ethereum Sepolia Testnet</strong>.
          </p>
        </div>

        {/* Web3 Identity Box */}
        <div
          className="card"
          style={{
            padding: "0.75rem 1.25rem",
            background: "#f8fafc",
            borderColor: "#cbd5e1",
            minWidth: 280
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Authorized Wallet
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                background: isSepolia ? "#dcfce7" : "#fee2e2",
                color: isSepolia ? "#166534" : "#991b1b",
                padding: "1px 6px",
                borderRadius: 4,
                fontWeight: 600
              }}
            >
              {isSepolia ? `Sepolia (${SEPOLIA_CHAIN_ID_DEC})` : "Switch to Sepolia"}
            </span>
          </div>

          {walletAddress ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
              <a
                href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
              >
                {walletAddress.slice(0, 10)}...{walletAddress.slice(-6)} ↗
              </a>
            </div>
          ) : (
            <Button
              variant="secondary"
              onClick={handleConnectWallet}
              loading={connectingWallet}
              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", width: "100%" }}
            >
              🦊 Connect Institute Wallet
            </Button>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "0.85rem 1.25rem",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            borderRadius: "8px",
            fontWeight: 500
          }}
        >
          ✓ {actionSuccess}
        </div>
      )}

      {/* Streamlined Navigation Tabs: Overview & Requests */}
      <nav className="dashboard-nav-tabs" aria-label="Dashboard views" style={{ marginBottom: "1.5rem" }}>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => handleTabChange("overview")}
        >
          📊 Overview
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "verifications" ? "active" : ""}`}
          onClick={() => handleTabChange("verifications")}
        >
          🏢 Employer Requests{" "}
          {pendingRequestsCount > 0 && (
            <span
              style={{
                background: "#dc2626",
                color: "#fff",
                padding: "1px 7px",
                borderRadius: "10px",
                fontSize: "0.75rem",
                marginLeft: "6px"
              }}
            >
              {pendingRequestsCount}
            </span>
          )}
        </button>
      </nav>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div>
          <section className="dashboard-stats" aria-label="Certificate statistics">
            <StatCard label="Total Certificates" value={stats.total} detail="Recorded on Ethereum Sepolia" tone="blue" />
            <StatCard label="Active Credentials" value={stats.verified} detail="Cryptographically valid" tone="green" />
            <StatCard label="Revoked Credentials" value={stats.revoked} detail="Marked revoked on-chain" tone="red" />
            <StatCard
              label="Pending Verifications"
              value={pendingRequestsCount}
              detail="Awaiting employer authorization"
              tone={pendingRequestsCount > 0 ? "amber" : "blue"}
            />
          </section>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.5rem",
              marginTop: "1.5rem"
            }}
          >
            {/* Quick Actions Card */}
            <article className="card card-pad">
              <h3 style={{ margin: "0 0 0.5rem" }}>🚀 Quick Actions</h3>
              <p className="muted small" style={{ margin: "0 0 1.25rem" }}>
                Execute verified on-chain administrative tasks.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Link to="/issue" style={{ textDecoration: "none" }}>
                  <Button className="button-block">＋ Issue New Academic Certificate</Button>
                </Link>
                <Link to="/certificates" style={{ textDecoration: "none" }}>
                  <Button variant="secondary" className="button-block">📜 View Issued Credentials</Button>
                </Link>
                <button
                  type="button"
                  className="button button-secondary button-block"
                  onClick={() => handleTabChange("verifications")}
                >
                  🏢 Review Employer Requests ({pendingRequestsCount} Pending)
                </button>
              </div>
            </article>

            {/* Smart Contract Architecture Card */}
            <article className="card card-pad">
              <h3 style={{ margin: "0 0 0.5rem" }}>🌐 Smart Contract Architecture</h3>
              <p className="muted small" style={{ margin: "0 0 1rem" }}>
                Direct Sepolia Testnet integration via OpenZeppelin AccessControl.
              </p>
              <div style={{ fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>Registry Contract:</span>
                  <a
                    href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "monospace", color: "#2563eb", wordBreak: "break-all" }}
                  >
                    {CONTRACT_ADDRESS} ↗
                  </a>
                </div>
                <div>
                  <span className="muted">Network:</span> Ethereum Sepolia (Chain ID: 11155111)
                </div>
                <div>
                  <span className="muted">Security Model:</span> Role-Based Access Control (RBAC) + SHA-256 Hashes
                </div>
                <div>
                  <span className="muted">Role Verification:</span> Institute authority verified on-chain
                </div>
              </div>
            </article>
          </div>
        </div>
      )}

      {/* TAB 2: EMPLOYER VERIFICATION REQUESTS */}
      {activeTab === "verifications" && (
        <article className="card dashboard-panel">
          <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: "0 0 0.25rem" }}>🏢 Employer Verification Requests (3-Stakeholder Queue)</h2>
              <p className="muted small" style={{ margin: 0 }}>
                When an employer enters a student's certificate ID, they must receive verification & authorization from you before viewing documents.
              </p>
            </div>
            <span className="badge badge-neutral">{verificationRequests.length} total</span>
          </div>

          {verificationRequests.length === 0 ? (
            <div className="dashboard-empty" style={{ padding: "3rem 1rem", textAlign: "center" }}>
              <h3>No verification requests yet</h3>
              <p className="muted small">Requests appear here when employers query student credentials.</p>
            </div>
          ) : (
            <div className="certificate-table-wrap">
              <table className="certificate-table">
                <thead>
                  <tr>
                    <th>Certificate ID</th>
                    <th>Candidate</th>
                    <th>Employer / Recruiter</th>
                    <th>Date Requested</th>
                    <th>🛡️ Tamper Status</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {verificationRequests.map((req) => (
                    <tr key={req.requestId}>
                      <td><span style={{ fontWeight: 600 }}>{req.certId}</span></td>
                      <td>
                        <strong>{req.candidateName || "Student"}</strong>
                        <small>{req.course}</small>
                      </td>
                      <td>
                        <strong>{req.employerName}</strong>
                        <small>{req.employerEmail}</small>
                      </td>
                      <td><small>{formatDate(req.requestedAt)}</small></td>
                      <td>
                        {req.tamperStatus === "NOT_TAMPERED" ? (
                          <span
                            style={{
                              color: "#065f46",
                              background: "#ecfdf5",
                              border: "1px solid #a7f3d0",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontWeight: 600,
                              fontSize: "0.75rem"
                            }}
                          >
                            🟢 NOT TAMPERED
                          </span>
                        ) : (
                          <span
                            style={{
                              color: "#991b1b",
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontWeight: 600,
                              fontSize: "0.75rem"
                            }}
                          >
                            🔴 {req.tamperStatus || "UNVERIFIED"}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            req.status === "approved"
                              ? "badge-success"
                              : req.status === "rejected"
                              ? "badge-revoked"
                              : "badge-neutral"
                          }`}
                        >
                          {req.status === "approved" ? "✓ Authorized" : req.status === "rejected" ? "Rejected" : "⏳ Pending"}
                        </span>
                      </td>
                      <td>
                        {req.status === "pending" && canManage ? (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <Button
                              type="button"
                              onClick={() => handleApprove(req)}
                              loading={approvingId === req.requestId}
                              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                            >
                              ✓ Approve
                            </Button>
                            <button
                              type="button"
                              className="button button-secondary"
                              onClick={() => handleReject(req)}
                              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", color: "#dc2626" }}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        ) : req.status === "approved" ? (
                          <span style={{ color: "#059669", fontWeight: 600, fontSize: "0.85rem" }}>✓ Approved</span>
                        ) : (
                          <span className="muted small">Rejected</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
