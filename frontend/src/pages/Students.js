import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Alert, Button } from "../components/UI";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Students() {
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", page: 1 });
  const [expandedRoll, setExpandedRoll] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: filters.page, limit: 25 });
    if (filters.search) params.set("search", filters.search);
    api.get(`/certificates/students?${params.toString()}`)
      .then((response) => {
        if (!active) return;
        setStudents(response.data.students || []);
        setPagination(response.data.pagination || { page: 1, pages: 0, total: 0 });
        setExpandedRoll("");
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Student records could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters]);

  function submitSearch(event) {
    event.preventDefault();
    setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 }));
  }

  return <div className="page students-page">
    <div className="page-header certificates-heading">
      <div><span className="eyebrow">Institution registry</span><h1>Students</h1><p className="lead">View each student and all certificates issued to them.</p></div>
      <Link className="button button-primary" to="/issue">＋ Issue certificate</Link>
    </div>
    <section className="card certificate-table-card">
      <div className="certificate-toolbar">
        <form className="certificate-search" onSubmit={submitSearch}>
          <span aria-hidden="true">⌕</span>
          <input className="input" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, roll number or course" aria-label="Search students" />
        </form>
        <span className="badge badge-neutral">{pagination.total} students</span>
      </div>
      {loading ? <div className="table-loading"><span className="loading-bar" /><span className="loading-bar" /><span className="loading-bar" /></div> : error ? <div className="table-state"><Alert>{error}</Alert><Button variant="secondary" onClick={() => setFilters((current) => ({ ...current }))}>Try again</Button></div> : students.length === 0 ? <div className="table-state"><h3>{filters.search ? "No matching students" : "No students yet"}</h3><p>{filters.search ? "Try another name, roll number or course." : "Students appear here after their first certificate is issued."}</p></div> : <>
        <div className="certificate-table-wrap">
          <table className="certificate-table">
            <thead><tr><th>Student</th><th>Roll number</th><th>Documents</th><th><span className="sr-only">Details</span></th></tr></thead>
            <tbody>{students.map((student) => <React.Fragment key={student.rollNumber}>
              <tr>
                <td data-label="Student"><strong>{student.candidateName}</strong></td>
                <td data-label="Roll number">{student.rollNumber}</td>
                <td data-label="Documents">{student.documents.length}</td>
                <td data-label="Details" className="table-actions"><button className="view-action" aria-expanded={expandedRoll === student.rollNumber} onClick={() => setExpandedRoll((current) => current === student.rollNumber ? "" : student.rollNumber)}>{expandedRoll === student.rollNumber ? "Hide documents" : "View documents"} <span aria-hidden="true">{expandedRoll === student.rollNumber ? "↑" : "→"}</span></button></td>
              </tr>
              {expandedRoll === student.rollNumber && <tr className="student-documents-row"><td colSpan="4"><div className="student-document-list">{student.documents.map((document) => <div className="student-document" key={document.certId}>
                <div><strong>{document.documentType || "Other"}</strong><span>{document.course} · Issued {formatDate(document.issueDate)}</span></div>
                <div><span className={`badge ${document.revoked ? "badge-revoked" : "badge-success"}`}>{document.revoked ? "Revoked" : "Active"}</span><Link className="view-action" to={`/certificates/${encodeURIComponent(document.certId)}`}>Open <span aria-hidden="true">→</span></Link></div>
              </div>)}</div></td></tr>}
            </React.Fragment>)}</tbody>
          </table>
        </div>
        {pagination.pages > 1 && <div className="pagination"><span>Showing page {pagination.page} of {pagination.pages}</span><div><Button variant="secondary" disabled={pagination.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</Button><Button variant="secondary" disabled={pagination.page >= pagination.pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</Button></div></div>}
      </>}
    </section>
  </div>;
}
