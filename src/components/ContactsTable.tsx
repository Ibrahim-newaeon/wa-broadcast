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

  // Multi-select + inline edit state.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editErr, setEditErr] = useState<string | null>(null);

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
    if (mode === "replace") setSelected(new Set()); // selection doesn't survive a new query
  }, [query, optFilter]);

  // Debounced reload on search/filter change.
  useEffect(() => {
    const t = setTimeout(() => { offsetRef.current = 0; void load("replace"); }, 250);
    return () => clearTimeout(t);
  }, [load]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const allSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(contacts.map((c) => c.id)));
  }

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
      setSelected((prev) => { const n = new Set(prev); n.delete(c.id); return n; });
      setTotal((t) => Math.max(0, t - 1));
    }
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected contact(s)? This cannot be undone.`)) return;
    const res = await apiFetch("/api/contacts/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return;
    const j = await res.json();
    // Reload to reflect exactly what was deleted (some may be skipped if they
    // have broadcast history).
    setSelected(new Set());
    offsetRef.current = 0;
    await load("replace");
    if (j.skipped > 0) alert(`Deleted ${j.deleted}. Skipped ${j.skipped} (have broadcast history).`);
  }

  function startEdit(c: Contact) {
    setEditingId(c.id);
    setEditName(c.name ?? "");
    setEditPhone(c.phone);
    setEditErr(null);
  }
  function cancelEdit() { setEditingId(null); setEditErr(null); }

  async function saveEdit(c: Contact) {
    setEditErr(null);
    const res = await apiFetch(`/api/contacts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), phone: editPhone.trim() }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setEditErr(j.error ?? `Error ${res.status}`); return; }
    setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: j.contact.name, phone: j.contact.phone } : x)));
    setEditingId(null);
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
        {selected.size > 0 && (
          <button data-test-id="bulk-delete" className="btn btn--danger btn--sm" onClick={bulkDelete}>
            Delete selected ({selected.size})
          </button>
        )}
        <span className="note">{total} contact(s)</span>
      </div>

      <table data-test-id="contacts-table" className="table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input type="checkbox" aria-label="Select all" data-test-id="select-all"
                checked={allSelected} onChange={toggleSelectAll} />
            </th>
            <th>Phone</th><th>Name</th><th>Status</th><th style={{ textAlign: "end" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => {
            const editing = editingId === c.id;
            return (
              <tr key={c.id} className={selected.has(c.id) ? "is-selected" : undefined}>
                <td>
                  <input type="checkbox" aria-label={`Select ${c.phone}`} data-test-id="row-select"
                    checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                </td>
                <td>
                  {editing
                    ? <input className="input input--sm" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    : c.phone}
                </td>
                <td>
                  {editing
                    ? <input className="input input--sm" value={editName} placeholder="Name"
                        onChange={(e) => setEditName(e.target.value)} />
                    : (c.name ?? "—")}
                  {editing && editErr && <div className="error-text">{editErr}</div>}
                </td>
                <td>
                  <span className={`badge badge--${c.optedOut ? "FAILED" : "READ"}`}>
                    {c.optedOut ? "OPTED OUT" : "ACTIVE"}
                  </span>
                </td>
                <td style={{ textAlign: "end" }}>
                  {editing ? (
                    <>
                      <button className="btn btn--sm" data-test-id="edit-save" onClick={() => saveEdit(c)}>Save</button>{" "}
                      <button className="btn btn--ghost btn--sm" onClick={cancelEdit}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn--ghost btn--sm" data-test-id="edit-contact" onClick={() => startEdit(c)}>Edit</button>{" "}
                      <button className="btn btn--ghost btn--sm" onClick={() => toggleOptOut(c)}>
                        {c.optedOut ? "Re-subscribe" : "Opt out"}
                      </button>{" "}
                      <button className="btn btn--danger btn--sm" onClick={() => remove(c)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {contacts.length === 0 && !busy && (
            <tr><td colSpan={5} className="muted" style={{ padding: 16 }}>No contacts found.</td></tr>
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
