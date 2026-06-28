"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

export default function NewListForm() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiFetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      window.location.reload();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not create list");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <h3>New list</h3>
      <div className="field">
        <label className="label" htmlFor="ln">List name</label>
        <input id="ln" data-test-id="list-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <button data-test-id="list-submit" className="btn" type="submit" disabled={busy || !name.trim()}>
        {busy ? "Creating…" : "Create list"}
      </button>
      {error && <p className="note" style={{ marginTop: 10, color: "var(--danger)" }}>{error}</p>}
    </form>
  );
}
