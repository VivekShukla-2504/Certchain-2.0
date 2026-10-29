import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return <main className="page not-found-page"><div className="not-found-card card card-pad"><span className="not-found-code">404</span><span className="eyebrow">Page not found</span><h1>This page does not exist.</h1><p className="lead">The link may be outdated or the address may have been entered incorrectly.</p><div className="not-found-actions"><Link className="button button-primary" to="/">Go to home</Link><Link className="button button-secondary" to="/verify">Verify a certificate</Link></div></div></main>;
}
