import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Alert, Button, Field } from "../components/UI";
import { connectMetaMaskWallet } from "../utils/web3";

const transactionSteps = ["Preparing", "Submitting", "Pending", "Confirmed"];

function TransactionStatus({ state }) {
  if (state === "idle") return null;
  const activeIndex = state === "preparing" ? 0 : state === "submitting" ? 1 : state === "confirmed" ? 3 : -1;
  const failed = state === "failed";
  const message = state === "preparing"
    ? "Compiling official academic credential & computing cryptographic SHA-256 fingerprint."
    : state === "submitting"
      ? "The backend is submitting and anchoring the certificate hash to Ethereum Sepolia smart contract."
      : state === "confirmed"
        ? "The transaction was confirmed on Ethereum Sepolia and official notification email dispatched to the student."
        : "The transaction could not be completed. No certificate was confirmed.";

  return (
    <section className={`transaction-status ${failed ? "transaction-failed" : state === "confirmed" ? "transaction-confirmed" : ""}`} aria-live="polite">
      <div className="transaction-status-heading">
        <div>
          <span className="eyebrow">Blockchain transaction</span>
          <h3>{failed ? "Transaction failed" : state === "confirmed" ? "Transaction confirmed on-chain" : "Issuance in progress"}</h3>
        </div>
        <span className={`transaction-state-icon ${failed ? "failed" : state === "confirmed" ? "confirmed" : "active"}`}>
          {failed ? "!" : state === "confirmed" ? "✓" : ""}
        </span>
      </div>
      <p>{message}</p>
      <div className="transaction-steps">
        {transactionSteps.map((step, index) => {
          const pendingUnavailable = step === "Pending";
          const completed = !failed && ((state === "confirmed" && index <= 3) || (state === "submitting" && index < 1) || (state === "preparing" && index < 0));
          const current = !failed && ((state === "preparing" && index === 0) || (state === "submitting" && index === 1) || (state === "confirmed" && index === 3));
          return (
            <div className={`transaction-step ${completed ? "completed" : ""} ${current ? "current" : ""} ${pendingUnavailable ? "unavailable" : ""}`} key={step}>
              <span className="transaction-step-marker">{completed ? "✓" : index + 1}</span>
              <span>{step}</span>
              {pendingUnavailable && <small>Not exposed</small>}
            </div>
          );
        })}
      </div>
      {failed && <div className="transaction-failure-note">The backend did not return a confirmed transaction. You can correct the form and try again.</div>}
    </section>
  );
}

const CERT_TYPES = [
  { id: "Marksheet", label: "Marksheet / Transcript", icon: "📊", desc: "Course grades, credit breakdown, and CGPA" },
  { id: "Migration", label: "Migration Certificate", icon: "✈️", desc: "Formal migration & dues clearance for other universities" },
  { id: "Character", label: "Character Certificate", icon: "🎖️", desc: "Certified moral conduct, discipline & extracurricular record" },
  { id: "NOC", label: "No Objection Certificate (NOC)", icon: "📄", desc: "Institutional clearance for internships, jobs & higher studies" },
  { id: "Degree", label: "Degree Certificate", icon: "📜", desc: "Formal graduation degree conferment & academic honors" },
  { id: "Provisional", label: "Provisional Certificate", icon: "🎓", desc: "Pre-convocation degree completion credential" }
];

