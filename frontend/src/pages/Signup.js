import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { Alert, Button, Field, PasswordField } from "../components/UI";

export default function Signup() {
  const [form, setForm] = useState({ name: "", institutionId: "", email: "", password: "", walletAddress: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Institution registered. You can now sign in.");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((errors) => ({ ...errors, [field]: "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const errors = {};
    if (!form.institutionId.trim()) errors.institutionId = "Institution ID is required.";
    if (form.institutionId.trim() && !/^[A-Za-z0-9_-]{2,40}$/.test(form.institutionId.trim())) errors.institutionId = "Use 2-40 letters, numbers, hyphens or underscores.";
    if (Object.values(form).some((value) => !value.trim())) setError("Complete all fields to create your institution.");
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    if (form.password.length < 8) return setError("Use a password with at least 8 characters.");
    setLoading(true);
    try {
      const response = await api.post("/auth/signup", form);
      setDone(true);
      setSuccessMessage(response.data.message === "Institution registered and awaiting approval"
        ? "Registration submitted. Platform approval is required before sign-in."
        : "Institution registered. You can now sign in.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      const message = err.response?.data?.message || "Signup failed";
      setError(message);
      if (err.response?.status === 409) setFieldErrors({ institutionId: "This institution ID or email is already registered." });
    } finally {
      setLoading(false);
    }
  }

  return <div className="page page-narrow"><div className="page-header"><div><span className="eyebrow">Get started</span><h1>Register institution</h1><p className="lead">Set up your organization to issue verifiable credentials.</p></div></div>
    <div className="card card-pad"><form className="form" onSubmit={handleSubmit}>
      <Field label="Institution name"><input className="input" placeholder="University or organization" value={form.name} onChange={(e) => update("name", e.target.value)} required /></Field>
      <Field label="Institution ID" hint={fieldErrors.institutionId ? "" : "Use 2-40 letters, numbers, hyphens or underscores."}><input className={`input ${fieldErrors.institutionId ? "input-error" : ""}`} placeholder="e.g. JNU" value={form.institutionId} onChange={(e) => update("institutionId", e.target.value)} aria-invalid={!!fieldErrors.institutionId} required />{fieldErrors.institutionId && <span className="field-error">{fieldErrors.institutionId}</span>}</Field>
      <Field label="Admin email"><input className="input" type="email" placeholder="admin@institution.edu" value={form.email} onChange={(e) => update("email", e.target.value)} required /></Field>
      <PasswordField label="Password" placeholder="Create a secure password" value={form.password} onChange={(e) => update("password", e.target.value)} hint="Use at least 8 characters." required />
      <Field label="Wallet address" hint="Use a test account address from your local Hardhat node."><input className="input mono" placeholder="0x..." value={form.walletAddress} onChange={(e) => update("walletAddress", e.target.value)} required /></Field>
      {error && <Alert>{error}</Alert>}
      {done && <Alert type="success">{successMessage}</Alert>}
      <Button className="button-block" type="submit" loading={loading}>{loading ? "Creating institution" : "Create institution"}</Button>
      <p className="muted small form-footer-link">Already have an account? <Link to="/login">Login</Link></p>
    </form></div>
  </div>;
}
