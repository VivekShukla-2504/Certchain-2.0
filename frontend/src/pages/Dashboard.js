import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Alert, Button } from "../components/UI";

function formatDate(value) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({ label, value, detail, tone = "blue" }) {
  return (
    <article className={`dashboard-stat stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong>{value === null ? "—" : value.toLocaleString()}</strong>
      <span className="stat-detail">{detail}</span>
    </article>
  );
}

function canManageCertificates() {
  try {
    const institution = JSON.parse(localStorage.getItem("certchain_institution") || "null");
    return ["admin", "issuer"].includes(institution?.role || "admin");
  } catch {
    return false;
  }
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approvingId, setApprovingId] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const canManage = canManageCertificates();

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/certificates"),
      api.get("/verify/requests").catch(() => ({ data: { requests: [] } }))
    ])
      .then(([certRes, reqRes]) => {
        if (!active) return;
        setData(certRes.data);
        setVerificationRequests(reqRes.data.requests || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Dashboard data could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleApprove(request) {
    if (approvingId) return;
    setApprovingId(request.requestId);
    setActionSuccess("");
    try {
      const res = await api.post(`/verify/approve/${encodeURIComponent(request.requestId)}`);
      setVerificationRequests((current) =>
        current.map((r) => (r.requestId === request.requestId ? { ...r, status: "approved" } : r))
      );
      setActionSuccess(`Certificate ${request.certId} verified and authorized for ${request.employerName} on-chain!`);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve verification request.");
    } finally {
      setApprovingId("");
    }
  }

  if (loading) {
    return (
      <div className="page dashboard-page">
        <div className="page-header">
          <div>
            <span className="eyebrow">Workspace overview</span>
            <h1>Dashboard</h1>
          </div>
        </div>
        <div className="dashboard-skeleton" aria-label="Loading dashboard">
          <div /><div /><div /><div />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page dashboard-page">
        <div className="page-header">
          <div>
            <span className="eyebrow">Workspace overview</span>
            <h1>Dashboard</h1>
          </div>
        </div>
        <div className="dashboard-error card card-pad">
          <Alert>{error}</Alert>
          <Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    );
  }

  const stats = data?.stats || { total: 0, verified: 0, revoked: 0, pending: null };
  const certificates = data?.certificates || [];
  const pendingRequestsCount = verificationRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="page dashboard-page">
      <div className="page-header dashboard-heading">
        <div>
          <span className="eyebrow">Workspace overview</span>
          <h1>Institution Dashboard</h1>
          <p className="lead">
            Manage academic certificates, on-chain cryptographic proofs, and verify incoming employer requests.
          </p>
        </div>
        <Link className="button button-primary" to="/issue">＋ Issue certificate</Link>
      </div>

      {actionSuccess && (
        <div style={{ marginBottom: "1.5rem", padding: "0.85rem 1.25rem", background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", borderRadius: "8px", fontWeight: 500 }}>
          ✓ {actionSuccess}
        </div>
      )}

      <section className="dashboard-stats" aria-label="Certificate statistics">
        <StatCard label="Total certificates" value={stats.total} detail="All issued records" tone="blue" />
        <StatCard label="Verified certificates" value={stats.verified} detail="Active records" tone="green" />
        <StatCard label="Revoked certificates" value={stats.revoked} detail="Marked revoked" tone="red" />
        <StatCard
          label="Employer Requests"
          value={pendingRequestsCount}
          detail={pendingRequestsCount > 0 ? "Awaiting Institute verification" : "All caught up"}
          tone={pendingRequestsCount > 0 ? "neutral" : "green"}
        />
      </section>

      {/* Employer Verification Requests (3-Stakeholder Authorization Queue) */}
      <section style={{ marginBottom: "2rem" }}>
        <article className="card dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>🏢 Employer Verification Requests</h2>
              <p className="muted small">
                When an employer enters a student's certificate ID, they must receive verification & authorization from you before viewing documents.
              </p>
            </div>
            <span className="badge badge-neutral">{verificationRequests.length} total</span>
          </div>

          {verificationRequests.length === 0 ? (
            <div className="dashboard-empty" style={{ padding: "2rem 1rem", textAlign: "center" }}>
              <span className="empty-icon">✓</span>
              <h3>No verification requests yet</h3>
              <p className="muted small">
                When an employer enters a student's Certificate ID on the verification portal, their request will appear here for your review and approval.
              </p>
            </div>
          ) : (
            <div className="certificate-table-wrap" style={{ overflowX: "auto" }}>
              <table className="certificate-table">
                <thead>
                  <tr>
                    <th>Certificate ID</th>
                    <th>Candidate</th>
                    <th>Employer / Recruiter</th>
                    <th>Employer Key</th>
                    <th>Date Requested</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {verificationRequests.map((req) => (
                    <tr key={req.requestId}>
                      <td data-label="Certificate ID">
                        <span className="table-id" style={{ fontWeight: 600 }}>{req.certId}</span>
                      </td>
                      <td data-label="Candidate">
                        <strong>{req.candidateName || "Student"}</strong>
                        <small>{req.course}</small>
                      </td>
                      <td data-label="Employer">
                        <strong>{req.employerName}</strong>
                        {req.employerEmail && <small>{req.employerEmail}</small>}
                      </td>
                      <td data-label="Employer Key">
                        <small style={{ fontFamily: "monospace" }}>
                          {req.employerWallet ? req.employerWallet.slice(0, 10) + "..." : "Default"}
                        </small>
                      </td>
                      <td data-label="Date Requested">
                        <small>{formatDate(req.requestedAt)}</small>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`badge ${req.status === "approved" ? "badge-success" : req.status === "rejected" ? "badge-revoked" : "badge-neutral"}`}
                          style={req.status === "pending" ? { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" } : {}}
                        >
                          {req.status === "approved" ? "✓ Verified on Blockchain" : req.status === "rejected" ? "Rejected" : "⏳ Pending Approval"}
                        </span>
                      </td>
                      <td data-label="Action">
                        {req.status === "pending" && canManage ? (
                          <Button
                            type="button"
                            onClick={() => handleApprove(req)}
                            loading={approvingId === req.requestId}
                            style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                          >
                            {approvingId === req.requestId ? "Signing On-Chain..." : "✓ Verify & Grant Access"}
                          </Button>
                        ) : req.status === "approved" ? (
                          <span style={{ fontSize: "0.85rem", color: "#059669", fontWeight: 600 }}>
                            Authorized
                          </span>
                        ) : (
                          <span className="muted small">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-content-grid">
        <article className="card dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent certificates</h2>
              <p className="muted small">The latest records issued by your institution.</p>
            </div>
            <span className="badge badge-neutral">{certificates.length} shown</span>
          </div>
          {certificates.length === 0 ? (
            <div className="dashboard-empty">
              <span className="empty-icon">＋</span>
              <h3>No certificates yet</h3>
              <p>Issued certificates will appear here once they are created.</p>
              <Link className="button button-secondary" to="/issue">Issue your first certificate</Link>
            </div>
          ) : (
            <div className="certificate-list">
              {certificates.map((certificate) => (
                <div className="certificate-row" key={certificate.certId}>
                  <div className="certificate-icon">{certificate.revoked ? "!" : "✓"}</div>
                  <div className="certificate-main">
                    <strong>{certificate.candidateName}</strong>
                    <span>{certificate.course} · {certificate.certId}</span>
                  </div>
                  <div className="certificate-date">
                    <span className={`badge ${certificate.revoked ? "badge-revoked" : "badge-success"}`}>
                      {certificate.revoked ? "Revoked" : "Verified"}
                    </span>
                    <small>{formatDate(certificate.createdAt || certificate.issueDate)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card dashboard-panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p className="muted small">Activity based on certificate records.</p>
            </div>
          </div>
          {certificates.length === 0 ? (
            <div className="activity-empty">No activity to show yet.</div>
          ) : (
            <div className="activity-list">
              {certificates.slice(0, 5).map((certificate) => (
                <div className="activity-item" key={`activity-${certificate.certId}`}>
                  <span className={`activity-dot ${certificate.revoked ? "revoked" : ""}`} />
                  <div>
                    <strong>{certificate.revoked ? "Certificate revoked" : "Certificate issued"}</strong>
                    <p>{certificate.certId} · {formatDate(certificate.updatedAt || certificate.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