export default function Issue() {
  const [form, setForm] = useState({
    candidateName: "",
    rollNumber: "",
    course: "",
    department: "",
    academicSession: "2022-2026",
    grade: "First Class with Distinction",
    issueDate: new Date().toISOString().split("T")[0],
    studentWallet: "",
    studentEmail: ""
  });
  const [documentType, setDocumentType] = useState("Marksheet");
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [certTypeData, setCertTypeData] = useState({
    // Marksheet specific
    semester: "Semester VI (Final Year)",
    examinationSession: "May - June 2026",
    cgpa: "9.32 / 10.0",
    resultClassification: "First Class with Distinction",
    subjects: [
      { code: "CS-601", name: "Distributed Systems & Cloud Architecture", max: 100, marks: 95, grade: "O" },
      { code: "CS-602", name: "Blockchain Architecture & Smart Contracts", max: 100, marks: 98, grade: "O" },
      { code: "CS-603", name: "Cryptography & Cybersecurity Protocols", max: 100, marks: 91, grade: "A+" },
      { code: "CS-604", name: "Artificial Intelligence & Neural Networks", max: 100, marks: 93, grade: "A+" },
      { code: "CS-605", name: "Capstone Major Technical Project", max: 100, marks: 97, grade: "O" }
    ],
    // Migration specific
    migrationRef: "MIG/2026/8941",
    migratingTo: "Indian Institute of Science (IISc), Bangalore",
    reason: "Admission to Post-Graduate Master of Technology Program",
    duesStatus: "All library, hostel, laboratory, and tuition dues fully cleared",
    // Character specific
    characterRef: "CC/2026/4102",
    periodFrom: "August 2022",
    periodTo: "June 2026",
    conduct: "Exemplary and Commendable",
    disciplinaryRecord: "Clean — No disciplinary action or misconduct ever recorded",
    extracurricular: "Lead Coordinator of Technical Innovation Cell, Active Member of NSS",
    purpose: "Higher Academic Admissions & Professional Employment Verification",
    // NOC specific
    nocRef: "NOC/2026/1105",
    addressedTo: "Google India Private Limited / Microsoft IDC",
    purposeOfNoc: "Full-Time Summer Technical Internship (Software Engineering)",
    duration: "June 1, 2026 to August 31, 2026 (Summer Break)",
    remarks: "The institution has no objection to the student undertaking this engagement without detriment to academic schedules.",
    // Degree specific
    specialization: "Artificial Intelligence & Distributed Systems",
    convocationYear: "2026",
    division: "First Class with Honors & Distinction",
    // Provisional specific
    provisionalRef: "PROV/2026/6219",
    examMonthYear: "June 2026",
    validityClause: "Valid until the original degree is formally conferred at the upcoming annual convocation ceremony."
  });

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [transactionState, setTransactionState] = useState("idle");

  useEffect(() => {
    api.get("/students").then((res) => setRegisteredStudents(res.data.students || [])).catch(() => {});
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((errors) => ({ ...errors, [field]: "" }));
  }

  function handleSelectStudent(student) {
    setSelectedStudent(student);
    setForm((prev) => ({
      ...prev,
      candidateName: student.fullName,
      rollNumber: student.enrollmentNumber,
      course: student.course || prev.course,
      department: student.department || prev.department,
      academicSession: student.academicSession || prev.academicSession,
      studentWallet: student.walletAddress,
      studentEmail: student.email
    }));
  }

  function validateFields() {
    const errors = {};
    const labels = {
      candidateName: "Candidate name",
      rollNumber: "Roll number",
      course: "Course or qualification",
      issueDate: "Issue date"
    };
    Object.entries(labels).forEach(([field, label]) => {
      if (!form[field] || !form[field].trim()) errors[field] = `${label} is required.`;
    });
    if (form.candidateName && form.candidateName.trim().length < 2) errors.candidateName = "Enter the candidate's full name.";
    if (form.course && form.course.trim().length < 2) errors.course = "Enter a course or qualification.";
    if (form.issueDate && Number.isNaN(Date.parse(form.issueDate))) errors.issueDate = "Enter a valid issue date.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!validateFields()) return;

    setTransactionState("preparing");
    setLoading(true);
    try {
      const payload = new FormData();
      payload.append("candidateName", form.candidateName.trim());
      payload.append("rollNumber", form.rollNumber.trim());
      payload.append("course", form.course.trim());
      payload.append("department", (form.department || "").trim());
      payload.append("academicSession", (form.academicSession || "").trim());
      payload.append("grade", (form.grade || "").trim() || (documentType === "Marksheet" ? certTypeData.cgpa : "Passed with Distinction"));
      payload.append("issueDate", form.issueDate || new Date().toISOString().split("T")[0]);
      payload.append("documentType", documentType);
      payload.append("studentWallet", (form.studentWallet || "").trim());
      payload.append("studentEmail", (form.studentEmail || "").trim());
      payload.append("certificateData", JSON.stringify(certTypeData));
      if (selectedStudent?.id || selectedStudent?._id) {
        payload.append("studentId", selectedStudent.id || selectedStudent._id);
      }

      setTransactionState("submitting");
      const res = await api.post("/certificates/issue", payload);
      setTransactionState("confirmed");
      setResult(res.data);
    } catch (err) {
      setTransactionState("failed");
      setError(err.response?.data?.message || "The certificate could not be issued. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page issue-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Academic Credential Registry</span>
          <h1>Issue Institutional Credential</h1>
          <p className="lead">Select a student, choose the certificate prototype, and anchor it directly to Ethereum Sepolia.</p>
        </div>
        <span className="badge badge-neutral">On-chain issuance</span>
      </div>

      <div className="split-grid">
        <section className="card card-pad">
          <form className="form" onSubmit={handleSubmit} noValidate>
            {/* Step 1: Student Selection */}
            <div style={{ marginBottom: "1.25rem", padding: "0.85rem", background: "var(--cc-cloud)", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Step 1: Select Registered Student</h4>
                {selectedStudent && (
                  <button
                    type="button"
                    style={{ fontSize: "0.8rem", color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                    onClick={() => setSelectedStudent(null)}
                  >
                    ✕ Clear Selection
                  </button>
                )}
              </div>

              {selectedStudent ? (
                <div style={{ background: "rgba(37, 99, 235, 0.08)", padding: "0.6rem 0.85rem", borderRadius: 6, border: "1px solid rgba(37, 99, 235, 0.2)" }}>
                  <div style={{ fontWeight: 600, color: "#1e40af", fontSize: "0.9rem" }}>✓ Selected: {selectedStudent.fullName} ({selectedStudent.enrollmentNumber})</div>
                  <div style={{ fontSize: "0.8rem", color: "#3b82f6", marginTop: 2 }}>
                    Course: {selectedStudent.course} · Wallet: {selectedStudent.walletAddress ? `${selectedStudent.walletAddress.slice(0, 10)}...` : "Auto"} · Email: {selectedStudent.email}
                  </div>
                </div>
              ) : (
                <Field label="Choose from Registered Students (Autofill)">
                  <select
                    className="select"
                    defaultValue=""
                    onChange={(e) => {
                      const s = registeredStudents.find((item) => (item.id || item._id) === e.target.value);
                      if (s) handleSelectStudent(s);
                    }}
                  >
                    <option value="" disabled>-- Select a registered student to autofill --</option>
                    {registeredStudents.map((s) => (
                      <option key={s.id || s._id} value={s.id || s._id}>
                        {s.fullName} - {s.enrollmentNumber} ({s.course})
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            {/* Step 2: Certificate Type Selection */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label className="muted small" style={{ fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>
                Step 2: Choose Certificate Format (6 Standard Institutional Prototypes):
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem" }}>
                {CERT_TYPES.map((t) => {
                  const isSelected = documentType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDocumentType(t.id)}
                      style={{
                        textAlign: "left",
                        padding: "0.75rem",
                        borderRadius: 6,
                        border: isSelected ? "2px solid #2563eb" : "1px solid var(--cc-line)",
                        background: isSelected ? "rgba(37, 99, 235, 0.08)" : "var(--cc-paper)",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                        <span>{t.icon}</span>
                        <strong style={{ fontSize: "0.85rem", color: isSelected ? "#1d4ed8" : "inherit" }}>{t.label}</strong>
                      </div>
                      <p className="muted" style={{ fontSize: "0.75rem", margin: 0, lineHeight: 1.3 }}>{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Core Details */}
            <Field label="Candidate Legal Name *">
              <input
                className={`input ${fieldErrors.candidateName ? "input-error" : ""}`}
                placeholder="Full legal name"
                value={form.candidateName}
                onChange={(e) => update("candidateName", e.target.value)}
              />
              {fieldErrors.candidateName && <span className="field-error">{fieldErrors.candidateName}</span>}
            </Field>

            <div className="form-grid-2">
              <Field label="Roll / Enrollment Number *">
                <input
                  className={`input ${fieldErrors.rollNumber ? "input-error" : ""}`}
                  placeholder="e.g. 2026-CSE-001"
                  value={form.rollNumber}
                  onChange={(e) => update("rollNumber", e.target.value)}
                />
                {fieldErrors.rollNumber && <span className="field-error">{fieldErrors.rollNumber}</span>}
              </Field>

              <Field label="Course or Qualification *">
                <input
                  className={`input ${fieldErrors.course ? "input-error" : ""}`}
                  placeholder="e.g. Bachelor of Technology in Computer Science"
                  value={form.course}
                  onChange={(e) => update("course", e.target.value)}
                />
                {fieldErrors.course && <span className="field-error">{fieldErrors.course}</span>}
              </Field>

              <Field label="Department / Faculty">
                <input
                  className="input"
                  placeholder="e.g. School of Computer & Systems Sciences"
                  value={form.department}
                  onChange={(e) => update("department", e.target.value)}
                />
              </Field>

              <Field label="Issue Date *">
                <input
                  className={`input ${fieldErrors.issueDate ? "input-error" : ""}`}
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => update("issueDate", e.target.value)}
                />
                {fieldErrors.issueDate && <span className="field-error">{fieldErrors.issueDate}</span>}
              </Field>
            </div>

            <div className="form-grid-2">
              <Field label="Student Sepolia Public Key (Wallet)">
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    className="input mono"
                    style={{ fontSize: "0.85rem", flex: 1 }}
                    placeholder="0x..."
                    value={form.studentWallet}
                    onChange={(e) => update("studentWallet", e.target.value)}
                  />
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}
                    onClick={async () => {
                      try {
                        const addr = await connectMetaMaskWallet();
                        update("studentWallet", addr);
                      } catch (e) {
                        alert(e.message);
                      }
                    }}
                  >
                    🦊 Autofill
                  </button>
                </div>
              </Field>

              <Field label="Student Email (Auto-Dispatch Notification)">
                <input
                  className="input"
                  type="email"
                  placeholder="student@example.edu"
                  value={form.studentEmail}
                  onChange={(e) => update("studentEmail", e.target.value)}
                />
              </Field>
            </div>

            {/* Step 4: Type-Specific Dynamic Fields */}
            <div style={{ margin: "1.25rem 0", padding: "1rem", background: "var(--cc-paper)", borderRadius: 8, border: "1px solid var(--cc-line)" }}>
              <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
                📋 Specific Fields for {documentType}
              </h4>

              {/* Marksheet specific */}
              {documentType === "Marksheet" && (
                <div>
                  <div className="form-grid-2" style={{ marginBottom: "0.75rem" }}>
                    <Field label="Semester / Term">
                      <input
                        className="input"
                        value={certTypeData.semester}
                        onChange={(e) => setCertTypeData({ ...certTypeData, semester: e.target.value })}
                      />
                    </Field>
                    <Field label="Examination Session">
                      <input
                        className="input"
                        value={certTypeData.examinationSession}
                        onChange={(e) => setCertTypeData({ ...certTypeData, examinationSession: e.target.value })}
                      />
                    </Field>
                    <Field label="Cumulative CGPA / SGPA">
                      <input
                        className="input"
                        value={certTypeData.cgpa}
                        onChange={(e) => setCertTypeData({ ...certTypeData, cgpa: e.target.value })}
                      />
                    </Field>
                    <Field label="Result Status">
                      <input
                        className="input"
                        value={certTypeData.resultClassification}
                        onChange={(e) => setCertTypeData({ ...certTypeData, resultClassification: e.target.value })}
                      />
                    </Field>
                  </div>

                  <label className="muted small" style={{ fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                    Course Subjects & Grades:
                  </label>
                  <div style={{ overflowX: "auto", border: "1px solid var(--cc-line)", borderRadius: 6 }}>
                    <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "var(--cc-cloud)", borderBottom: "1px solid var(--cc-line)", textAlign: "left" }}>
                          <th style={{ padding: "6px 8px" }}>Code</th>
                          <th style={{ padding: "6px 8px" }}>Subject Name</th>
                          <th style={{ padding: "6px 8px", width: 60 }}>Max</th>
                          <th style={{ padding: "6px 8px", width: 70 }}>Marks</th>
                          <th style={{ padding: "6px 8px", width: 60 }}>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {certTypeData.subjects.map((sub, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--cc-line)" }}>
                            <td style={{ padding: "4px 8px" }}>
                              <input
                                className="input mono"
                                style={{ padding: "3px 5px", fontSize: "0.75rem" }}
                                value={sub.code}
                                onChange={(e) => {
                                  const next = [...certTypeData.subjects];
                                  next[idx].code = e.target.value;
                                  setCertTypeData({ ...certTypeData, subjects: next });
                                }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px" }}>
                              <input
                                className="input"
                                style={{ padding: "3px 5px", fontSize: "0.75rem" }}
                                value={sub.name}
                                onChange={(e) => {
                                  const next = [...certTypeData.subjects];
                                  next[idx].name = e.target.value;
                                  setCertTypeData({ ...certTypeData, subjects: next });
                                }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px" }}>
                              <input
                                className="input"
                                style={{ padding: "3px 5px", fontSize: "0.75rem", textAlign: "center" }}
                                value={sub.max}
                                onChange={(e) => {
                                  const next = [...certTypeData.subjects];
                                  next[idx].max = e.target.value;
                                  setCertTypeData({ ...certTypeData, subjects: next });
                                }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px" }}>
                              <input
                                className="input"
                                style={{ padding: "3px 5px", fontSize: "0.75rem", textAlign: "center" }}
                                value={sub.marks}
                                onChange={(e) => {
                                  const next = [...certTypeData.subjects];
                                  next[idx].marks = e.target.value;
                                  setCertTypeData({ ...certTypeData, subjects: next });
                                }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px" }}>
                              <input
                                className="input"
                                style={{ padding: "3px 5px", fontSize: "0.75rem", textAlign: "center" }}
                                value={sub.grade}
                                onChange={(e) => {
                                  const next = [...certTypeData.subjects];
                                  next[idx].grade = e.target.value;
                                  setCertTypeData({ ...certTypeData, subjects: next });
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Migration specific */}
              {documentType === "Migration" && (
                <div className="form-grid-2">
                  <Field label="Migration Certificate Ref No">
                    <input
                      className="input"
                      value={certTypeData.migrationRef}
                      onChange={(e) => setCertTypeData({ ...certTypeData, migrationRef: e.target.value })}
                    />
                  </Field>
                  <Field label="Destination University / Board">
                    <input
                      className="input"
                      value={certTypeData.migratingTo}
                      onChange={(e) => setCertTypeData({ ...certTypeData, migratingTo: e.target.value })}
                    />
                  </Field>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field label="Reason for Migration">
                      <input
                        className="input"
                        value={certTypeData.reason}
                        onChange={(e) => setCertTypeData({ ...certTypeData, reason: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field label="Dues Clearance Status">
                      <input
                        className="input"
                        value={certTypeData.duesStatus}
                        onChange={(e) => setCertTypeData({ ...certTypeData, duesStatus: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* Character specific */}
              {documentType === "Character" && (
                <div className="form-grid-2">
                  <Field label="Certificate Serial No">
                    <input
                      className="input"
                      value={certTypeData.characterRef}
                      onChange={(e) => setCertTypeData({ ...certTypeData, characterRef: e.target.value })}
                    />
                  </Field>
                  <Field label="Conduct & Moral Rating">
                    <input
                      className="input"
                      value={certTypeData.conduct}
                      onChange={(e) => setCertTypeData({ ...certTypeData, conduct: e.target.value })}
                    />
                  </Field>
                  <Field label="Period of Study (From)">
                    <input
                      className="input"
                      value={certTypeData.periodFrom}
                      onChange={(e) => setCertTypeData({ ...certTypeData, periodFrom: e.target.value })}
                    />
                  </Field>
                  <Field label="Period of Study (To)">
                    <input
                      className="input"
                      value={certTypeData.periodTo}
                      onChange={(e) => setCertTypeData({ ...certTypeData, periodTo: e.target.value })}
                    />
                  </Field>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field label="Disciplinary Record">
                      <input
                        className="input"
                        value={certTypeData.disciplinaryRecord}
                        onChange={(e) => setCertTypeData({ ...certTypeData, disciplinaryRecord: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field label="Extracurricular Merits">
                      <input
                        className="input"
                        value={certTypeData.extracurricular}
                        onChange={(e) => setCertTypeData({ ...certTypeData, extracurricular: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* NOC specific */}
              {documentType === "NOC" && (
                <div className="form-grid-2">
                  <Field label="NOC Reference No">
                    <input
                      className="input"
                      value={certTypeData.nocRef}
                      onChange={(e) => setCertTypeData({ ...certTypeData, nocRef: e.target.value })}
                    />
                  </Field>
                  <Field label="Effective Duration">
                    <input
                      className="input"
                      value={certTypeData.duration}
                      onChange={(e) => setCertTypeData({ ...certTypeData, duration: e.target.value })}
                    />
                  </Field>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field label="Addressed To / Sponsoring Organization">
                      <input
                        className="input"
                        value={certTypeData.addressedTo}
                        onChange={(e) => setCertTypeData({ ...certTypeData, addressedTo: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field label="Purpose of NOC">
                      <input
                        className="input"
                        value={certTypeData.purposeOfNoc}
                        onChange={(e) => setCertTypeData({ ...certTypeData, purposeOfNoc: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field label="Institutional Terms">
                      <textarea
                        className="input"
                        rows={2}
                        value={certTypeData.remarks}
                        onChange={(e) => setCertTypeData({ ...certTypeData, remarks: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* Degree specific */}
              {documentType === "Degree" && (
                <div className="form-grid-2">
                  <Field label="Specialization / Honors">
                    <input
                      className="input"
                      value={certTypeData.specialization}
                      onChange={(e) => setCertTypeData({ ...certTypeData, specialization: e.target.value })}
                    />
                  </Field>
                  <Field label="Convocation Year">
                    <input
                      className="input"
                      value={certTypeData.convocationYear}
                      onChange={(e) => setCertTypeData({ ...certTypeData, convocationYear: e.target.value })}
                    />
                  </Field>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field label="Division / Classification">
                      <input
                        className="input"
                        value={certTypeData.division}
                        onChange={(e) => setCertTypeData({ ...certTypeData, division: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* Provisional specific */}
              {documentType === "Provisional" && (
                <div className="form-grid-2">
                  <Field label="Provisional Ref No">
                    <input
                      className="input"
                      value={certTypeData.provisionalRef}
                      onChange={(e) => setCertTypeData({ ...certTypeData, provisionalRef: e.target.value })}
                    />
                  </Field>
                  <Field label="Exam Month & Year">
                    <input
                      className="input"
                      value={certTypeData.examMonthYear}
                      onChange={(e) => setCertTypeData({ ...certTypeData, examMonthYear: e.target.value })}
                    />
                  </Field>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field label="Validity Clause">
                      <input
                        className="input"
                        value={certTypeData.validityClause}
                        onChange={(e) => setCertTypeData({ ...certTypeData, validityClause: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </div>

            {error && <Alert>{error}</Alert>}
            <TransactionStatus state={transactionState} />

            <div className="form-actions" style={{ marginTop: "1.25rem" }}>
              <Button type="submit" loading={loading} style={{ width: "100%", padding: "0.85rem", fontSize: "1rem" }}>
                {loading ? "Anchoring to Sepolia Blockchain..." : `🔒 Sign & Issue ${documentType} on Ethereum Sepolia`}
              </Button>
            </div>
            <p className="form-footnote" style={{ textAlign: "center" }}>
              No PDF upload required. CertChain compiles the official PDF, registers the SHA-256 fingerprint on-chain, and dispatches the PDF directly to the student's email.
            </p>
          </form>
        </section>

        <aside className="card card-pad">
          <span className="eyebrow">Blockchain Security</span>
          <h3 style={{ marginTop: 8 }}>Permanent Cryptographic Proof</h3>
          <p className="muted small" style={{ lineHeight: 1.65 }}>
            CertChain computes a 256-bit cryptographic SHA-256 fingerprint of the compiled academic document and permanently records it on Ethereum Sepolia.
          </p>
          <div style={{ marginTop: "1rem", padding: "0.85rem", background: "var(--cc-cloud)", borderRadius: 6, fontSize: "0.8rem", color: "#334155" }}>
            <strong>Supported Credentials:</strong>
            <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem", lineHeight: 1.6 }}>
              <li>Academic Marksheets & Grade Transcripts</li>
              <li>Official Migration Certificates</li>
              <li>Character & Conduct Certificates</li>
              <li>No Objection Certificates (NOC)</li>
              <li>Formal Degree Certificates</li>
              <li>Provisional Degree Certificates</li>
            </ul>
          </div>
        </aside>
      </div>

      {result && (
        <section className="card card-pad result-card issuance-confirmation" style={{ marginTop: 22 }}>
          <div className="confirmation-heading">
            <div className="confirmation-icon">✓</div>
            <div>
              <span className="eyebrow">Issuance complete</span>
              <h2>{result.certificate?.documentType || documentType} Successfully Issued</h2>
              <p className="lead">The credential record was anchored to Ethereum Sepolia and an email with the PDF was sent to the student.</p>
            </div>
            <span className="badge badge-success">Confirmed On-Chain</span>
          </div>

          <div className="result-meta">
            <div>
              <span className="meta-label">Certificate ID</span>
              <strong className="meta-value" style={{ color: "#2563eb", fontFamily: "monospace" }}>{result.certificate.certId}</strong>
            </div>
            <div>
              <span className="meta-label">Transaction hash</span>
              <span className="mono">{result.certificate.txHash}</span>
            </div>
            <div>
              <span className="meta-label">Blockchain confirmation</span>
              <span className="meta-value"><span className="status-dot" /> Confirmed on Sepolia</span>
            </div>
            {result.certificate.ipfsCid && (
              <div>
                <span className="meta-label">Encrypted IPFS backup</span>
                <span className="mono">{result.certificate.ipfsCid}</span>
              </div>
            )}
            <div className="qr-panel">
              <span className="meta-label">Verification QR</span>
              <img src={result.qrDataUrl} alt="Verification QR code" />
            </div>
          </div>

          <div className="confirmation-actions" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
            <a
              className="button button-primary"
              href={`/api/certificates/${result.certificate.certId}/download-student`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              📥 Download Generated PDF
            </a>
            <a
              className="button button-secondary"
              href={result.verifyUrl}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              🔍 Open Verification Portal
            </a>
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                setError("");
                setTransactionState("idle");
              }}
            >
              Issue Another Credential
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
