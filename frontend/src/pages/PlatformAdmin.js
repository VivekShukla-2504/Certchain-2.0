import React, { useState } from "react";
import api from "../api";
import { Alert, Button } from "../components/UI";

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "-";
}

export default function PlatformAdmin() {
  const [adminKey, setAdminKey] = useState("");
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadInstitutions(event) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await api.get("/platform/institutions", { headers: { "X-Platform-Admin-Key": adminKey } });
      setInstitutions(response.data.institutions || []);
      setLoaded(true);
    } catch (requestError) {
      setLoaded(false);
      setError(requestError.response?.data?.message || "Platform administration is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  async function updateInstitution(id, updates) {
    setError("");
    setNotice("");
    try {
      const response = await api.patch(`/platform/institutions/${encodeURIComponent(id)}`, updates, { headers: { "X-Platform-Admin-Key": adminKey } });
      setInstitutions((current) => current.map((item) => item._id === id ? response.data.institution : item));
      setNotice("Institution record updated.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Institution could not be updated.");
    }
  }

  return <div className="page platform-admin-page">
    <div className="page-header"><div><span className="eyebrow">Restricted operations</span><h1>Institution administration</h1><p className="lead">Review registrations and manage access for the certificate registry.</p></div><span className="badge badge-neutral">Platform control</span></div>
    <section className="card card-pad platform-key-panel">
      <div className="settings-panel-heading"><div><span className="eyebrow">Administrator access</span><h2>Platform key required</h2><p className="muted small">The key is sent only with this page's API requests and is not stored in the browser.</p></div><span className="settings-seal" aria-hidden="true">◆</span></div>
      <form className="platform-key-form" onSubmit={loadInstitutions}><label className="field"><span>Platform administrator key</span><input className="input" type="password" autoComplete="off" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} required /></label><Button type="submit" loading={loading}>{loading ? "Checking access" : "Open institution directory"}</Button></form>
      {error && <Alert>{error}</Alert>}{notice && <Alert type="success">{notice}</Alert>}
    </section>
    {loaded && <section className="card certificate-table-card platform-directory"><div className="panel-heading"><div><h2>Institution directory</h2><p className="muted small">Only platform administrators can change approval or role.</p></div><span className="badge badge-neutral">{institutions.length} records</span></div>
      {institutions.length === 0 ? <div className="table-state"><h3>No institutions registered</h3></div> : <div className="certificate-table-wrap"><table className="certificate-table"><thead><tr><th>Institution</th><th>Institution ID</th><th>Registered</th><th>Approval</th><th>Role</th></tr></thead><tbody>{institutions.map((institution) => <tr key={institution._id}><td data-label="Institution"><strong>{institution.name}</strong><small>{institution.email}</small></td><td data-label="Institution ID">{institution.institutionId}</td><td data-label="Registered">{formatDate(institution.createdAt)}</td><td data-label="Approval"><select className="select admin-select" value={institution.approvalStatus || "approved"} onChange={(event) => updateInstitution(institution._id, { approvalStatus: event.target.value })}><option value="pending">Pending</option><option value="approved">Approved</option><option value="suspended">Suspended</option></select></td><td data-label="Role"><select className="select admin-select" value={institution.role || "admin"} onChange={(event) => updateInstitution(institution._id, { role: event.target.value })}><option value="admin">Admin</option><option value="issuer">Issuer</option><option value="reviewer">Reviewer</option></select></td></tr>)}</tbody></table></div>}
    </section>}
  </div>;
}
