import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Brand, Button, ThemeToggle } from "./UI";
import { getConnectedWallet, connectMetaMaskWallet, disconnectWallet } from "../utils/web3";

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
  const student = (() => {
    try {
      return JSON.parse(localStorage.getItem("certchain_student") || "null");
    } catch {
      return null;
    }
  })();
  const role = localStorage.getItem("certchain_role");
  const token = localStorage.getItem("certchain_token");

  // Strictly mutually exclusive role authentication:
  const isEmployerAuth = role === "employer" && !!token;
  const isStudentAuth = role === "student" && !!token;
  const isInstituteAuth = (role === "institution" || role === "admin" || role === "issuer") && !!token && !!institution;
  const isAuthenticated = isInstituteAuth || isStudentAuth || isEmployerAuth;

  function handleLogout() {
    disconnectWallet();
    localStorage.removeItem("certchain_token");
    localStorage.removeItem("certchain_role");
    localStorage.removeItem("certchain_institution");
    localStorage.removeItem("certchain_student");
    localStorage.removeItem("certchain_student_wallet");
    localStorage.removeItem("certchain_employer_wallet");
    localStorage.removeItem("certchain_employer_name");
    localStorage.removeItem("certchain_employer_email");
    window.location.reload();
  }

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
      </div>

      {/* Desktop Navigation */}
      <nav className="nav-links desktop-nav-links" aria-label="Primary navigation">
        {isInstituteAuth ? (
          <NavLink className={({ isActive }) => isActive ? "active" : ""} to="/dashboard" style={{ fontWeight: 600 }}>
            🏛️ Institution Workspace
          </NavLink>
        ) : isEmployerAuth ? (
          <NavLink className={({ isActive }) => isActive ? "active" : ""} to="/verify" style={{ fontWeight: 600 }}>
            💼 Employer Workspace
          </NavLink>
        ) : isStudentAuth ? (
          <NavLink className={({ isActive }) => isActive ? "active" : ""} to="/student" style={{ fontWeight: 600 }}>
            🎓 Student Vault
          </NavLink>
        ) : (
          <>
            <NavLink className={({ isActive }) => isActive ? "active" : ""} to="/student" style={{ fontWeight: 600 }}>
              Student Portal
            </NavLink>
            <NavLink className={({ isActive }) => isActive ? "active" : ""} to="/verify" style={{ fontWeight: 600 }}>
              Employer Verification
            </NavLink>
            <Link to="/login" className="button button-secondary topbar-signin" style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}>
              Institution Portal
            </Link>
          </>
        )}

        {walletAddress ? (
          <span
            className="wallet-pill"
            title={`Connected MetaMask Account: ${walletAddress}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </span>
        ) : (
          <button
            type="button"
            className="wallet-connect-btn"
            onClick={handleConnect}
          >
            Connect Wallet
          </button>
        )}

        {isAuthenticated && (
          <button
            type="button"
            className="button button-secondary"
            onClick={handleLogout}
            style={{
              padding: "0.32rem 0.65rem",
              fontSize: "0.8rem",
              color: "#ef4444",
              borderColor: "rgba(239, 68, 68, 0.4)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4
            }}
            title="Sign out of CertChain"
          >
            Logout ⎋
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
          <div className="mobile-nav-links">
            {isInstituteAuth ? (
              <NavLink to="/dashboard" className="mobile-nav-item" onClick={() => setMobileNavOpen(false)}>
                🏛️ Institution Dashboard ({institution?.name || "Workspace"})
              </NavLink>
            ) : isEmployerAuth ? (
              <NavLink to="/verify" className="mobile-nav-item" style={{ color: "#3b82f6" }} onClick={() => setMobileNavOpen(false)}>
                💼 Employer Portal ({employerWallet ? `${employerWallet.slice(0, 8)}...` : "Workspace"})
              </NavLink>
            ) : isStudentAuth ? (
              <NavLink to="/student" className="mobile-nav-item" style={{ color: "#10b981" }} onClick={() => setMobileNavOpen(false)}>
                🎓 Student Vault ({student?.fullName || "Verified"})
              </NavLink>
            ) : (
              <>
                <NavLink to="/student" className={({ isActive }) => `mobile-nav-item${isActive ? " active" : ""}`} onClick={() => setMobileNavOpen(false)}>
                  Student Credential Vault
                </NavLink>
                <NavLink to="/verify" className={({ isActive }) => `mobile-nav-item${isActive ? " active" : ""}`} onClick={() => setMobileNavOpen(false)}>
                  Employer Verification Portal
                </NavLink>
                <Link to="/login" className="mobile-nav-item" onClick={() => setMobileNavOpen(false)}>
                  Institution Portal (Sign In / Register)
                </Link>
              </>
            )}
          </div>

          <div className="mobile-nav-footer">
            {walletAddress ? (
              <div className="wallet-pill full-width" style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginRight: 6 }} />
                  {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                </span>
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{ background: "transparent", border: "none", color: "#ef4444", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    Logout ⎋
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary full-width"
                onClick={handleConnect}
                style={{ padding: "10px" }}
              >
                Connect MetaMask Wallet
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
        </nav>
        <div className="sidebar-footer">
          <div className="chain-status"><span className="status-dot" /> Connected</div>
          <div className="sidebar-profile"><span className="profile-avatar">{initials}</span><span><strong>{institution?.name || "Institution admin"}</strong><small>{institution?.institutionId || "Account"}</small></span></div>
          <button className="sidebar-logout" onClick={() => {
            disconnectWallet();
            localStorage.removeItem("certchain_token");
            localStorage.removeItem("certchain_role");
            localStorage.removeItem("certchain_institution");
            localStorage.removeItem("certchain_student");
            localStorage.removeItem("certchain_student_wallet");
            localStorage.removeItem("certchain_employer_wallet");
            window.location.href = "/login";
          }}>Sign out</button>
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
            <ThemeToggle />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export function SignOutButton() {
  return (
    <Button
      variant="quiet"
      onClick={() => {
        disconnectWallet();
        localStorage.removeItem("certchain_token");
        localStorage.removeItem("certchain_role");
        localStorage.removeItem("certchain_institution");
        localStorage.removeItem("certchain_student");
        localStorage.removeItem("certchain_student_wallet");
        localStorage.removeItem("certchain_employer_wallet");
        window.location.href = "/login";
      }}
    >
      Sign out
    </Button>
  );
}
