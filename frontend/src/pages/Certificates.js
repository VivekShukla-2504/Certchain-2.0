import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Alert, Button } from "../components/UI";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function CertificateStatus({ revoked }) {
  return <span className={`badge ${revoked ? "badge-revoked" : "badge-success"}`}>{revoked ? "Revoked" : "Active"}</span>;
}

function canManageCertificates() {
  try {
    const institution = JSON.parse(localStorage.getItem("certchain_institution") || "null");
    return ["admin", "issuer"].includes(institution?.role || "admin");
  } catch {
    return false;
  }
}

export default function Certificates() {
  const navigate = useNavigate();
  const canManage = canManageCertificates();
  const [certificates, setCertificates] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "all", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ view: "list", page: filters.page, limit: 20, status: filters.status });
    if (filters.search) params.set("search", filters.search);
    api.get(`/certificates?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        setCertificates(response.data.certificates || []);
        setPagination(response.data.pagination || { page: 1, pages: 0, total: 0 });
      })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || "Certificates could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters]);

  function submitSearch(event) {
    event.preventDefault();
    setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 }));
  }

  function changeStatus(event) {
    setFilters((current) => ({ ...current, status: event.target.value, page: 1 }));
  }

  async function revokeCertificate(certificate) {
    if (certificate.revoked || !window.confirm(`Revoke certificate ${certificate.certId}? This is permanent and cannot be undone.`)) return;
    setRevokingId(certificate.certId);
    try {
      await api.post(`/certificates/${encodeURIComponent(certificate.certId)}/revoke`);
      setCertificates((current) => current.map((item) => item.certId === certificate.certId ? { ...item, revoked: true } : item));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Certificate could not be revoked.");
    } finally {
      setRevokingId("");
    }
  }

  return <div className="page certificates-page">
    <div className="page-header certificates-heading"><div><span className="eyebrow">Certificate registry</span><h1>Certificates</h1><p className="lead">Search and manage credentials issued by your institution.</p></div>{canManage && <a className="button button-primary" href="/issue">＋ Issue certificate</a>}</div>
    <section className="card certificate-table-card">
      <div className="certificate-toolbar"><form className="certificate-search" onSubmit={submitSearch}><span aria-hidden="true">⌕</span><input className="input" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by ID, student or course" aria-label="Search certificates" /></form><label className="status-filter"><span>Status</span><select className="select" value={filters.status} onChange={changeStatus}><option value="all">All certificates</option><option value="active">Active</option><option value="revoked">Revoked</option></select></label></div>
      {loading ? <div className="table-loading"><span className="loading-bar" /><span className="loading-bar" /><span className="loading-bar" /><span className="loading-bar" /></div> : error ? <div className="table-state"><Alert>{error}</Alert><Button variant="secondary" onClick={() => setFilters((current) => ({ ...current }))}>Try again</Button></div> : certificates.length === 0 ? <div className="table-state"><span className="empty-icon">⌕</span><h3>{filters.search || filters.status !== "all" ? "No matching certificates" : "No certificates yet"}</h3><p>{filters.search || filters.status !== "all" ? "Try a different search or status filter." : "Issued certificates will appear here."}</p></div> : <>
        <div className="certificate-table-wrap"><table className="certificate-table"><thead><tr><th>Certificate ID</th><th>Student</th><th>Document</th><th>Course / degree</th><th>Issue date</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{certificates.map((certificate) => <tr key={certificate.certId}><td data-label="Certificate ID"><span className="table-id">{certificate.certId}</span></td><td data-label="Student"><strong>{certificate.candidateName}</strong><small>{certificate.rollNumber}</small></td><td data-label="Document">{certificate.documentType || "Other"}</td><td data-label="Course / degree">{certificate.course}</td><td data-label="Issue date">{formatDate(certificate.issueDate)}</td><td data-label="Status"><CertificateStatus revoked={certificate.revoked} /></td><td data-label="Actions" className="table-actions"><button className="view-action" onClick={() => navigate(`/certificates/${encodeURIComponent(certificate.certId)}`)}>View details <span aria-hidden="true">→</span></button>{canManage && !certificate.revoked && <button className="revoke-action" disabled={revokingId === certificate.certId} onClick={() => revokeCertificate(certificate)}>{revokingId === certificate.certId ? "Revoking..." : "Revoke"}</button>}</td></tr>)}</tbody></table></div>
        {pagination.pages > 1 && <div className="pagination"><span>Showing page {pagination.page} of {pagination.pages}</span><div><Button variant="secondary" disabled={pagination.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</Button><Button variant="secondary" disabled={pagination.page >= pagination.pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</Button></div></div>}
      </>}
    </section>
  </div>;
}
