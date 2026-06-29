"use client";

import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

function nextUrl() {
  return new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
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
      <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
        <p className="muted" data-test-id="login-checking">Checking session…</p>
      </main>
    );
  }

  return (
    <main className="auth">
      <aside className="auth__aside">
        <div className="brand reveal">
          <span className="mark" aria-hidden />
          <span><span className="b1">broadcast</span><span className="b2">console</span></span>
        </div>
        <div>
          <p className="auth__pitch reveal d1">Reach every customer on <em>WhatsApp</em> — and watch each message land.</p>
          <div className="auth__points reveal d2">
            <span>Send Meta-approved templates to whole contact lists</span>
            <span>Track sent, delivered, read &amp; failed in real time</span>
            <span>Opt-outs honored automatically — every send</span>
          </div>
        </div>
        <p className="muted reveal d3" style={{ fontSize: 13 }}>NazzilVideo · WhatsApp Cloud API</p>
      </aside>

      <section className="auth__panel">
        <div className="auth__top"><ThemeToggle /></div>
        <form onSubmit={onSubmit} className="auth__form reveal">
          <h1>Welcome back</h1>
          <p className="sub">Sign in to your broadcast console.</p>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" data-test-id="login-email" className="input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <input id="password" data-test-id="login-password" className="input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <p data-test-id="login-error" className="error-text">{error}</p>}
          <button data-test-id="login-submit" className="btn" type="submit" disabled={loading}
            aria-busy={loading} style={{ width: "100%", marginTop: 6 }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
