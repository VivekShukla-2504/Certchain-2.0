import React from "react";

export const ThemeContext = React.createContext({ theme: "light", setTheme: () => {} });

export function ThemeToggle() {
  const { theme, setTheme } = React.useContext(ThemeContext);
  const dark = theme === "dark";
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      <span aria-hidden="true">{dark ? "☼" : "☾"}</span>
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

export function Button({ children, variant = "primary", loading = false, className = "", ...props }) {
  return (
    <button className={`button button-${variant} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function PasswordField({ label, value, onChange, placeholder, hint, required = false }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="password-input-wrap">
        <input
          className="input"
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
        />
        <button
          className="password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </Field>
  );
}

export function Alert({ type = "error", children }) {
  return <div className={`alert alert-${type}`} role={type === "error" ? "alert" : "status"}>{children}</div>;
}

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">C</span>
      <span className="brand-lockup">
        <strong>CertChain</strong>
        <small>Academic credential registry</small>
      </span>
    </span>
  );
}

export function StatCard({ label, value, detail, tone = "blue" }) {
  return (
    <div className={`card stat-card stat-${tone}`} style={{ padding: "1.25rem" }}>
      <div className="stat-label" style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
        {label}
      </div>
      <div className="stat-value" style={{ fontSize: "2rem", fontWeight: 800, margin: "0.35rem 0" }}>
        {value}
      </div>
      {detail && (
        <div className="stat-detail muted small" style={{ fontSize: "0.8rem" }}>
          {detail}
        </div>
      )}
    </div>
  );
}
