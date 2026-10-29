import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { Alert, Brand, Button, Field, PasswordField } from "../components/UI";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) return setError("Enter your email and password to continue.");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("certchain_token", res.data.token);
      localStorage.setItem("certchain_institution", JSON.stringify(res.data.institution));
      navigate(res.data.institution.role === "reviewer" ? "/certificates" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return <div className="auth-layout">
    <aside className="auth-aside"><Brand /><div><h1>Trust every credential.</h1><p>Issue and verify academic certificates with a permanent, tamper-evident record your institution can rely on.</p></div></aside>
    <main className="auth-form"><div className="auth-form-inner"><span className="eyebrow">Institution portal</span><h2>Welcome back</h2><p className="lead">Sign in to manage your certificate registry.</p>
      <form className="form" onSubmit={handleSubmit}>
        <Field label="Work email"><input className="input" type="email" placeholder="you@institution.edu" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <PasswordField label="Password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="form-inline-link"><Link to="/forgot-password">Forgot password?</Link></div>
        {error && <Alert>{error}</Alert>}
        <Button className="button-block" type="submit" loading={loading}>{loading ? "Signing in" : "Sign in"}</Button>
      </form>
      <p className="muted small">Don't have an account? <Link to="/signup">Register</Link></p>
    </div></main>
  </div>;
}
