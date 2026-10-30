import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { Alert, Brand, Button, Field, PasswordField } from "../components/UI";
import { connectMetaMaskWallet } from "../utils/web3";

const CONTRACT_ADDRESS = "0xCa70e753D2DFcd32532Fb3f236B66c9494F01330";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
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
      setError(err.response?.data?.message || "Login failed. Check your email or password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMetaMaskLogin() {
    setError("");
    setWalletLoading(true);
    try {
      const address = await connectMetaMaskWallet();
      const res = await api.post("/auth/wallet-login", { walletAddress: address });
      localStorage.setItem("certchain_token", res.data.token);
      localStorage.setItem("certchain_institution", JSON.stringify(res.data.institution));
      navigate(res.data.institution.role === "reviewer" ? "/certificates" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "MetaMask login failed. Make sure your account is registered.");
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
          <p className="lead">Sign in with your Sepolia wallet or email credentials.</p>

          {error && <Alert>{error}</Alert>}

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
              {loading ? "Signing in..." : "Sign in with Email"}
            </Button>
          </form>

          <p className="muted small" style={{ marginTop: "1.25rem" }}>
            Don't have an institution account? <Link to="/signup">Register institution</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
