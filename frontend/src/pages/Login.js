import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { Alert, Brand, Button, Field, PasswordField } from "../components/UI";
import { authenticateStakeholderWallet } from "../utils/web3";

const CONTRACT_ADDRESS = "0x8a16Eb15A598DA4ed2E7211FEE12b37407907d90";

export default function Login() {
  const [authMethod, setAuthMethod] = useState("password"); // "password" or "otp"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const navigate = useNavigate();

  function switchMethod(method) {
    setAuthMethod(method);
    setError("");
    setOtpMessage("");
    setOtpSent(false);
    setOtp("");
  }

  // Password Login
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
      setError(err.response?.data?.message || "Login failed. Check your email or password.");
    } finally {
      setLoading(false);
    }
  }

  // Step 1: Send OTP for Login (Strictly verifies record in DB first)
  async function handleSendLoginOtp(e) {
    e.preventDefault();
    setError("");
    setOtpMessage("");
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return setError("Enter a valid institutional email address.");
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/send-login-otp", { email: email.trim() });
      setOtpSent(true);
      setOtpMessage(res.data.message || `OTP sent to ${email.trim()}.`);
    } catch (err) {
      setOtpSent(false);
      setError(err.response?.data?.message || "No registered account found with this email.");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify Login OTP and sign in
  async function handleVerifyLoginOtp(e) {
    e.preventDefault();
    setError("");
    if (!otp.trim() || !/^\d{6}$/.test(otp.trim())) {
      return setError("Enter the 6-digit verification code sent to your email.");
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-login-otp", { email: email.trim(), otp: otp.trim() });
      localStorage.setItem("certchain_token", res.data.token);
      localStorage.setItem("certchain_institution", JSON.stringify(res.data.institution));
      navigate(res.data.institution.role === "reviewer" ? "/certificates" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired OTP. Please check and try again.");
    } finally {
      setLoading(false);
    }
  }

  // MetaMask Web3 Login
  async function handleMetaMaskLogin() {
    setError("");
    setWalletLoading(true);
    try {
      const auth = await authenticateStakeholderWallet("institute");
      localStorage.setItem("certchain_token", auth.token);
      localStorage.setItem("certchain_institution", JSON.stringify(auth.institution));
      navigate(auth.institution?.role === "reviewer" ? "/certificates" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "MetaMask Web3 authentication failed.");
    } finally {
      setWalletLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <Brand />
        <div>
          <h1>Trust every credential.</h1>
          <p>
            Issue and verify academic certificates with a permanent, tamper-evident record anchored to Ethereum Sepolia.
          </p>

          <div
            style={{
              marginTop: "2rem",
              padding: "1rem",
              background: "rgba(255,255,255,0.08)",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.15)",
              fontSize: "0.85rem"
            }}
          >
            <strong style={{ color: "#f7f0df", display: "block", marginBottom: "0.5rem" }}>
              ⛓️ Ethereum Sepolia Network
            </strong>
            <div>
              <span style={{ opacity: 0.7, fontSize: "0.75rem", display: "block" }}>Smart Contract Address:</span>
              <a
                href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#d4b06f", fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all" }}
              >
                {CONTRACT_ADDRESS} ↗
              </a>
            </div>
          </div>
        </div>
      </aside>

      <main className="auth-form">
        <div className="auth-form-inner">
          <span className="eyebrow">Institution portal</span>
          <h2>Welcome back</h2>
          <p className="lead">Sign in with your Sepolia wallet, password, or email OTP.</p>

          {error && <Alert>{error}</Alert>}
          {otpMessage && (
            <div
              style={{
                background: "#064e3b",
                border: "1px solid #10b981",
                color: "#d1fae5",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                marginBottom: "1rem",
                fontSize: "0.9rem"
              }}
            >
              ✓ {otpMessage}
            </div>
          )}

          {/* 1-Click MetaMask Web3 Login */}
          <div style={{ marginBottom: "1.5rem" }}>
            <button
              type="button"
              className="button button-block"
              onClick={handleMetaMaskLogin}
              disabled={walletLoading || loading}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                background: "#f97316",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                padding: "0.75rem"
              }}
            >
              🦊 {walletLoading ? "Connecting to Sepolia..." : "Sign In with MetaMask (Sepolia Wallet)"}
            </button>
            <p className="muted small" style={{ textAlign: "center", margin: "0.5rem 0 0" }}>
              1-click sign in for registered institution Web3 wallets
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              margin: "1.5rem 0",
              color: "var(--cc-muted)",
              fontSize: "0.85rem"
            }}
          >
            <hr style={{ flex: 1, border: "0", borderTop: "1px solid var(--cc-line)" }} />
            <span>OR SIGN IN WITH EMAIL</span>
            <hr style={{ flex: 1, border: "0", borderTop: "1px solid var(--cc-line)" }} />
          </div>

          {/* Method Selector Tabs: Password vs Email OTP */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.5rem",
              background: "rgba(255,255,255,0.05)",
              padding: "4px",
              borderRadius: "8px",
              marginBottom: "1.25rem"
            }}
          >
            <button
              type="button"
              onClick={() => switchMethod("password")}
              style={{
                padding: "0.5rem",
                borderRadius: "6px",
                border: "none",
                background: authMethod === "password" ? "var(--cc-accent, #2563eb)" : "transparent",
                color: "#ffffff",
                fontWeight: authMethod === "password" ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.85rem"
              }}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => switchMethod("otp")}
              style={{
                padding: "0.5rem",
                borderRadius: "6px",
                border: "none",
                background: authMethod === "otp" ? "var(--cc-accent, #2563eb)" : "transparent",
                color: "#ffffff",
                fontWeight: authMethod === "otp" ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.85rem"
              }}
            >
              Login with OTP
            </button>
          </div>

          {/* Option A: Password Login Form */}
          {authMethod === "password" && (
            <form className="form" onSubmit={handleSubmit}>
              <Field label="Work email">
                <input
                  className="input"
                  type="email"
                  placeholder="you@institution.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <PasswordField
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <div className="form-inline-link">
                <Link to="/forgot-password">Forgot password?</Link>
              </div>

              <Button className="button-block" type="submit" loading={loading}>
                {loading ? "Signing in..." : "Sign in with Password"}
              </Button>
            </form>
          )}

          {/* Option B: Email OTP Login Form */}
          {authMethod === "otp" && (
            <div>
              {!otpSent ? (
                <form className="form" onSubmit={handleSendLoginOtp}>
                  <Field label="Registered Work email">
                    <input
                      className="input"
                      type="email"
                      placeholder="you@institution.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Field>
                  <p className="muted small" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
                    We will send a 6-digit one-time code to your email if your institution is registered.
                  </p>
                  <Button className="button-block" type="submit" loading={loading}>
                    {loading ? "Checking records & sending..." : "Send Login OTP"}
                  </Button>
                </form>
              ) : (
                <form className="form" onSubmit={handleVerifyLoginOtp}>
                  <Field label={`Enter 6-digit code sent to ${email}`}>
                    <input
                      className="input"
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      style={{
                        letterSpacing: "0.3em",
                        fontSize: "1.25rem",
                        textAlign: "center",
                        fontWeight: 700
                      }}
                      required
                    />
                  </Field>

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                    <Button className="button-block" type="submit" loading={loading}>
                      {loading ? "Verifying..." : "Verify & Sign In"}
                    </Button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setOtpSent(false)}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      Change Email
                    </button>
                  </div>

                  <p className="muted small" style={{ textAlign: "center", marginTop: "0.75rem" }}>
                    Didn't receive code?{" "}
                    <button
                      type="button"
                      onClick={handleSendLoginOtp}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--cc-accent, #60a5fa)",
                        cursor: "pointer",
                        textDecoration: "underline"
                      }}
                    >
                      Resend OTP
                    </button>
                  </p>
                </form>
              )}
            </div>
          )}

          <p className="muted small" style={{ marginTop: "1.25rem" }}>
            Don't have an institution account? <Link to="/signup">Register institution</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
