import React, { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

// Compute client-side SHA-256 for instant verification
async function computeSha256(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
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
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Student Registration Form State
  const [studentForm, setStudentForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    enrollmentNumber: "",
    department: "",
    course: "",
    academicSession: "2022-2026",
    walletAddress: ""
  });
  const [registeringStudent, setRegisteringStudent] = useState(false);
  const [studentFormError, setStudentFormError] = useState("");

  // Student Edit State
  const [editingStudent, setEditingStudent] = useState(null);
  const [inspectingStudent, setInspectingStudent] = useState(null);
  const [inspectingCert, setInspectingCert] = useState(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    enrollmentNumber: "",
    department: "",
    course: "",
    academicSession: "2022-2026",
    walletAddress: ""
  });
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const [editFormError, setEditFormError] = useState("");

  // Certificate Issuance State
  const [issueStep, setIssueStep] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [issueForm, setIssueForm] = useState({
    candidateName: "",
    rollNumber: "",
    course: "",
    department: "",
    academicSession: "2022-2026",
    grade: "A / 8.5 CGPA",
    issueDate: new Date().toISOString().split("T")[0],
    documentType: "Degree",
    studentWallet: "",
    studentEmail: ""
  });
  const [certificateFile, setCertificateFile] = useState(null);
  const [computedFileHash, setComputedFileHash] = useState("");
  const [generatingCertId, setGeneratingCertId] = useState("");
  const [issuingState, setIssuingState] = useState("idle"); // idle | preparing | broadcasting | confirmed | failed
  const [issuedResult, setIssuedResult] = useState(null);
  const [issuanceError, setIssuanceError] = useState("");

  // Revocation State
  const [revokingCert, setRevokingCert] = useState(null);
  const [revocationReason, setRevocationReason] = useState("Administrative error or qualification retracted");
  const [revokingStatus, setRevokingStatus] = useState("idle"); // idle | signing | confirmed | error
  const [revocationResult, setRevocationResult] = useState(null);
  const [revocationError, setRevocationError] = useState("");

  // Employer Approvals State
  const [approvingId, setApprovingId] = useState("");

  const canManage = canManageCertificates();

  // Load initial data and connect wallet
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [certRes, reqRes, stuRes] = await Promise.all([
          api.get("/certificates"),
          api.get("/verify/requests").catch(() => ({ data: { requests: [] } })),
          api.get("/students").catch(() => ({ data: { students: [] } }))
        ]);
        if (!active) return;
        setData(certRes.data);
        setVerificationRequests(reqRes.data.requests || []);
        setStudents(stuRes.data.students || []);
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
    if (hasMetaMask()) {
      const addr = await getConnectedWallet();
      if (addr) setWalletAddress(addr);
      const onSepolia = await isSepoliaNetwork();
      setIsSepolia(onSepolia);
    }
  }

  async function handleConnectWallet() {
    setConnectingWallet(true);
    try {
      await ensureSepoliaNetwork();
      const addr = await connectMetaMaskWallet();
      setWalletAddress(addr);
      setIsSepolia(true);
      setActionSuccess(`Wallet ${addr.slice(0, 8)}... connected on Ethereum Sepolia.`);
    } catch (err) {
      alert("Failed to connect MetaMask: " + err.message);
    } finally {
      setConnectingWallet(false);
    }
  }

  // --- Student Registration ---
  async function handleRegisterStudent(e) {
    e.preventDefault();
    setStudentFormError("");
    setActionSuccess("");

    if (!studentForm.fullName.trim() || !studentForm.username.trim() || !studentForm.email.trim() || !studentForm.enrollmentNumber.trim()) {
      setStudentFormError("Please fill out all required student details.");
      return;
    }
    if (!studentForm.walletAddress.trim() || !studentForm.walletAddress.startsWith("0x")) {
      setStudentFormError("Please enter a valid Ethereum wallet address (0x...) for the student.");
      return;
    }

    setRegisteringStudent(true);
    try {
      const res = await api.post("/students", studentForm);
      setStudents((curr) => [res.data.student, ...curr]);
      setActionSuccess(`Student "${res.data.student.fullName}" registered successfully! Associated with wallet ${res.data.student.walletAddress.slice(0, 10)}...`);
      setStudentForm({
        fullName: "",
        username: "",
        email: "",
        phone: "",
        enrollmentNumber: "",
        department: "",
        course: "",
        academicSession: "2022-2026",
        walletAddress: ""
      });
    } catch (err) {
      setStudentFormError(err.response?.data?.message || "Failed to register student");
    } finally {
      setRegisteringStudent(false);
    }
  }

  // --- Student Edit Operations ---
  function handleOpenEditModal(student) {
    setEditingStudent(student);
    setEditForm({
      fullName: student.fullName || "",
      username: student.username || "",
      email: student.email || "",
      phone: student.phone || "",
      enrollmentNumber: student.enrollmentNumber || "",
      department: student.department || "",
      course: student.course || "",
      academicSession: student.academicSession || "2022-2026",
      walletAddress: student.walletAddress || ""
    });
    setEditFormError("");
  }

  function handleCloseEditModal() {
    setEditingStudent(null);
    setEditFormError("");
  }

  async function handleUpdateStudent(e) {
    e.preventDefault();
    setEditFormError("");
    setActionSuccess("");

    if (!editForm.fullName.trim() || !editForm.email.trim() || !editForm.enrollmentNumber.trim()) {
      setEditFormError("Please fill out all required student details.");
      return;
    }
    if (!editForm.walletAddress.trim() || !editForm.walletAddress.startsWith("0x") || editForm.walletAddress.trim().length !== 42) {
      setEditFormError("Please enter a valid 42-character Ethereum wallet address (0x...) for the student.");
      return;
    }

    setUpdatingStudent(true);
    try {
      const studentId = editingStudent.id || editingStudent._id;
      const res = await api.put(`/students/${studentId}`, editForm);
      const updated = res.data.student;

      setStudents((prev) =>
        prev.map((s) => ((s.id || s._id) === studentId ? { ...s, ...updated } : s))
      );

      setActionSuccess(`Student "${updated.fullName}" (${updated.enrollmentNumber}) updated successfully! Associated with wallet ${updated.walletAddress.slice(0, 10)}...`);
      setEditingStudent(null);
    } catch (err) {
      setEditFormError(err.response?.data?.message || "Failed to update student details");
    } finally {
      setUpdatingStudent(false);
    }
  }

  // Select student to issue certificate
  function handleSelectStudentForIssuance(student) {
    setSelectedStudent(student);
    setIssueForm((prev) => ({
      ...prev,
      candidateName: student.fullName,
      rollNumber: student.enrollmentNumber,
      course: student.course || prev.course,
      department: student.department || prev.department,
      academicSession: student.academicSession || prev.academicSession,
      studentWallet: student.walletAddress,
      studentEmail: student.email
    }));
    setActiveTab("issue");
    setIssueStep(2);
  }

  // Handle PDF file selection
  async function handlePdfSelect(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please select a valid PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be 10MB or less.");
      return;
    }
    setCertificateFile(file);
    const hash = await computeSha256(file);
    setComputedFileHash(hash);
    const randomCertId = "CERT-" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    setGeneratingCertId(randomCertId);
  }

  // Execute Certificate Issuance
  async function handleIssueCertificate(e) {
    e.preventDefault();
    setIssuanceError("");
    setIssuedResult(null);

    if (!certificateFile) {
      setIssuanceError("Please upload the original certificate PDF document.");
      return;
    }
    if (!issueForm.candidateName.trim() || !issueForm.rollNumber.trim() || !issueForm.course.trim()) {
      setIssuanceError("Candidate Name, Enrollment Number, and Course are required.");
      return;
    }

    setIssuingState("preparing");
    try {
      const payload = new FormData();
      payload.append("candidateName", issueForm.candidateName.trim());
      payload.append("rollNumber", issueForm.rollNumber.trim());
      payload.append("course", issueForm.course.trim());
      payload.append("department", issueForm.department.trim());
      payload.append("academicSession", issueForm.academicSession.trim());
      payload.append("grade", issueForm.grade.trim());
      payload.append("issueDate", issueForm.issueDate);
      payload.append("documentType", issueForm.documentType);
      payload.append("studentWallet", issueForm.studentWallet.trim() || walletAddress);
      payload.append("studentEmail", issueForm.studentEmail.trim());
      payload.append("document", certificateFile);
      if (selectedStudent?.id) {
        payload.append("studentId", selectedStudent.id);
      }

      setIssuingState("broadcasting");
      const res = await api.post("/certificates/issue", payload);

      setIssuingState("confirmed");
      setIssuedResult(res.data.certificate);
      setActionSuccess(`Certificate ${res.data.certificate.certId} successfully issued and recorded on Ethereum Sepolia!`);

      // Refresh certificates
      const refreshed = await api.get("/certificates");
      setData(refreshed.data);
    } catch (err) {
      setIssuingState("failed");
      setIssuanceError(err.response?.data?.message || "Failed to issue certificate on blockchain.");
    }
  }

  // Revoke Credential
  async function handleRevokeSubmit(e) {
    e.preventDefault();
    if (!revokingCert) return;

    setRevocationError("");
    setRevokingStatus("signing");
    try {
      const res = await api.post(`/certificates/${encodeURIComponent(revokingCert.certId)}/revoke`, {
        reason: revocationReason
      });

      setRevokingStatus("confirmed");
      setRevocationResult(res.data);
      setActionSuccess(`Certificate ${revokingCert.certId} has been revoked on Sepolia.`);

      // Refresh list
      const refreshed = await api.get("/certificates");
      setData(refreshed.data);
    } catch (err) {
      setRevokingStatus("error");
      const errorMsg = err.response?.data?.message || err.message || "Failed to revoke certificate on Sepolia";
      setRevocationError(errorMsg);
      alert("Revocation failed: " + errorMsg);
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
        current.map((r) => (r.requestId === request.requestId ? { ...r, status: "approved", txHash: res.data.request?.txHash } : r))
      );
      setActionSuccess(`Certificate ${request.certId} verified and authorized for ${request.employerName} on-chain!`);
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
  const certificates = data?.certificates || [];
  const pendingRequestsCount = verificationRequests.filter((r) => r.status === "pending").length;

  const filteredStudents = students.filter((s) => {
    if (!studentSearch.trim()) return true;
    const term = studentSearch.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(term) ||
      s.username.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.enrollmentNumber.toLowerCase().includes(term) ||
      (s.course && s.course.toLowerCase().includes(term)) ||
      (s.department && s.department.toLowerCase().includes(term))
    );
  });

  return (
    <div className="page dashboard-page" style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Header Banner */}
      <div className="page-header dashboard-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <span className="eyebrow">Authorized Academic Authority</span>
          <h1 style={{ margin: "0.25rem 0" }}>{institution?.name || "Institution Workspace"}</h1>
          <p className="lead" style={{ margin: 0 }}>
            Blockchain-Anchored Credential Registry on <strong>Ethereum Sepolia Testnet</strong>.
          </p>
        </div>

        {/* Web3 Identity Box */}
        <div className="card" style={{ padding: "0.75rem 1.25rem", background: "var(--cc-cloud)", borderColor: "var(--cc-line)", minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Authorized Wallet
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
            <Button variant="secondary" onClick={handleConnectWallet} loading={connectingWallet} style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", width: "100%" }}>
              Connect Institution Wallet
            </Button>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div style={{ marginBottom: "1.5rem", padding: "0.85rem 1.25rem", background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", borderRadius: "8px", fontWeight: 500 }}>
          ✓ {actionSuccess}
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="dashboard-nav-tabs" aria-label="Dashboard views">
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "students" ? "active" : ""}`}
          onClick={() => setActiveTab("students")}
        >
          Student Registry ({students.length})
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "issue" ? "active" : ""}`}
          onClick={() => setActiveTab("issue")}
        >
          Issue Credential
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "credentials" ? "active" : ""}`}
          onClick={() => setActiveTab("credentials")}
        >
          Issued Credentials ({certificates.length})
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "revocation" ? "active" : ""}`}
          onClick={() => setActiveTab("revocation")}
        >
          Revocation Management
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          Sepolia Ledger
        </button>
        <button
          type="button"
          className={`dashboard-nav-tab ${activeTab === "verifications" ? "active" : ""}`}
          onClick={() => setActiveTab("verifications")}
        >
          Employer Requests {pendingRequestsCount > 0 && <span style={{ background: "#dc2626", color: "#fff", padding: "1px 6px", borderRadius: "10px", fontSize: "0.75rem" }}>{pendingRequestsCount}</span>}
        </button>
      </nav>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div>
          <section className="dashboard-stats" aria-label="Certificate statistics">
            <StatCard label="Total Certificates" value={stats.total} detail="Recorded on Ethereum Sepolia" tone="blue" />
            <StatCard label="Active Credentials" value={stats.verified} detail="Cryptographically valid" tone="green" />
            <StatCard label="Revoked Credentials" value={stats.revoked} detail="Marked revoked on-chain" tone="red" />
            <StatCard label="Registered Students" value={students.length} detail="Associated wallet identities" tone="blue" />
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem", marginTop: "1.5rem" }}>
            <article className="card card-pad">
              <h3 style={{ margin: "0 0 0.5rem" }}>Quick Actions</h3>
              <p className="muted small" style={{ margin: "0 0 1rem" }}>
                Execute verified on-chain administrative tasks.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Button onClick={() => setActiveTab("issue")}>Issue Academic Credential</Button>
                <Button variant="secondary" onClick={() => setActiveTab("students")}>Register New Student</Button>
                <Button variant="secondary" onClick={() => setActiveTab("credentials")}>Inspect Issued Credentials</Button>
              </div>
            </article>

            <article className="card card-pad">
              <h3 style={{ margin: "0 0 0.5rem" }}>Smart Contract Architecture</h3>
              <p className="muted small" style={{ margin: "0 0 1rem" }}>
                Direct Sepolia Testnet integration via OpenZeppelin AccessControl.
              </p>
              <div style={{ fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div>
                  <span className="muted">Registry Contract:</span>
                  <br />
                  <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" style={{ fontFamily: "monospace", color: "#2563eb" }}>
                    {CONTRACT_ADDRESS} ↗
                  </a>
                </div>
                <div>
                  <span className="muted">Network:</span> Ethereum Sepolia (11155111)
                </div>
                <div>
                  <span className="muted">Data Storage:</span> SHA-256 Hashes On-Chain / Encrypted Off-Chain Storage
                </div>
              </div>
            </article>
          </div>
        </div>
      )}

      {/* TAB 2: STUDENT MANAGEMENT */}
      {activeTab === "students" && (
        <div>
          {/* Student Registration Form */}
          <article className="card card-pad" style={{ marginBottom: "2rem" }}>
            <h2 style={{ margin: "0 0 0.25rem" }}>Register New Student</h2>
            <p className="muted small" style={{ margin: "0 0 1.25rem" }}>
              Register a student under your institution and associate their individual Ethereum wallet address for decentralized credential delivery.
            </p>

            {studentFormError && (
              <div style={{ marginBottom: "1rem" }}>
                <Alert>{studentFormError}</Alert>
              </div>
            )}

            <form onSubmit={handleRegisterStudent}>
              <div className="form-grid-2">
                <Field label="Full Student Name *">
                  <input
                    className="input"
                    placeholder="e.g. Aarav Sharma"
                    value={studentForm.fullName}
                    onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Username (Unique ID) *">
                  <input
                    className="input"
                    placeholder="e.g. aarav_sharma"
                    value={studentForm.username}
                    onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value.toLowerCase() })}
                    required
                  />
                </Field>

                <Field label="Email Address (Official Delivery) *">
                  <input
                    type="email"
                    className="input"
                    placeholder="student@example.edu"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Phone Number *">
                  <input
                    className="input"
                    placeholder="+91-9876543210"
                    value={studentForm.phone}
                    onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Enrollment / Roll Number *">
                  <input
                    className="input"
                    placeholder="e.g. 2022CS101"
                    value={studentForm.enrollmentNumber}
                    onChange={(e) => setStudentForm({ ...studentForm, enrollmentNumber: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Department *">
                  <input
                    className="input"
                    placeholder="e.g. Computer Science & Engineering"
                    value={studentForm.department}
                    onChange={(e) => setStudentForm({ ...studentForm, department: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Course / Qualification *">
                  <input
                    className="input"
                    placeholder="e.g. B.Tech Computer Science"
                    value={studentForm.course}
                    onChange={(e) => setStudentForm({ ...studentForm, course: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Academic Session *">
                  <input
                    className="input"
                    placeholder="e.g. 2022-2026"
                    value={studentForm.academicSession}
                    onChange={(e) => setStudentForm({ ...studentForm, academicSession: e.target.value })}
                    required
                  />
                </Field>
              </div>

              <div style={{ marginTop: "1rem" }}>
                <Field label="Student Ethereum Wallet Address (0x...) *">
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      className="input mono"
                      style={{ flex: 1, fontSize: "0.85rem" }}
                      placeholder="0xStudentSepoliaWalletAddress..."
                      value={studentForm.walletAddress}
                      onChange={(e) => setStudentForm({ ...studentForm, walletAddress: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}
                      onClick={async () => {
                        try {
                          const addr = await connectMetaMaskWallet();
                          setStudentForm((prev) => ({ ...prev, walletAddress: addr }));
                        } catch (e) {
                          alert(e.message);
                        }
                      }}
                    >
                      🦊 Read Current MetaMask
                    </button>
                  </div>
                  <span className="muted small" style={{ display: "block", marginTop: "0.25rem" }}>
                    Associate student's verified public key. Credentials issued to this student will be visible in their student portal.
                  </span>
                </Field>
              </div>

              <div style={{ marginTop: "1.25rem" }}>
                <Button type="submit" loading={registeringStudent}>
                  Register Student & Associate Wallet
                </Button>
              </div>
            </form>
          </article>

          {/* Registered Students Directory */}
          <article className="card dashboard-panel">
            <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2>Registered Students Directory</h2>
                <p className="muted small">List of all verified students registered under your institution.</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  className="input"
                  style={{ width: 260, fontSize: "0.85rem" }}
                  placeholder="Search name, roll no, email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                <span className="badge badge-neutral">{filteredStudents.length} students</span>
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="dashboard-empty" style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
                <h3>No registered students found</h3>
                <p className="muted small">Use the form above to register students and associate their Ethereum wallets.</p>
              </div>
            ) : (
              <div className="certificate-table-wrap">
                <table className="certificate-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Enrollment / Roll No</th>
                      <th>Course & Department</th>
                      <th>Wallet Address</th>
                      <th>Credentials</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => (
                      <tr key={s.id || s._id || s.enrollmentNumber}>
                        <td data-label="Student">
                          <strong>{s.fullName}</strong>
                          <small>{s.email} · @{s.username}</small>
                        </td>
                        <td data-label="Enrollment No">
                          <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{s.enrollmentNumber}</span>
                        </td>
                        <td data-label="Course">
                          <strong>{s.course}</strong>
                          <small>{s.department} ({s.academicSession})</small>
                        </td>
                        <td data-label="Wallet">
                          <a
                            href={`https://sepolia.etherscan.io/address/${s.walletAddress}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#2563eb" }}
                            title={s.walletAddress}
                          >
                            {s.walletAddress.slice(0, 8)}...{s.walletAddress.slice(-6)} ↗
                          </a>
                        </td>
                        <td data-label="Credentials">
                          <span className="badge badge-neutral">{s.certificatesCount || 0}</span>
                        </td>
                        <td data-label="Action">
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                            <Button
                              type="button"
                              variant="secondary"
                              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", borderColor: "rgba(16, 185, 129, 0.5)", color: "#059669" }}
                              onClick={() => setInspectingStudent(s)}
                              title="View full student record & credentials"
                            >
                              👁️ View
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                              onClick={() => handleSelectStudentForIssuance(s)}
                              title="Issue a credential to this student"
                            >
                              ＋ Issue
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", borderColor: "rgba(59, 130, 246, 0.5)", color: "#3b82f6" }}
                              onClick={() => handleOpenEditModal(s)}
                              title="Edit student profile & wallet address"
                            >
                              ✏️ Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>
      )}

      {/* TAB 3: ISSUE CERTIFICATE */}
      {activeTab === "issue" && (
        <article className="card card-pad" style={{ maxWidth: 840, margin: "0 auto" }}>
          <div style={{ marginBottom: "1.5rem" }}>
            <span className="eyebrow">Academic Credential Issuance Module</span>
            <h2 style={{ margin: "0.25rem 0" }}>Issue Genuine On-Chain Certificate</h2>
            <p className="muted small">
              Cryptographically binds student identity, original PDF SHA-256 hash, and issuing authority on Ethereum Sepolia.
            </p>
          </div>

          {issuanceError && (
            <div style={{ marginBottom: "1rem" }}>
              <Alert>{issuanceError}</Alert>
            </div>
          )}

          {issuedResult ? (
            <div style={{ textAlign: "center", padding: "2rem 1rem", background: "var(--cc-cloud)", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
              <span style={{ fontSize: "2.5rem" }}>🎉</span>
              <h3 style={{ margin: "0.5rem 0" }}>Certificate Successfully Confirmed on Ethereum Sepolia!</h3>
              <p className="muted small" style={{ maxWidth: 550, margin: "0 auto 1.5rem" }}>
                The SHA-256 hash was permanently anchored to smart contract <code>{CONTRACT_ADDRESS.slice(0, 10)}...</code>. An automated notification email with the Certificate ID and PDF attachment has been dispatched to <strong>{issuedResult.studentEmail || "student"}</strong>.
              </p>

              <div style={{ display: "inline-flex", flexDirection: "column", gap: "0.5rem", background: "var(--cc-paper)", padding: "1rem 1.5rem", borderRadius: 8, border: "1px solid var(--cc-line)", textAlign: "left", marginBottom: "1.5rem" }}>
                <div>
                  <span className="muted small">Certificate ID:</span>{" "}
                  <strong style={{ fontFamily: "monospace", color: "#2563eb" }}>{issuedResult.certId}</strong>
                </div>
                <div>
                  <span className="muted small">Candidate:</span> <strong>{issuedResult.candidateName}</strong> ({issuedResult.rollNumber})
                </div>
                <div>
                  <span className="muted small">Sepolia Transaction:</span>{" "}
                  <a
                    href={`https://sepolia.etherscan.io/tx/${issuedResult.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "monospace", color: "#2563eb", textDecoration: "underline" }}
                  >
                    {issuedResult.txHash?.slice(0, 14)}... ↗
                  </a>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                <Button onClick={() => { setIssuedResult(null); setCertificateFile(null); setComputedFileHash(""); }}>
                  Issue Another Certificate
                </Button>
                <Button variant="secondary" onClick={() => setActiveTab("credentials")}>
                  View All Issued Credentials
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleIssueCertificate}>
              <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  style={{ fontSize: "0.85rem", background: "#fdf4ff", border: "1px solid #f0abfc", color: "#a21caf", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                  onClick={() => {
                    setIssueForm({
                      candidateName: "Vivek Shukla",
                      rollNumber: "2026-CSE-001",
                      course: "Bachelor of Technology (Computer Science)",
                      department: "Computer Science & Engineering",
                      academicSession: "2022-2026",
                      grade: "9.8 CGPA (First Class with Distinction)",
                      issueDate: new Date().toISOString().split("T")[0],
                      documentType: "Degree",
                      studentWallet: "0x8A8edFB602AA8D7479160bC42815B6271d4B70B3",
                      studentEmail: "student@certchain.edu"
                    });
                  }}
                >
                  ✨ Quick Autofill Presentation Demo Candidate
                </button>
              </div>
              {/* Step 1: Student Selection */}
              <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--cc-cloud)", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h4 style={{ margin: 0 }}>Step 1: Select Registered Student</h4>
                  {selectedStudent && (
                    <button
                      type="button"
                      style={{ fontSize: "0.8rem", color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}
                      onClick={() => setSelectedStudent(null)}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                {selectedStudent ? (
                  <div style={{ background: "rgba(37, 99, 235, 0.08)", padding: "0.75rem", borderRadius: 6, border: "1px solid rgba(37, 99, 235, 0.2)" }}>
                    <div style={{ fontWeight: 600, color: "#1e40af" }}>✓ Selected: {selectedStudent.fullName} ({selectedStudent.enrollmentNumber})</div>
                    <div style={{ fontSize: "0.85rem", color: "#3b82f6" }}>
                      Course: {selectedStudent.course} · Wallet: {selectedStudent.walletAddress.slice(0, 12)}... · Email: {selectedStudent.email}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="muted small" style={{ display: "block", marginBottom: "0.35rem" }}>
                      Choose from registered students or enter details manually:
                    </label>
                    <select
                      className="select"
                      style={{ width: "100%", marginBottom: "0.75rem" }}
                      onChange={(e) => {
                        const s = students.find((item) => (item.id || item._id) === e.target.value);
                        if (s) handleSelectStudentForIssuance(s);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>-- Select a registered student --</option>
                      {students.map((s) => (
                        <option key={s.id || s._id} value={s.id || s._id}>
                          {s.fullName} - {s.enrollmentNumber} ({s.course})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Step 2: Certificate Metadata */}
              <div className="form-grid-2" style={{ marginBottom: "1.5rem" }}>
                <Field label="Candidate Full Name *">
                  <input
                    className="input"
                    value={issueForm.candidateName}
                    onChange={(e) => setIssueForm({ ...issueForm, candidateName: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Roll / Enrollment Number *">
                  <input
                    className="input"
                    value={issueForm.rollNumber}
                    onChange={(e) => setIssueForm({ ...issueForm, rollNumber: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Course / Qualification *">
                  <input
                    className="input"
                    value={issueForm.course}
                    onChange={(e) => setIssueForm({ ...issueForm, course: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Grade / CGPA *">
                  <input
                    className="input"
                    value={issueForm.grade}
                    onChange={(e) => setIssueForm({ ...issueForm, grade: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Issue Date *">
                  <input
                    type="date"
                    className="input"
                    value={issueForm.issueDate}
                    onChange={(e) => setIssueForm({ ...issueForm, issueDate: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Document Type *">
                  <select
                    className="select"
                    value={issueForm.documentType}
                    onChange={(e) => setIssueForm({ ...issueForm, documentType: e.target.value })}
                  >
                    <option value="Degree">Degree</option>
                    <option value="Marksheet">Marksheet</option>
                    <option value="Transcript">Transcript</option>
                    <option value="Diploma">Diploma</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>

                <Field label="Student Wallet Address (Recipient Public Key) *">
                  <input
                    className="input mono"
                    placeholder="0x..."
                    value={issueForm.studentWallet}
                    onChange={(e) => setIssueForm({ ...issueForm, studentWallet: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Student Email (Auto-dispatch notification)">
                  <input
                    type="email"
                    className="input"
                    placeholder="student@example.edu"
                    value={issueForm.studentEmail}
                    onChange={(e) => setIssueForm({ ...issueForm, studentEmail: e.target.value })}
                  />
                </Field>
              </div>

              {/* Step 3: PDF Upload & Cryptographic Hashing */}
              <div style={{ marginBottom: "1.5rem", padding: "1.25rem", background: "var(--cc-cloud)", borderRadius: 8, border: "2px dashed var(--cc-line-strong)", textAlign: "center" }}>
                <h4 style={{ margin: "0 0 0.5rem" }}>Step 2 & 3: Upload Certificate PDF & Generate SHA-256 Hash</h4>
                <p className="muted small" style={{ margin: "0 0 1rem" }}>
                  Select the official certificate PDF. The system computes its cryptographic SHA-256 fingerprint.
                </p>

                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handlePdfSelect(e.target.files[0])}
                  style={{ marginBottom: "0.75rem" }}
                />

                {computedFileHash && (
                  <div style={{ marginTop: "1rem", textAlign: "left", background: "#fff", padding: "0.85rem", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
                        ✓ Cryptographic SHA-256 Hash (Exact File Integrity)
                      </span>
                      <span className="crypto-badge">256-bit Hex</span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "0.85rem", wordBreak: "break-all", color: "#0f172a" }}>
                      {computedFileHash}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 4: Blockchain Transaction Execution */}
              <div style={{ marginTop: "1.5rem" }}>
                <Button
                  type="submit"
                  disabled={issuingState === "broadcasting" || issuingState === "preparing" || !computedFileHash}
                  loading={issuingState === "broadcasting" || issuingState === "preparing"}
                  style={{ width: "100%", padding: "0.75rem" }}
                >
                  {issuingState === "broadcasting"
                    ? "Submitting & Anchoring to Sepolia Testnet..."
                    : issuingState === "preparing"
                    ? "Validating Document Integrity..."
                    : "🔒 Sign & Issue Certificate on Ethereum Sepolia"}
                </Button>
                <span className="muted small" style={{ display: "block", textAlign: "center", marginTop: "0.5rem" }}>
                  Permanently commits SHA-256 hash to Sepolia smart contract. Automatically notifies the student via email upon block confirmation.
                </span>
              </div>
            </form>
          )}
        </article>
      )}

      {/* TAB 4: ISSUED CREDENTIALS */}
      {activeTab === "credentials" && (
        <article className="card dashboard-panel">
          <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2>Issued Academic Credentials</h2>
              <p className="muted small">All certificates anchored to the blockchain by your institution.</p>
            </div>
            <span className="badge badge-neutral">{certificates.length} credentials</span>
          </div>

          {certificates.length === 0 ? (
            <div className="dashboard-empty" style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
              <h3>No certificates issued yet</h3>
              <p className="muted small">Click "Issue Certificate" to anchor your institution's first academic credential.</p>
            </div>
          ) : (
            <div className="certificate-table-wrap">
              <table className="certificate-table">
                <thead>
                  <tr>
                    <th>Certificate ID</th>
                    <th>Candidate</th>
                    <th>Course & Qualification</th>
                    <th>Status</th>
                    <th>Sepolia Transaction</th>
                    <th>Date Issued</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((cert) => (
                    <tr key={cert.certId}>
                      <td data-label="Certificate ID">
                        <button
                          type="button"
                          onClick={() => setInspectingCert(cert)}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            fontFamily: "monospace",
                            fontWeight: 700,
                            color: "#2563eb",
                            cursor: "pointer",
                            textDecoration: "underline"
                          }}
                          title="Click to view full student profile and credential verification record"
                        >
                          {cert.certId}
                        </button>
                      </td>
                      <td data-label="Candidate">
                        <button
                          type="button"
                          onClick={() => setInspectingCert(cert)}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            textAlign: "left",
                            cursor: "pointer",
                            display: "block"
                          }}
                          title="Click to inspect student and credential details"
                        >
                          <strong style={{ color: "#0f172a", textDecoration: "underline", display: "block" }}>
                            {cert.candidateName}
                          </strong>
                          <small style={{ color: "var(--cc-muted)" }}>{cert.rollNumber}</small>
                        </button>
                      </td>
                      <td data-label="Course">
                        <strong>{cert.course}</strong>
                        <small>{cert.documentType || "Degree"} · Grade: {cert.grade}</small>
                      </td>
                      <td data-label="Status">
                        <span
                          className={`badge ${cert.revoked ? "badge-revoked" : "badge-success"}`}
                          style={{ fontWeight: 700 }}
                        >
                          {cert.revoked ? <span className="status-pill status-pill-danger"><span className="status-dot danger" /> Revoked</span> : <span className="status-pill status-pill-success"><span className="status-dot success" /> Active On-Chain</span>}
                        </span>
                      </td>
                      <td data-label="Sepolia Tx">
                        {cert.txHash && cert.txHash.startsWith("0x") ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${cert.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#2563eb" }}
                          >
                            {cert.txHash.slice(0, 10)}... ↗
                          </a>
                        ) : (
                          <span className="muted small">Confirmed</span>
                        )}
                      </td>
                      <td data-label="Date">
                        <small>{formatDate(cert.issueDate || cert.createdAt)}</small>
                      </td>
                      <td data-label="Action">
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.3rem 0.5rem", color: "#2563eb", borderColor: "#93c5fd" }}
                            onClick={() => setInspectingCert(cert)}
                            title="View student profile and credential verification record"
                          >
                            👁️ View Details
                          </button>
                          <a
                            href={`${API_ORIGIN}/api/certificates/${cert.certId}/download-student`}
                            target="_blank"
                            rel="noreferrer"
                            className="button button-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.3rem 0.5rem" }}
                          >
                            📥 PDF
                          </a>
                          {!cert.revoked && (
                            <button
                              type="button"
                              className="button button-secondary"
                              style={{ fontSize: "0.75rem", padding: "0.3rem 0.5rem", color: "#dc2626" }}
                              onClick={() => {
                                setRevokingCert(cert);
                                setActiveTab("revocation");
                              }}
                            >
                              ⚠️ Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      )}

      {/* TAB 5: REVOCATION MANAGEMENT */}
      {activeTab === "revocation" && (
        <article className="card card-pad" style={{ maxWidth: 780, margin: "0 auto" }}>
          <div style={{ marginBottom: "1.5rem" }}>
            <span className="eyebrow">Credential Lifecycle & Compliance</span>
            <h2 style={{ margin: "0.25rem 0" }}>Certificate Revocation Management</h2>
            <p className="muted small">
              Revoking a credential marks it as permanently invalid on Ethereum Sepolia. The on-chain historical record is preserved for immutable auditability.
            </p>
          </div>

          {revocationResult ? (
            <div style={{ padding: "1.5rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, textAlign: "center" }}>
              <span style={{ fontSize: "2.5rem" }}>⚠️</span>
              <h3 style={{ color: "#991b1b", margin: "0.5rem 0" }}>Certificate Revoked on Sepolia</h3>
              <p style={{ fontSize: "0.9rem", color: "#7f1d1d", maxWidth: 500, margin: "0 auto 1.25rem" }}>
                Credential <strong>{revocationResult.certId}</strong> has been revoked. Verification requests will now report <code>REVOKED</code>.
              </p>
              {revocationResult.revocationTxHash && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${revocationResult.revocationTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "monospace", color: "#b91c1c", textDecoration: "underline" }}
                  >
                    View Revocation Tx on Etherscan ↗
                  </a>
                </div>
              )}
              <Button onClick={() => { setRevocationResult(null); setRevokingCert(null); }}>
                Back to Revocation Management
              </Button>
            </div>
          ) : (
            <div>
              {revocationError && (
                <div style={{ marginBottom: "1rem" }}>
                  <Alert>{revocationError}</Alert>
                </div>
              )}

              {/* Select Certificate to Revoke */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Select Active Certificate to Revoke:
                </label>
                <select
                  className="select"
                  style={{ width: "100%" }}
                  value={revokingCert?.certId || ""}
                  onChange={(e) => {
                    const found = certificates.find((c) => c.certId === e.target.value);
                    setRevokingCert(found || null);
                  }}
                >
                  <option value="">-- Choose a certificate --</option>
                  {certificates
                    .filter((c) => !c.revoked)
                    .map((c) => (
                      <option key={c.certId} value={c.certId}>
                        {c.certId} - {c.candidateName} ({c.course})
                      </option>
                    ))}
                </select>
              </div>

              {revokingCert && (
                <div style={{ background: "var(--cc-cloud)", padding: "1rem", borderRadius: 8, border: "1px solid var(--cc-line)", marginBottom: "1.25rem" }}>
                  <h4 style={{ margin: "0 0 0.5rem", color: "var(--cc-ink)" }}>Target Certificate Details</h4>
                  <div style={{ fontSize: "0.85rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div><span className="muted">Candidate:</span> <strong>{revokingCert.candidateName}</strong></div>
                    <div><span className="muted">Roll Number:</span> <code>{revokingCert.rollNumber}</code></div>
                    <div><span className="muted">Course:</span> {revokingCert.course}</div>
                    <div><span className="muted">Student Wallet:</span> <code>{revokingCert.studentWallet?.slice(0, 10)}...</code></div>
                    <div><span className="muted">Issued At:</span> {formatDate(revokingCert.issueDate)}</div>
                    <div><span className="muted">Issuance Tx:</span> <code>{revokingCert.txHash?.slice(0, 10)}...</code></div>
                  </div>
                </div>
              )}

              <form onSubmit={handleRevokeSubmit}>
                <Field label="Official Revocation Reason *">
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="e.g. Qualification retracted / Administrative error in candidate name / Disciplinary review"
                    value={revocationReason}
                    onChange={(e) => setRevocationReason(e.target.value)}
                    required
                  />
                </Field>

                <div style={{ marginTop: "1.25rem" }}>
                  <Button
                    type="submit"
                    disabled={!revokingCert || revokingStatus === "signing"}
                    loading={revokingStatus === "signing"}
                    style={{ background: "#dc2626", borderColor: "#b91c1c" }}
                  >
                    ⚠️ Confirm On-Chain Revocation on Sepolia
                  </Button>
                </div>
              </form>
            </div>
          )}
        </article>
      )}

      {/* TAB 6: BLOCKCHAIN LEDGER */}
      {activeTab === "transactions" && (
        <article className="card dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Ethereum Sepolia Blockchain Transactions</h2>
              <p className="muted small">Immutable ledger of all credential issuance and revocation transactions.</p>
            </div>
          </div>

          <div className="certificate-table-wrap">
            <table className="certificate-table">
              <thead>
                <tr>
                  <th>Event Type</th>
                  <th>Certificate ID</th>
                  <th>Student Address</th>
                  <th>Sepolia Tx Hash</th>
                  <th>Network Explorer</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((c) => (
                  <tr key={`tx-${c.certId}`}>
                    <td data-label="Event">
                      <span className={`badge ${c.revoked ? "badge-revoked" : "badge-success"}`}>
                        {c.revoked ? "CredentialRevoked" : "CredentialIssued"}
                      </span>
                    </td>
                    <td data-label="Cert ID">
                      <code>{c.certId}</code>
                    </td>
                    <td data-label="Student">
                      <small style={{ fontFamily: "monospace" }}>
                        {c.studentWallet ? c.studentWallet.slice(0, 12) + "..." : "Self-Sovereign"}
                      </small>
                    </td>
                    <td data-label="Tx Hash">
                      <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {c.txHash ? c.txHash.slice(0, 14) + "..." : "Confirmed"}
                      </span>
                    </td>
                    <td data-label="Explorer">
                      {c.txHash && c.txHash.startsWith("0x") ? (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${c.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.85rem" }}
                        >
                          View on Etherscan ↗
                        </a>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* TAB 7: EMPLOYER VERIFICATION REQUESTS */}
      {activeTab === "verifications" && (
        <article className="card dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>🏢 Employer Verification Requests (3-Stakeholder Queue)</h2>
              <p className="muted small">
                When an employer enters a student's certificate ID, they must receive verification & authorization from you before viewing documents.
              </p>
            </div>
            <span className="badge badge-neutral">{verificationRequests.length} total</span>
          </div>

          {verificationRequests.length === 0 ? (
            <div className="dashboard-empty" style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
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
                    <th>Tamper Verification</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {verificationRequests.map((req) => (
                    <tr key={req.requestId}>
                      <td><span style={{ fontWeight: 600 }}>{req.certId}</span></td>
                      <td><strong>{req.candidateName || "Student"}</strong><small>{req.course}</small></td>
                      <td><strong>{req.employerName}</strong><small>{req.employerEmail}</small></td>
                      <td><small>{formatDate(req.requestedAt)}</small></td>
                      <td>
                        {req.tamperStatus === "NOT_TAMPERED" ? (
                          <span style={{ color: "#065f46", background: "#ecfdf5", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: "0.75rem" }}>
                            🟢 NOT TAMPERED
                          </span>
                        ) : (
                          <span style={{ color: "#991b1b", background: "#fef2f2", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: "0.75rem" }}>
                            🔴 {req.tamperStatus}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${req.status === "approved" ? "badge-success" : req.status === "rejected" ? "badge-revoked" : "badge-neutral"}`}>
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

      {/* EDIT STUDENT MODAL */}
      {editingStudent && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={(e) => { if (e.target === e.currentTarget) handleCloseEditModal(); }}>
          <div
            className="card card-pad"
            style={{
              maxWidth: 640,
              width: "95%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              border: "1px solid rgba(59, 130, 246, 0.4)",
              background: "var(--cc-bg, #0b0f19)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid var(--cc-line)", paddingBottom: "0.75rem" }}>
              <div>
                <span className="eyebrow" style={{ color: "#3b82f6" }}>Student Profile Management</span>
                <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.25rem" }}>Edit Student Record</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                style={{ background: "transparent", border: "none", color: "var(--cc-muted)", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <p className="muted small" style={{ margin: "0 0 1.25rem" }}>
              Update profile details or correct the assigned Ethereum wallet address. Future certificates issued will automatically bind to the updated wallet.
            </p>

            {editFormError && (
              <div style={{ marginBottom: "1rem" }}>
                <Alert>{editFormError}</Alert>
              </div>
            )}

            <form onSubmit={handleUpdateStudent}>
              <div className="form-grid-2">
                <Field label="Full Student Name *">
                  <input
                    className="input"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Username (Unique ID) *">
                  <input
                    className="input"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value.toLowerCase() })}
                    required
                  />
                </Field>

                <Field label="Email Address *">
                  <input
                    type="email"
                    className="input"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Phone Number *">
                  <input
                    className="input"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Enrollment / Roll Number *">
                  <input
                    className="input"
                    value={editForm.enrollmentNumber}
                    onChange={(e) => setEditForm({ ...editForm, enrollmentNumber: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Department *">
                  <input
                    className="input"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Course / Qualification *">
                  <input
                    className="input"
                    value={editForm.course}
                    onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                    required
                  />
                </Field>

                <Field label="Academic Session *">
                  <input
                    className="input"
                    value={editForm.academicSession}
                    onChange={(e) => setEditForm({ ...editForm, academicSession: e.target.value })}
                    required
                  />
                </Field>
              </div>

              <div style={{ marginTop: "1rem" }}>
                <Field label="Student Ethereum Wallet Address (0x...) *">
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      className="input mono"
                      style={{ flex: 1, fontSize: "0.85rem" }}
                      placeholder="0xStudentSepoliaWalletAddress..."
                      value={editForm.walletAddress}
                      onChange={(e) => setEditForm({ ...editForm, walletAddress: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}
                      onClick={async () => {
                        try {
                          const addr = await connectMetaMaskWallet();
                          setEditForm((prev) => ({ ...prev, walletAddress: addr }));
                        } catch (e) {
                          alert(e.message);
                        }
                      }}
                    >
                      🦊 Read MetaMask
                    </button>
                  </div>
                  <span className="muted small" style={{ display: "block", marginTop: "0.35rem" }}>
                    Associate student's verified public key. Credentials issued to this student will be visible in their student portal.
                  </span>
                </Field>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem", borderTop: "1px solid var(--cc-line)", paddingTop: "1rem" }}>
                <Button type="button" variant="secondary" onClick={handleCloseEditModal}>
                  Cancel
                </Button>
                <Button type="submit" loading={updatingStudent}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW ISSUED CREDENTIAL & STUDENT DETAILS MODAL */}
      {inspectingCert && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={(e) => { if (e.target === e.currentTarget) setInspectingCert(null); }}>
          <div
            className="card card-pad"
            style={{
              maxWidth: 720,
              width: "95%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              border: "1px solid rgba(59, 130, 246, 0.4)",
              background: "var(--cc-bg, #0b0f19)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid var(--cc-line)", paddingBottom: "0.75rem" }}>
              <div>
                <span className="eyebrow" style={{ color: "#3b82f6" }}>Issued Credential Record</span>
                <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.25rem" }}>Student & Credential Details</h2>
              </div>
              <button
                type="button"
                onClick={() => setInspectingCert(null)}
                style={{ background: "transparent", border: "none", color: "var(--cc-muted)", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Status Banner */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", padding: "0.75rem 1rem", background: inspectingCert.revoked ? "#fef2f2" : "#f0fdf4", border: `1px solid ${inspectingCert.revoked ? "#fecaca" : "#bbf7d0"}`, borderRadius: 8 }}>
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: inspectingCert.revoked ? "#991b1b" : "#166534" }}>
                  Blockchain Status
                </span>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: inspectingCert.revoked ? "#dc2626" : "#16a34a" }}>
                  {inspectingCert.revoked ? "⚠️ REVOKED ON SEPOLIA" : "✓ 100% VALID & ACTIVE ON SEPOLIA"}
                </div>
              </div>
              <span className="crypto-badge">Cryptographically Anchored</span>
            </div>

            {/* Candidate & Student Info */}
            <div style={{ marginBottom: "1.25rem", background: "var(--cc-cloud)", padding: "1.25rem", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
              <h3 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", color: "var(--cc-ink)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                🎓 Student Candidate Profile
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div>
                  <span className="meta-label">Full Name</span>
                  <strong style={{ fontSize: "1.05rem", color: "#0f172a" }}>{inspectingCert.candidateName}</strong>
                </div>
                <div>
                  <span className="meta-label">Enrollment / Roll No</span>
                  <strong style={{ fontSize: "1.05rem", fontFamily: "monospace" }}>{inspectingCert.rollNumber}</strong>
                </div>
                <div>
                  <span className="meta-label">Student Email</span>
                  <span>{inspectingCert.studentEmail || "Not provided"}</span>
                </div>
                <div>
                  <span className="meta-label">Student Wallet Address</span>
                  {inspectingCert.studentWallet ? (
                    <a
                      href={`https://sepolia.etherscan.io/address/${inspectingCert.studentWallet}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#2563eb" }}
                    >
                      {inspectingCert.studentWallet.slice(0, 10)}...{inspectingCert.studentWallet.slice(-6)} ↗
                    </a>
                  ) : (
                    <span className="muted">Not assigned</span>
                  )}
                </div>
              </div>
            </div>

            {/* Academic Record */}
            <div style={{ marginBottom: "1.25rem", background: "var(--cc-cloud)", padding: "1.25rem", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
              <h3 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", color: "var(--cc-ink)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                📚 Academic Credential Specification
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div>
                  <span className="meta-label">Course / Degree</span>
                  <strong style={{ color: "#2563eb" }}>{inspectingCert.course}</strong>
                </div>
                <div>
                  <span className="meta-label">Department</span>
                  <strong>{inspectingCert.department || "Academic Department"}</strong>
                </div>
                <div>
                  <span className="meta-label">Academic Session</span>
                  <strong>{inspectingCert.academicSession || "N/A"}</strong>
                </div>
                <div>
                  <span className="meta-label">Grade / Classification</span>
                  <strong style={{ color: "#059669" }}>{inspectingCert.grade}</strong>
                </div>
                <div>
                  <span className="meta-label">Document Type</span>
                  <strong>{inspectingCert.documentType || "Degree"}</strong>
                </div>
                <div>
                  <span className="meta-label">Issuance Date</span>
                  <strong>{formatDate(inspectingCert.issueDate || inspectingCert.createdAt)}</strong>
                </div>
              </div>
            </div>

            {/* Cryptographic Proofs */}
            <div style={{ marginBottom: "1.5rem", background: "var(--cc-cloud)", padding: "1.25rem", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
              <h3 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", color: "var(--cc-ink)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                🛡️ On-Chain Blockchain & Cryptographic Record
              </h3>
              <div style={{ display: "grid", gap: "0.75rem", fontSize: "0.85rem" }}>
                <div>
                  <span className="meta-label">Certificate Unique Identifier</span>
                  <strong style={{ fontFamily: "monospace", color: "#2563eb" }}>{inspectingCert.certId}</strong>
                </div>
                <div>
                  <span className="meta-label">Document SHA-256 Hash</span>
                  <code style={{ fontSize: "0.8rem", wordBreak: "break-all" }}>
                    {inspectingCert.documentHash || inspectingCert.certHash || "0xConfirmed"}
                  </code>
                </div>
                <div>
                  <span className="meta-label">Ethereum Sepolia Transaction Hash</span>
                  {inspectingCert.txHash && inspectingCert.txHash.startsWith("0x") ? (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${inspectingCert.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontFamily: "monospace", color: "#2563eb", textDecoration: "underline" }}
                    >
                      {inspectingCert.txHash} ↗
                    </a>
                  ) : (
                    <span className="muted">Confirmed on Sepolia</span>
                  )}
                </div>
                {inspectingCert.revoked && (
                  <div style={{ padding: "0.75rem", background: "#fef2f2", borderRadius: 6, border: "1px solid #fecaca" }}>
                    <span style={{ color: "#991b1b", fontWeight: 700 }}>Revocation Details:</span>
                    <div style={{ color: "#7f1d1d" }}>Reason: {inspectingCert.revocationReason || "Revoked by Institution Authority"}</div>
                    {inspectingCert.revokedAt && (
                      <div style={{ color: "#7f1d1d", fontSize: "0.8rem" }}>Revoked on: {new Date(inspectingCert.revokedAt).toLocaleString()}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", borderTop: "1px solid var(--cc-line)", paddingTop: "1rem" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <a
                  href={`${API_ORIGIN}/api/certificates/${inspectingCert.certId}/download-student`}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-primary"
                  style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}
                >
                  📥 Download Official PDF
                </a>
                {inspectingCert.txHash && inspectingCert.txHash.startsWith("0x") && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${inspectingCert.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-secondary"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}
                  >
                    Etherscan ↗
                  </a>
                )}
              </div>
              <Button type="button" variant="secondary" onClick={() => setInspectingCert(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW REGISTERED STUDENT PROFILE & ALL CREDENTIALS MODAL */}
      {inspectingStudent && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={(e) => { if (e.target === e.currentTarget) setInspectingStudent(null); }}>
          <div
            className="card card-pad"
            style={{
              maxWidth: 720,
              width: "95%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              background: "var(--cc-bg, #0b0f19)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid var(--cc-line)", paddingBottom: "0.75rem" }}>
              <div>
                <span className="eyebrow" style={{ color: "#10b981" }}>Student Identity & Credentials</span>
                <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.25rem" }}>{inspectingStudent.fullName}</h2>
              </div>
              <button
                type="button"
                onClick={() => setInspectingStudent(null)}
                style={{ background: "transparent", border: "none", color: "var(--cc-muted)", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Profile Grid */}
            <div style={{ marginBottom: "1.25rem", background: "var(--cc-cloud)", padding: "1.25rem", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
              <h3 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", color: "var(--cc-ink)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                👤 Student Information
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div>
                  <span className="meta-label">Full Name</span>
                  <strong style={{ fontSize: "1.05rem", color: "#0f172a" }}>{inspectingStudent.fullName}</strong>
                </div>
                <div>
                  <span className="meta-label">Enrollment Number</span>
                  <strong style={{ fontSize: "1.05rem", fontFamily: "monospace" }}>{inspectingStudent.enrollmentNumber}</strong>
                </div>
                <div>
                  <span className="meta-label">Username</span>
                  <span style={{ fontFamily: "monospace", color: "#64748b" }}>@{inspectingStudent.username}</span>
                </div>
                <div>
                  <span className="meta-label">Email</span>
                  <span>{inspectingStudent.email}</span>
                </div>
                <div>
                  <span className="meta-label">Course & Program</span>
                  <strong>{inspectingStudent.course}</strong>
                </div>
                <div>
                  <span className="meta-label">Department & Session</span>
                  <span>{inspectingStudent.department} ({inspectingStudent.academicSession})</span>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span className="meta-label">Associated Sepolia Wallet</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
                    <code style={{ fontSize: "0.85rem", color: "#2563eb" }}>{inspectingStudent.walletAddress}</code>
                    <a
                      href={`https://sepolia.etherscan.io/address/${inspectingStudent.walletAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "0.8rem", color: "#2563eb", textDecoration: "none" }}
                    >
                      ↗ Etherscan
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Credentials Issued to this Student */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--cc-ink)" }}>
                  📜 Issued Credentials for this Student
                </h3>
                <span className="badge badge-neutral">
                  {certificates.filter((c) =>
                    c.rollNumber?.toLowerCase() === inspectingStudent.enrollmentNumber?.toLowerCase() ||
                    (c.studentWallet && c.studentWallet.toLowerCase() === inspectingStudent.walletAddress?.toLowerCase()) ||
                    (c.studentEmail && c.studentEmail.toLowerCase() === inspectingStudent.email?.toLowerCase())
                  ).length} records
                </span>
              </div>

              {(() => {
                const studentCerts = certificates.filter((c) =>
                  c.rollNumber?.toLowerCase() === inspectingStudent.enrollmentNumber?.toLowerCase() ||
                  (c.studentWallet && c.studentWallet.toLowerCase() === inspectingStudent.walletAddress?.toLowerCase()) ||
                  (c.studentEmail && c.studentEmail.toLowerCase() === inspectingStudent.email?.toLowerCase())
                );

                if (studentCerts.length === 0) {
                  return (
                    <div style={{ padding: "1.5rem", background: "var(--cc-cloud)", borderRadius: 8, textAlign: "center", border: "1px dashed var(--cc-line)" }}>
                      <p className="muted small" style={{ margin: "0 0 1rem" }}>No academic credentials issued to this student yet.</p>
                      <Button
                        type="button"
                        onClick={() => {
                          const s = inspectingStudent;
                          setInspectingStudent(null);
                          handleSelectStudentForIssuance(s);
                        }}
                      >
                        ＋ Issue Credential Now
                      </Button>
                    </div>
                  );
                }

                return (
                  <div className="certificate-table-wrap">
                    <table className="certificate-table" style={{ fontSize: "0.85rem" }}>
                      <thead>
                        <tr>
                          <th>Certificate ID</th>
                          <th>Course</th>
                          <th>Status</th>
                          <th>Issued Date</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentCerts.map((cert) => (
                          <tr key={cert.certId}>
                            <td>
                              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563eb" }}>{cert.certId}</span>
                            </td>
                            <td>
                              <strong>{cert.course}</strong>
                              <small>{cert.grade}</small>
                            </td>
                            <td>
                              <span className={`badge ${cert.revoked ? "badge-revoked" : "badge-success"}`}>
                                {cert.revoked ? "Revoked" : "Active"}
                              </span>
                            </td>
                            <td>{formatDate(cert.issueDate || cert.createdAt)}</td>
                            <td>
                              <div style={{ display: "flex", gap: "0.3rem" }}>
                                <button
                                  type="button"
                                  className="button button-secondary"
                                  style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                                  onClick={() => {
                                    setInspectingStudent(null);
                                    setInspectingCert(cert);
                                  }}
                                >
                                  👁️ Details
                                </button>
                                <a
                                  href={`${API_ORIGIN}/api/certificates/${cert.certId}/download-student`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="button button-secondary"
                                  style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                                >
                                  📥 PDF
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", borderTop: "1px solid var(--cc-line)", paddingTop: "1rem" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const s = inspectingStudent;
                    setInspectingStudent(null);
                    handleOpenEditModal(s);
                  }}
                >
                  ✏️ Edit Profile
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const s = inspectingStudent;
                    setInspectingStudent(null);
                    handleSelectStudentForIssuance(s);
                  }}
                >
                  ＋ Issue Credential
                </Button>
              </div>
              <Button type="button" variant="secondary" onClick={() => setInspectingStudent(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
