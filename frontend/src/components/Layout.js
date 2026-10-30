import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Brand, Button, ThemeToggle } from "./UI";
import { getConnectedWallet, connectMetaMaskWallet } from "../utils/web3";

const CONTRACT_ADDRESS = "0x8a16Eb15A598DA4ed2E7211FEE12b37407907d90";

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const institution = getInstitution();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

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
    <header className="topbar public-topbar">
      <div className="topbar-brand-area">
        <Link to="/" className="brand-link"><Brand /></Link>
        <span
          className="network-pill-desktop"
          title="Connected to Ethereum Sepolia Testnet"
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          Sepolia (11155111)
        </span>
        <a
          href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
          className="network-pill-desktop"
          style={{ textDecoration: "none", fontFamily: "monospace", color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0" }}
          title="CertificateRegistry Contract Address on Sepolia"
        >
          Contract: {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)} ↗
        </a>
      </div>

      {/* Desktop Navigation */}
      <nav className="nav-links desktop-nav-links" aria-label="Primary navigation">
        <NavLink className={({ isActive }) => isActive ? "active" : ""} to="/student" style={{ fontWeight: 600 }}>
          🎓 Student Portal
        </NavLink>
        <NavLink className={({ isActive }) => isActive ? "active" : ""} to="/verify" style={{ fontWeight: 600 }}>
          💼 Employer Verify
        </NavLink>
        <NavLink className={({ isActive }) => isActive ? "active" : ""} to="/keys" style={{ fontWeight: 600 }}>
          ⛓️ Sepolia Keys
        </NavLink>
        {institution ? (
          <Link to="/dashboard" className="button button-secondary topbar-signin" style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}>
            🏛️ Dashboard ({institution.name?.slice(0, 10)}...)
          </Link>
        ) : (
          <Link to="/login" className="button button-secondary topbar-signin" style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}>
            🏛️ Institution Portal
          </Link>
        )}

        {walletAddress ? (
          <span
            className="wallet-pill"
            title={`Connected MetaMask Account: ${walletAddress}`}
          >
            🦊 {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </span>
        ) : (
          <button
            type="button"
            className="wallet-connect-btn"
            onClick={handleConnect}
          >
            🦊 Connect Wallet
          </button>
        )}

        <ThemeToggle />
      </nav>

      {/* Mobile Controls: Theme + Hamburger */}
      <div className="mobile-header-actions">
        <ThemeToggle />
        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
        >
          {mobileNavOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Nav Drawer Dropdown */}
      {mobileNavOpen && (
        <div className="mobile-nav-drawer">
          <div className="mobile-nav-status">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 700, color: "#1e40af" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              Ethereum Sepolia (Chain 11155111)
            </span>
            <a
              href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}
            >
              Contract: {CONTRACT_ADDRESS.slice(0, 8)}...{CONTRACT_ADDRESS.slice(-6)} ↗
            </a>
          </div>

          <div className="mobile-nav-links">
            <NavLink to="/student" className={({ isActive }) => `mobile-nav-item${isActive ? " active" : ""}`}>
              🎓 Student Credential Vault
            </NavLink>
            <NavLink to="/verify" className={({ isActive }) => `mobile-nav-item${isActive ? " active" : ""}`}>
              💼 Employer Verification Portal
            </NavLink>
            <NavLink to="/keys" className={({ isActive }) => `mobile-nav-item${isActive ? " active" : ""}`}>
              ⛓️ Sepolia Keys & Contract Details
            </NavLink>
            {institution ? (
              <Link to="/dashboard" className="mobile-nav-item">
                🏛️ Institution Dashboard ({institution.name})
              </Link>
            ) : (
              <Link to="/login" className="mobile-nav-item">
                🏛️ Institution Portal (Sign In / Register)
              </Link>
            )}
          </div>

          <div className="mobile-nav-footer">
            {walletAddress ? (
              <div className="wallet-pill full-width" style={{ padding: "8px 12px" }}>
                🦊 {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)} (Connected)
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary full-width"
                onClick={handleConnect}
                style={{ padding: "10px" }}
              >
                🦊 Connect MetaMask Wallet
              </button>
            )}
          </div>
        </div>
      )}
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
          <span className="side-nav-label">Institution Workspace</span>
          <NavItem to="/dashboard" label="Overview & Requests" icon="▦" />
          {canIssue && <NavItem to="/issue" label="Issue Certificate" icon="＋" />}
          <NavItem to="/certificates" label="Issued Certificates" icon="▤" />
          <NavItem to="/keys" label="Sepolia Keys & Identity" icon="⛓️" />
          <NavItem to="/verify" label="Employer Verify View" icon="💼" />
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
              Sepolia (11155111)
            </span>
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
