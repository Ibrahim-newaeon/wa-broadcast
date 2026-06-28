"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface Client { id: string; name: string; slug: string | null; contacts: number; users: number }

/** SUPERADMIN-only tenant management. Hidden (renders null) for everyone else. */
export default function ClientsManager() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [active, setActive] = useState("");
  const [allowed, setAllowed] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const r = await apiFetch("/api/clients");
    if (r.status === 403) { setAllowed(false); return; }
    const j = await r.json().catch(() => null);
    if (j) { setClients(j.clients); setActive(j.activeClientId); }
  }
  useEffect(() => { refresh(); }, []);

  if (!allowed || !clients) return null;

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await apiFetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug: slug || undefined }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setName(""); setSlug(""); setMsg(`Created “${j.client.name}”.`); refresh(); }
    else setMsg(j.error ?? "Could not create client");
  }

  async function switchTo(clientId: string) {
    const res = await apiFetch("/api/clients/switch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    if (res.ok) window.location.reload();
  }

  async function remove(c: Client) {
    if (!window.confirm(`Permanently delete “${c.name}” and ALL of its contacts, lists, templates, and broadcasts? This cannot be undone.`)) return;
    const res = await apiFetch(`/api/clients/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      // Deleting the active client clears the acting cookie server-side → reload.
      if (c.id === active) window.location.reload();
      else { setMsg(`Deleted “${c.name}”.`); refresh(); }
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "Could not delete client");
    }
  }

  return (
    <section className="card">
      <h3>Clients <span className="muted" style={{ fontWeight: 400 }}>· super-admin</span></h3>
      <p className="note" style={{ marginBottom: 14 }}>
        Each client is an isolated tenant with its own contacts, templates, broadcasts, and WhatsApp connection.
        Switch into a client to manage its data, connect its number, and invite its team.
      </p>

      <table className="table" style={{ marginBottom: 16 }}>
        <thead>
          <tr><th>Client</th><th>Contacts</th><th>Team</th><th></th></tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td>
                {c.name}
                {c.slug && <span className="muted"> · {c.slug}</span>}
                {c.id === active && <span className="badge badge--READ" style={{ marginInlineStart: 8 }}>active</span>}
              </td>
              <td>{c.contacts}</td>
              <td>{c.users}</td>
              <td style={{ textAlign: "end", whiteSpace: "nowrap" }}>
                {c.id !== active && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => switchTo(c.id)}>Switch to</button>
                )}
                {c.id !== "default" && (
                  <button type="button" className="btn btn--danger btn--sm" style={{ marginInlineStart: 8 }} onClick={() => remove(c)}>Delete</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={onCreate} className="grid-forms" style={{ gridTemplateColumns: "1fr 1fr auto", alignItems: "end", gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="cl-name">New client name</label>
          <input id="cl-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Cafe" required />
        </div>
        <div className="field">
          <label className="label" htmlFor="cl-slug">Slug <span className="muted">(optional)</span></label>
          <input id="cl-slug" className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-cafe" />
        </div>
        <button className="btn" type="submit" disabled={busy || !name.trim()} aria-busy={busy}>
          {busy ? "Creating…" : "Create client"}
        </button>
      </form>
      {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  );
}
