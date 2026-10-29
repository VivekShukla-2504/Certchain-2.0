import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Alert, Button } from "../components/UI";

function formatTimestamp(value) {
  if (!value) return "Time unavailable";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function Audit() {
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [action, setAction] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page, limit: 25 });
    if (action !== "all") params.set("action", action);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    api.get(`/audit?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        setEntries(response.data.entries || []);
        setPagination(response.data.pagination || { page: 1, pages: 0, total: 0 });
      })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || "Audit history could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [action, fromDate, page, toDate]);

  function changeAction(event) {
    setAction(event.target.value);
    setPage(1);
  }

  async function exportCsv() {
    try {
      const params = new URLSearchParams();
      if (action !== "all") params.set("action", action);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const response = await api.get(`/audit/export?${params.toString()}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "certchain-audit.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Audit export could not be downloaded.");
    }
  }

  return <div className="page audit-page">
    <div className="page-header certificates-heading">
      <div><span className="eyebrow">Governance and accountability</span><h1>Audit history</h1><p className="lead">A record of certificate issuance and revocation actions for this institution.</p></div>
      <div className="audit-heading-actions"><span className="badge badge-neutral">{pagination.total} events</span><Button variant="secondary" onClick={exportCsv}>Export CSV</Button></div>
    </div>
    <section className="card certificate-table-card">
      <div className="certificate-toolbar">
        <div><span className="eyebrow">Institution activity</span><p className="muted small">Entries are recorded when a blockchain action is confirmed.</p></div>
        <div className="audit-filters"><label className="status-filter"><span>Action</span><select className="select" value={action} onChange={changeAction}><option value="all">All actions</option><option value="issued">Issued</option><option value="revoked">Revoked</option></select></label><label className="status-filter"><span>From</span><input className="input" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} /></label><label className="status-filter"><span>To</span><input className="input" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} /></label></div>
      </div>
      {loading ? <div className="table-loading"><span className="loading-bar" /><span className="loading-bar" /><span className="loading-bar" /></div> : error ? <div className="table-state"><Alert>{error}</Alert><Button variant="secondary" onClick={() => setPage((current) => current)}>Try again</Button></div> : entries.length === 0 ? <div className="table-state"><h3>No audit events yet</h3><p>Confirmed issuance and revocation actions will appear here.</p></div> : <>
        <div className="certificate-table-wrap"><table className="certificate-table"><thead><tr><th>Action</th><th>Certificate</th><th>Document type</th><th>Recorded at</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.eventKey}><td data-label="Action"><span className={`badge ${entry.action === "revoked" ? "badge-revoked" : "badge-success"}`}>{entry.action === "revoked" ? "Revoked" : "Issued"}</span></td><td data-label="Certificate"><span className="table-id">{entry.certId}</span></td><td data-label="Document type">{entry.documentType || "Other"}</td><td data-label="Recorded at">{formatTimestamp(entry.createdAt)}</td><td data-label="Details" className="table-actions"><Link className="view-action" to={`/certificates/${encodeURIComponent(entry.certId)}`}>View record <span aria-hidden="true">→</span></Link></td></tr>)}</tbody></table></div>
        {pagination.pages > 1 && <div className="pagination"><span>Showing page {pagination.page} of {pagination.pages}</span><div><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><Button variant="secondary" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>}
      </>}
    </section>
  </div>;
}
