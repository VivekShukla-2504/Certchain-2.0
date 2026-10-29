import React, { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Brand, Button, ThemeToggle } from "./UI";

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
  return (
    <header className="topbar public-topbar">
      <Link to="/verify" className="brand-link"><Brand /></Link>
      <nav className="nav-links" aria-label="Primary navigation">
        <NavLink className={({ isActive }) => isActive ? "active" : ""} to="/student">🎓 Student Portal</NavLink>
        <NavLink className={({ isActive }) => isActive ? "active" : ""} to="/verify">💼 Employer Verify</NavLink>
        <Link to="/login" className="button button-secondary topbar-signin">🏛️ Institution Portal</Link>
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
          <div className="chain-status"><span className="status-dot" /> Network connected</div>
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
          <div className="workspace-header-actions"><span className="header-network"><span className="status-dot" /> Ethereum Network</span><ThemeToggle /></div>
        </header>
        {children}
      </main>
    </div>
  );
}

export function SignOutButton() {
  return <Button variant="quiet" onClick={() => { localStorage.removeItem("certchain_token"); localStorage.removeItem("certchain_institution"); window.location.href = "/verify"; }}>Sign out</Button>;
}
