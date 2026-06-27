"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface Contact { id: string; phone: string; name: string | null; optedOut: boolean }
const PAGE = 50;

export default function ContactsTable() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [optFilter, setOptFilter] = useState<"all" | "true" | "false">("all");
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const offsetRef = useRef(0);

  const load = useCallback(async (mode: "replace" | "append") => {
    setBusy(true);
    const offset = mode === "append" ? offsetRef.current : 0;
    const q = new URLSearchParams({ offset: String(offset), limit: String(PAGE) });
    if (query.trim()) q.set("query", query.trim());
    if (optFilter !== "all") q.set("optedOut", optFilter);
    const res = await apiFetch(`/api/contacts?${q}`);
    setBusy(false);
    if (!res.ok) return;
    const json = await res.json();
    offsetRef.current = offset + json.contacts.length;
    setTotal(json.page.total);
    setContacts((prev) => (mode === "append" ? [...prev, ...json.contacts] : json.contacts));
  }, [query, optFilter]);

  // Debounced reload on search/filter change.
  useEffect(() => {
    const t = setTimeout(() => { offsetRef.current = 0; void load("replace"); }, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function toggleOptOut(c: Contact) {
    const res = await apiFetch(`/api/contacts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optedOut: !c.optedOut }),
    });
    if (res.ok) setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, optedOut: !x.optedOut } : x)));
  }

  async function remove(c: Contact) {
    if (!confirm(`Delete ${c.phone}? This cannot be undone.`)) return;
    const res = await apiFetch(`/api/contacts/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setContacts((prev) => prev.filter((x) => x.id !== c.id));
      setTotal((t) => Math.max(0, t - 1));
    }
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <input
          data-test-id="contacts-search" className="input" style={{ maxWidth: 320 }}
          placeholder="Search phone or name…" value={query} onChange={(e) => setQuery(e.target.value)}
        />
        {(["all", "false", "true"] as const).map((f) => (
          <button key={f} className={`pill ${optFilter === f ? "is-active" : ""}`} onClick={() => setOptFilter(f)}>
            {f === "all" ? "All" : f === "false" ? "Active" : "Opted out"}
          </button>
        ))}
        <span className="spacer" />
        <span className="note">{total} contact(s)</span>
      </div>

      <table data-test-id="contacts-table" className="table">
        <thead><tr><th>Phone</th><th>Name</th><th>Status</th><th style={{ textAlign: "end" }}>Actions</th></tr></thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id}>
              <td>{c.phone}</td>
              <td>{c.name ?? "—"}</td>
              <td>
                <span className={`badge badge--${c.optedOut ? "FAILED" : "READ"}`}>
                  {c.optedOut ? "OPTED OUT" : "ACTIVE"}
                </span>
              </td>
              <td style={{ textAlign: "end" }}>
                <button className="btn btn--ghost btn--sm" onClick={() => toggleOptOut(c)}>
                  {c.optedOut ? "Re-subscribe" : "Opt out"}
                </button>{" "}
                <button className="btn btn--danger btn--sm" onClick={() => remove(c)}>Delete</button>
              </td>
            </tr>
          ))}
          {contacts.length === 0 && !busy && (
            <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>No contacts found.</td></tr>
          )}
        </tbody>
      </table>

      {contacts.length < total && (
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 12 }} onClick={() => load("append")}>
          Load more ({contacts.length}/{total})
        </button>
      )}
    </div>
  );
}
