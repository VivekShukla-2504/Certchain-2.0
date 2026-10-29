import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Brand, Button, ThemeToggle } from "./UI";
import { getConnectedWallet, connectMetaMaskWallet } from "../utils/web3";

const CONTRACT_ADDRESS = "0xCCCa30A14ff8189EC5d4f677C3b6dbd4Eb21A04D";

function getInstitution() {
  try {
    return JSON.parse(localStorage.getItem("certchain_institution") || "null");
  } catch {
    return null;
  }
}

function NavItem({ to, label, icon }) {
  return (
    <NavLink to={to} className={({ isActive }) => `side-nav-item${isActive ? " active" : ""}`}>
      <span className="nav-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export function PublicHeader() {
  const location = useLocation();
  const [walletAddress, setWalletAddress] = useState("");
  const institution = getInstitution();

  useEffect(() => {
    let active = true;
    getConnectedWallet().then((addr) => {
      if (active && addr) setWalletAddress(addr);
    });

    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (active) setWalletAddress(accounts[0] || "");
      };
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      return () => {
        active = false;
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        }
      };
    }
  }, []);

  async function handleConnect() {
    try {
      const addr = await connectMetaMaskWallet();
      setWalletAddress(addr);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <header className="topbar public-topbar" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "1rem", padding: "0.75rem 2vw" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link to="/" className="brand-link"><Brand /></Link>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "2px 8px",
            borderRadius: "9999px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            fontSize: "0.75rem",
            fontWeight: 600
          }}
          title="Connected to Ethereum Sepolia Testnet"
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
          Sepolia (11155111)
        </span>
        <a
          href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: "0.75rem", color: "#64748b", textDecoration: "none", fontFamily: "monospace" }}
          title="Inspect CertificateRegistry Smart Contract on Etherscan"
        >
          Contract: {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)} ↗
        </a>
      </div>

      <nav className="nav-links" aria-label="Primary navigation" style={{ display: "flex", alignItems: "center", gap: "1rem", marginLeft: "auto", flexWrap: "wrap" }}>
        <NavLink className={({ isActive }) => isActive ? "active" : ""} to="/student" style={{ fontWeight: 600 }}>
          🎓 Student Portal
        </NavLink>
        <NavLink className={({ isActive }) => isActive ? "active" : ""} to="/verify" style={{ fontWeight: 600 }}>
          💼 Employer Verify
        </NavLink>
        {institution ? (
          <Link to="/dashboard" className="button button-secondary topbar-signin" style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}>
            🏛️ Dashboard ({institution.name?.slice(0, 12)}...)
          </Link>
        ) : (
          <Link to="/login" className="button button-secondary topbar-signin" style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}>
            🏛️ Institution Portal
          </Link>
        )}

        {walletAddress ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              borderRadius: "9999px",
              background: "#ecfdf5",
              border: "1px solid #86efac",
              color: "#166534",
              fontSize: "0.8rem",
              fontFamily: "monospace",
              fontWeight: 600
            }}
            title={`Connected MetaMask Account: ${walletAddress}`}
          >
            🦊 {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              borderRadius: "9999px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#334155",
              fontSize: "0.8rem",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            🦊 Connect Wallet
          </button>
        )}

        <ThemeToggle />
      </nav>
      <span className="mobile-current" aria-label="Current page">{location.pathname === "/verify" ? "Verification" : "CertChain"}</span>
    </header>
  );
}

export function AppSidebar({ mobileOpen, onClose }) {
  const institution = getInstitution();
  const role = institution?.role || "admin";
  const canIssue = role === "admin" || role === "issuer";
  const initials = (institution?.name || "Institution").slice(0, 1).toUpperCase();
  return (
    <>
      {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`app-sidebar${mobileOpen ? " open" : ""}`} aria-label="Institution navigation">
        <div className="sidebar-top">
          <Link to="/dashboard" className="sidebar-brand" onClick={onClose}><Brand /></Link>
          <button className="sidebar-close" onClick={onClose} aria-label="Close navigation">×</button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">{initials}</span>
          <span className="workspace-copy"><strong>{institution?.name || "Institution"}</strong><small>Certificate workspace</small></span>
          <span className="workspace-chevron" aria-hidden="true">⌄</span>
        </div>
        <nav className="side-nav" aria-label="Workspace navigation">
          <span className="side-nav-label">Workspace</span>
          <NavItem to="/dashboard" label="Overview" icon="▦" />
          <NavItem to="/students" label="Students" icon="♙" />
          <NavItem to="/certificates" label="Certificates" icon="▤" />
          {role === "admin" && <NavItem to="/settings" label="Privacy settings" icon="⚙" />}
          <NavItem to="/audit" label="Audit history" icon="≡" />
          {canIssue && <NavItem to="/issue" label="Issue certificate" icon="＋" />}
          <NavItem to="/verify" label="Verify certificate" icon="⌕" />
        </nav>
        <div className="sidebar-footer">
          <div className="chain-status"><span className="status-dot" /> Sepolia Connected</div>
          <div className="sidebar-profile"><span className="profile-avatar">{initials}</span><span><strong>{institution?.name || "Institution admin"}</strong><small>{institution?.institutionId || "Account"}</small></span></div>
          <button className="sidebar-logout" onClick={() => { localStorage.removeItem("certchain_token"); localStorage.removeItem("certchain_institution"); window.location.href = "/verify"; }}>Sign out</button>
        </div>
      </aside>
    </>
  );
}

export function AuthenticatedLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const pageTitle = location.pathname.startsWith("/issue") ? "Issue certificate" : location.pathname.startsWith("/dashboard") ? "Dashboard" : location.pathname.startsWith("/students") ? "Students" : location.pathname.startsWith("/settings") ? "Privacy settings" : location.pathname.startsWith("/audit") ? "Audit history" : location.pathname.startsWith("/certificates") ? "Certificates" : "Verify certificate";
  return (
    <div className="workspace-layout">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="workspace-main">
        <header className="workspace-header">
          <button className="mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button>
          <div className="breadcrumbs"><Link to="/dashboard">Workspace</Link><span>/</span><strong>{pageTitle}</strong></div>
          <div className="workspace-header-actions">
            <span className="header-network" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span className="status-dot" style={{ background: "#22c55e" }} />
              Ethereum Sepolia (11155111)
            </span>
            <a
              href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "0.8rem", color: "var(--cc-blue)", textDecoration: "underline", fontFamily: "monospace" }}
            >
              Contract ↗
            </a>
            <ThemeToggle />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export function SignOutButton() {
  return <Button variant="quiet" onClick={() => { localStorage.removeItem("certchain_token"); localStorage.removeItem("certchain_institution"); window.location.href = "/verify"; }}>Sign out</Button>;
}
