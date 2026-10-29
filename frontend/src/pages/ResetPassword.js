import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { Alert, Button, Field, PasswordField } from "../components/UI";

export default function ResetPassword() {
  const [form, setForm] = useState({ email: "", otp: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    if (!/^\d{6}$/.test(form.otp)) return setError("Enter the 6-digit code from your email.");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email: form.email.trim(), otp: form.otp, password: form.password });
      setDone(true);
      setTimeout(() => navigate("/login"), 1200);
    } catch (requestError) {
      const message = requestError.response?.data?.message;
      setError(message === "Invalid or expired reset code"
        ? "This OTP is invalid or expired. Request a new code and use it within 10 minutes."
        : message || "Unable to reset password.");
    } finally { setLoading(false); }
  }
  return <div className="page page-narrow"><div className="page-header"><div><span className="eyebrow">Account recovery</span><h1>Reset password</h1><p className="lead">Use the one-time code sent to your institution email. It is valid for 10 minutes.</p></div></div><div className="card card-pad"><form className="form" onSubmit={handleSubmit}><Field label="Work email"><input className="input" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required /></Field><Field label="6-digit reset code"><input className="input" inputMode="numeric" maxLength="6" placeholder="000000" value={form.otp} onChange={(event) => update("otp", event.target.value.replace(/\D/g, ""))} required /></Field><PasswordField label="New password" hint="Use at least 8 characters." value={form.password} onChange={(event) => update("password", event.target.value)} required /><PasswordField label="Confirm password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} required />{error && <Alert>{error}</Alert>}{done && <Alert type="success">Password reset successfully. Redirecting to sign in...</Alert>}<Button className="button-block" type="submit" loading={loading}>{loading ? "Resetting password" : "Reset password"}</Button></form><p className="muted small"><Link to="/forgot-password">Request a new code</Link></p></div></div>;
}
