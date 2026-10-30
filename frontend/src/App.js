import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Issue from "./pages/Issue";
import Verify from "./pages/Verify";
import StudentPortal from "./pages/StudentPortal";
import KeyGenerator from "./pages/KeyGenerator";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Certificates from "./pages/Certificates";
import CertificateDetails from "./pages/CertificateDetails";
import NotFound from "./pages/NotFound";
import { AuthenticatedLayout, PublicHeader } from "./components/Layout";
import { ThemeContext } from "./components/UI";

function isLoggedIn() {
  return !!localStorage.getItem("certchain_token");
}

function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

function VerifyRoute() {
  return isLoggedIn() ? <AuthenticatedLayout><Verify /></AuthenticatedLayout> : <><PublicHeader /><Verify /></>;
}

function PublicCertificateRoute() {
  return <><PublicHeader /><Verify /></>;
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("certchain_theme") || "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("certchain_theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="app-shell">
          <Routes>
            {/* Landing & Public Navigation */}
            <Route path="/" element={<><PublicHeader /><Home /></>} />
            <Route path="/login" element={<><PublicHeader /><Login /></>} />
            <Route path="/signup" element={<><PublicHeader /><Signup /></>} />
            <Route path="/forgot-password" element={<><PublicHeader /><ForgotPassword /></>} />

            {/* Stakeholder 2: Employer Verification */}
            <Route path="/verify" element={<VerifyRoute />} />
            <Route path="/verify/:certificateId" element={<PublicCertificateRoute />} />

            {/* Stakeholder 3: Student Credential Vault */}
            <Route path="/student" element={<><PublicHeader /><StudentPortal /></>} />

            {/* Ethereum Sepolia Cryptographic Keys Explorer */}
            <Route path="/keys" element={<><PublicHeader /><KeyGenerator /></>} />

            {/* Stakeholder 1: Institution Workspace */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <AuthenticatedLayout><Dashboard /></AuthenticatedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/issue"
              element={
                <PrivateRoute>
                  <AuthenticatedLayout><Issue /></AuthenticatedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/certificates"
              element={
                <PrivateRoute>
                  <AuthenticatedLayout><Certificates /></AuthenticatedLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/certificates/:certId"
              element={
                <PrivateRoute>
                  <AuthenticatedLayout><CertificateDetails /></AuthenticatedLayout>
                </PrivateRoute>
              }
            />

            {/* Redirect any legacy routes to dashboard */}
            <Route path="/students" element={<Navigate to="/dashboard" replace />} />
            <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
            <Route path="/audit" element={<Navigate to="/dashboard" replace />} />
            <Route path="/platform-admin" element={<Navigate to="/dashboard" replace />} />

            <Route path="*" element={<><PublicHeader /><NotFound /></>} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}
