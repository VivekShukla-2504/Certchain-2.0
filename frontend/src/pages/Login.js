import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { Alert, Brand, Button, Field, PasswordField } from "../components/UI";
import { authenticateStakeholderWallet, connectMetaMaskWallet } from "../utils/web3";

export default function Login() {
  const [authMethod, setAuthMethod] = useState("password"); // "password" or "wallet"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const navigate = useNavigate();

  function switchMethod(method) {
    setAuthMethod(method);
    setError("");
  }

  // Password Login
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) return setError("Enter your email and password to continue.");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.removeItem("certchain_student");
      localStorage.removeItem("certchain_student_wallet");
      localStorage.removeItem("certchain_employer_wallet");

      localStorage.setItem("certchain_token", res.data.token);
      localStorage.setItem("certchain_role", res.data.institution?.role || "institution");
      localStorage.setItem("certchain_institution", JSON.stringify(res.data.institution));
      navigate(res.data.institution.role === "reviewer" ? "/certificates" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Check your email or password.");
    } finally {
      setLoading(false);
    }
  }

  // Autofill wallet address from connected MetaMask
  async function handleAutofillWallet() {
    setError("");
    try {
      const addr = await connectMetaMaskWallet();
      setWalletAddress(addr);
    } catch (err) {
      setError(err.message);
    }
  }

  // Login with Wallet Address (Direct API lookup by registered Ethereum public address)
  async function handleWalletLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    setError("");
    const cleanWallet = (walletAddress || "").trim();
    if (!cleanWallet) {
      return setError("Enter your registered Ethereum wallet address (0x...).");
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(cleanWallet)) {
      return setError("Invalid Ethereum wallet address format. Address must start with 0x and be 42 characters.");
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/wallet-login", { walletAddress: cleanWallet });
      localStorage.removeItem("certchain_student");
      localStorage.removeItem("certchain_student_wallet");
      localStorage.removeItem("certchain_employer_wallet");

      localStorage.setItem("certchain_token", res.data.token);
      localStorage.setItem("certchain_role", res.data.institution?.role || "institution");
      localStorage.setItem("certchain_institution", JSON.stringify(res.data.institution));
      navigate(res.data.institution.role === "reviewer" ? "/certificates" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Wallet sign-in failed. Ensure this wallet address is registered with an approved institution.");
    } finally {
      setLoading(false);
    }
  }

  // 1-Click MetaMask Web3 Cryptographic Login
  async function handleMetaMaskLogin() {
    setError("");
    setWalletLoading(true);
    try {
      const auth = await authenticateStakeholderWallet("institute");
      localStorage.removeItem("certchain_student");
      localStorage.removeItem("certchain_student_wallet");
      localStorage.removeItem("certchain_employer_wallet");

      localStorage.setItem("certchain_token", auth.token);
      localStorage.setItem("certchain_role", auth.institution?.role || "institution");
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
        </div>
      </aside>

      <main className="auth-form">
        <div className="auth-form-inner">
          <span className="eyebrow">Institution portal</span>
          <h2>Welcome back</h2>
          <p className="lead">Sign in with your password or registered wallet address.</p>

          {error && <Alert>{error}</Alert>}

          {/* Method Selector Tabs: Password vs Wallet Address */}
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
                background: authMethod === "password" ? "var(--cc-blue)" : "transparent",
                color: authMethod === "password" ? "#ffffff" : "var(--cc-ink)",
                fontWeight: authMethod === "password" ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.85rem"
              }}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => switchMethod("wallet")}
              style={{
                padding: "0.5rem",
                borderRadius: "6px",
                border: "none",
                background: authMethod === "wallet" ? "var(--cc-blue)" : "transparent",
                color: authMethod === "wallet" ? "#ffffff" : "var(--cc-ink)",
                fontWeight: authMethod === "wallet" ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.85rem"
              }}
            >
              Login with Wallet Address
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

          {/* Option B: Wallet Address Login Form */}
          {authMethod === "wallet" && (
            <div>
              {/* 1-Click MetaMask Web3 Login */}
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
                  padding: "0.75rem",
                  marginBottom: "1rem"
                }}
              >
                🦊 {walletLoading ? "Connecting to Sepolia..." : "Sign In with MetaMask (1-Click)"}
              </button>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  margin: "1rem 0",
                  color: "var(--cc-muted)",
                  fontSize: "0.8rem"
                }}
              >
                <hr style={{ flex: 1, border: "0", borderTop: "1px solid var(--cc-line)" }} />
                <span>OR ENTER REGISTERED WALLET</span>
                <hr style={{ flex: 1, border: "0", borderTop: "1px solid var(--cc-line)" }} />
              </div>

              <form className="form" onSubmit={handleWalletLogin}>
                <Field label="Registered Ethereum Wallet Address">
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      className="input mono"
                      type="text"
                      placeholder="0x..."
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      style={{ fontSize: "0.85rem", flex: 1 }}
                      required
                    />
                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}
                      onClick={handleAutofillWallet}
                      disabled={walletLoading}
                    >
                      🦊 Autofill
                    </button>
                  </div>
                </Field>
                <p className="muted small" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
                  Sign in using your institution's registered Sepolia public key (42-character 0x... address).
                </p>

                <Button className="button-block" type="submit" loading={loading}>
                  {loading ? "Verifying wallet..." : "Sign In with Wallet Address"}
                </Button>
              </form>
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
