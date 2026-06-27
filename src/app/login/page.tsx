"use client";

import { useEffect, useState } from "react";

function nextUrl() {
  return new URLSearchParams(window.location.search).get("next") ?? "/";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (!cancelled && res.ok) {
          window.location.replace(nextUrl());
          return;
        }
      } catch {
        /* show form */
      }
      if (!cancelled) setChecking(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Login failed");
        return;
      }
      window.location.href = nextUrl();
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <p className="muted" data-test-id="login-checking">Checking session…</p>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 20 }}>
      <form onSubmit={onSubmit} className="card" style={{ width: 340 }}>
        <div className="brand" style={{ marginBottom: 18 }}>
          <span className="mark" aria-hidden />
          <span><span className="b1">broadcast</span><span className="b2">console</span></span>
        </div>
        <div className="field">
          <label className="label">Email</label>
          <input data-test-id="login-email" className="input" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </div>
        <div className="field">
          <label className="label">Password</label>
          <input data-test-id="login-password" className="input" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        {error && <p data-test-id="login-error" className="error-text">{error}</p>}
        <button data-test-id="login-submit" className="btn" type="submit" disabled={loading} aria-busy={loading} style={{ width: "100%" }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
