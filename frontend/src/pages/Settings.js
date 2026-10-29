import React, { useEffect, useState } from "react";
import api from "../api";
import { Alert, Button } from "../components/UI";

const disclosureOptions = [
  ["candidateName", "Student name"],
  ["documentType", "Document type"],
  ["course", "Course or qualification"],
  ["issueDate", "Issue date"],
  ["grade", "Grade / CGPA"],
  ["rollNumber", "Roll number"]
];

export default function Settings() {
  const [selectedFields, setSelectedFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreResult, setRestoreResult] = useState(null);

  useEffect(() => {
    let active = true;
    api.get("/institution/settings")
      .then((response) => { if (active) setSelectedFields(response.data.publicVerificationFields || []); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || "Privacy settings could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function toggleField(field) {
    setSaved(false);
    setSelectedFields((current) => current.includes(field)
      ? current.filter((value) => value !== field)
      : [...current, field]);
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await api.patch("/institution/settings", { publicVerificationFields: selectedFields });
      setSelectedFields(response.data.publicVerificationFields);
      setSaved(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Privacy settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadBackup() {
    setBackupBusy(true);
    setError("");
    setRestoreResult(null);
    try {
      const response = await api.get("/institution/backup", { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "certchain-institution-backup.zip";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Backup could not be downloaded.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreBackup() {
    if (!restoreFile || !window.confirm("Restore certificates from this backup? Existing records will not be overwritten.")) return;
    setBackupBusy(true);
    setError("");
    setRestoreResult(null);
    try {
      const payload = new FormData();
      payload.append("backup", restoreFile);
      const response = await api.post("/institution/backup/restore", payload);
      setRestoreResult(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Backup could not be restored.");
    } finally {
      setBackupBusy(false);
    }
  }

  return <div className="page settings-page">
    <div className="page-header"><div><span className="eyebrow">Institution controls</span><h1>Verification privacy</h1><p className="lead">Choose which certificate details appear after a successful public verification.</p></div></div>
    <section className="card card-pad settings-panel">
      <div className="settings-panel-heading"><div><span className="eyebrow">Public disclosure</span><h2>Fields shown to verifiers</h2><p className="muted small">These choices control display only. Every printed field is still checked against the on-chain commitment.</p></div><span className="settings-seal" aria-hidden="true">✓</span></div>
      {loading ? <p className="muted">Loading settings...</p> : <div className="disclosure-options">{disclosureOptions.map(([field, label]) => <label className="disclosure-option" key={field}><input type="checkbox" checked={selectedFields.includes(field)} onChange={() => toggleField(field)} /><span><strong>{label}</strong><small>{selectedFields.includes(field) ? "Visible after verification" : "Hidden from public result"}</small></span></label>)}</div>}
      {error && <Alert>{error}</Alert>}
      {saved && <Alert type="success">Privacy settings saved.</Alert>}
      <div className="form-actions"><Button onClick={saveSettings} loading={saving} disabled={loading}>{saving ? "Saving settings" : "Save settings"}</Button></div>
    </section>
    <section className="card card-pad backup-panel">
      <div className="settings-panel-heading"><div><span className="eyebrow">Records protection</span><h2>Backup and restore</h2><p className="muted small">Backups contain student records and PDFs. Store the downloaded archive securely.</p></div><span className="settings-seal" aria-hidden="true">↥</span></div>
      <p className="backup-note">Restore checks every record against the current blockchain. The original chain must still be available; existing certificates are never overwritten.</p>
      <div className="backup-actions"><Button variant="secondary" onClick={downloadBackup} loading={backupBusy}>{backupBusy ? "Preparing archive" : "Download backup"}</Button><label className="field"><span>Restore ZIP archive</span><input className="input" type="file" accept=".zip,application/zip" onChange={(event) => setRestoreFile(event.target.files?.[0] || null)} /></label><Button onClick={restoreBackup} loading={backupBusy} disabled={!restoreFile}>Restore records</Button></div>
      {restoreResult && <Alert type="success">Restored {restoreResult.restored} certificates and {restoreResult.restoredAuditEvents} audit events; skipped {restoreResult.skipped}; conflicts {restoreResult.conflicts}.</Alert>}
    </section>
  </div>;
}
