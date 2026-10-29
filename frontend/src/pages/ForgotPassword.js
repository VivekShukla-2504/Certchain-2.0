import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Alert, Button, Field, PasswordField } from "../components/UI";

export default function ForgotPassword() {
  const [step, setStep] = useState("email");
  const [form, setForm] = useState({ email: "", otp: "", password: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await api.post("/auth/forgot-password", { email: form.email.trim() });
      setMessage(response.data.message);
      setStep("otp");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to request a reset code.");
    } finally {
      setLoading(false);
    }
  }

  function verifyOtpStep(event) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(form.otp)) return setError("Enter the 6-digit code from your email.");
    setStep("password");
  }

  async function resetPassword(event) {
    event.preventDefault();
    setError("");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email: form.email.trim(), otp: form.otp, password: form.password });
      setMessage("Password reset successfully. You can now sign in.");
      setStep("done");
    } catch (requestError) {
      const message = requestError.response?.data?.message;
      setError(message === "Invalid or expired reset code"
        ? "This OTP is invalid or expired. Request a new code and use it within 10 minutes."
        : message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  const stepCopy = {
    email: ["Forgot your password?", "Enter your institution email and we will send a reset code if the account exists."],
    otp: ["Enter your reset code", "We sent a 6-digit code to your institution email. This OTP is valid for 10 minutes."],
    password: ["Choose a new password", "Your new password must be at least 8 characters."],
    done: ["Password reset complete", "Your password has been updated successfully."]
  }[step];

  return <div className="auth-layout"><aside className="auth-aside"><div><span className="eyebrow">Account recovery</span><h1>Get back to trusted credentials.</h1><p>Request a one-time code to securely reset your institution password.</p></div></aside><main className="auth-form"><div className="auth-form-inner"><span className="eyebrow">Reset password</span><div className="recovery-progress"><span className={step !== "email" ? "complete" : "active"}>1</span><i /><span className={step === "otp" ? "active" : step === "password" || step === "done" ? "complete" : ""}>2</span><i /><span className={step === "password" ? "active" : step === "done" ? "complete" : ""}>3</span></div><h2>{stepCopy[0]}</h2><p className="lead">{stepCopy[1]}</p>
      {step === "email" && <form className="form" onSubmit={handleSubmit}><Field label="Work email"><input className="input" type="email" placeholder="you@institution.edu" value={form.email} onChange={(event) => update("email", event.target.value)} required /></Field>{error && <Alert>{error}</Alert>}<Button className="button-block" type="submit" loading={loading}>{loading ? "Sending code" : "Send reset code"}</Button></form>}
      {step === "otp" && <form className="form" onSubmit={verifyOtpStep}><Field label="6-digit OTP" hint="Check your email for the one-time code."><input className="input otp-input" inputMode="numeric" maxLength="6" autoFocus placeholder="000000" value={form.otp} onChange={(event) => update("otp", event.target.value.replace(/\D/g, ""))} required /></Field>{error && <Alert>{error}</Alert>}<Button className="button-block" type="submit">Verify code</Button><button className="text-action recovery-back" type="button" onClick={() => { setStep("email"); setError(""); }}>Use a different email</button></form>}
      {step === "password" && <form className="form" onSubmit={resetPassword}><PasswordField label="New password" hint="Use at least 8 characters." value={form.password} onChange={(event) => update("password", event.target.value)} required /><PasswordField label="Confirm password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} required />{error && <Alert>{error}</Alert>}<Button className="button-block" type="submit" loading={loading}>{loading ? "Resetting password" : "Reset password"}</Button></form>}
      {step === "done" && <><Alert type="success">{message}</Alert><Link className="button button-primary button-block" to="/login">Back to sign in</Link></>}
      <p className="muted small"><Link to="/login">Back to sign in</Link></p></div></main></div>;
}
