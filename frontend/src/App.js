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

function getActiveRole() {
  const token = localStorage.getItem("certchain_token");
  const role = localStorage.getItem("certchain_role");
  const inst = localStorage.getItem("certchain_institution");
  const student = localStorage.getItem("certchain_student");
  const empWallet = localStorage.getItem("certchain_employer_wallet");

  if (token && (role === "institution" || role === "admin" || role === "issuer" || (inst && role !== "employer" && role !== "student"))) {
    return "institute";
  }
  if (role === "employer" || (empWallet && role !== "student" && role !== "institution")) {
    return "employer";
  }
  if (role === "student" || (student && role !== "employer" && role !== "institution")) {
    return "student";
  }
  return "guest";
}

function InstitutionRoute({ children }) {
  const role = getActiveRole();
  if (role === "institute") return children;
  if (role === "employer") return <Navigate to="/verify" replace />;
  if (role === "student") return <Navigate to="/student" replace />;
  return <Navigate to="/login" replace />;
}

function EmployerRoute({ children }) {
  const role = getActiveRole();
  if (role === "institute") return <Navigate to="/dashboard" replace />;
  if (role === "student") return <Navigate to="/student" replace />;
  return children;
}

function StudentRoute({ children }) {
  const role = getActiveRole();
  if (role === "institute") return <Navigate to="/dashboard" replace />;
  if (role === "employer") return <Navigate to="/verify" replace />;
  return children;
}

function PublicAuthRoute({ children }) {
  const role = getActiveRole();
  if (role === "institute") return <Navigate to="/dashboard" replace />;
  if (role === "employer") return <Navigate to="/verify" replace />;
  if (role === "student") return <Navigate to="/student" replace />;
  return children;
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
            {/* Landing */}
            <Route path="/" element={<><PublicHeader /><Home /></>} />

            {/* Public Auth / Onboarding (Redirects to active workspace if already authenticated) */}
            <Route path="/login" element={<PublicAuthRoute><PublicHeader /><Login /></PublicAuthRoute>} />
            <Route path="/signup" element={<PublicAuthRoute><PublicHeader /><Signup /></PublicAuthRoute>} />
            <Route path="/forgot-password" element={<PublicAuthRoute><PublicHeader /><ForgotPassword /></PublicAuthRoute>} />

            {/* Stakeholder 2: Employer Verification */}
            <Route path="/verify" element={<EmployerRoute><PublicHeader /><Verify /></EmployerRoute>} />
            <Route path="/verify/:certificateId" element={<EmployerRoute><PublicHeader /><Verify /></EmployerRoute>} />
            <Route path="/employer" element={<EmployerRoute><PublicHeader /><Verify /></EmployerRoute>} />

            {/* Stakeholder 3: Student Credential Vault */}
            <Route path="/student" element={<StudentRoute><PublicHeader /><StudentPortal /></StudentRoute>} />

            {/* Keys route removed - redirect to home */}
            <Route path="/keys" element={<Navigate to="/" replace />} />

            {/* Stakeholder 1: Institution Workspace */}
            <Route
              path="/dashboard"
              element={
                <InstitutionRoute>
                  <AuthenticatedLayout><Dashboard /></AuthenticatedLayout>
                </InstitutionRoute>
              }
            />
            <Route
              path="/issue"
              element={
                <InstitutionRoute>
                  <AuthenticatedLayout><Issue /></AuthenticatedLayout>
                </InstitutionRoute>
              }
            />
            <Route
              path="/certificates"
              element={
                <InstitutionRoute>
                  <AuthenticatedLayout><Certificates /></AuthenticatedLayout>
                </InstitutionRoute>
              }
            />
            <Route
              path="/certificates/:certId"
              element={
                <InstitutionRoute>
                  <AuthenticatedLayout><CertificateDetails /></AuthenticatedLayout>
                </InstitutionRoute>
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
