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
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ client: string; email: string; password: string; generated: boolean } | null>(null);

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
    setBusy(true); setMsg(null); setCreds(null);
    const res = await apiFetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug: slug || undefined,
        adminEmail: adminEmail.trim() || undefined,
        adminPassword: adminPassword || undefined,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      if (j.admin) setCreds({ client: j.client.name, email: j.admin.email, password: j.admin.password, generated: j.admin.generated });
      else setMsg(`Created “${j.client.name}”.`);
      setName(""); setSlug(""); setAdminEmail(""); setAdminPassword("");
      refresh();
    } else setMsg(j.error ?? "Could not create client");
  }

  function copyCreds() {
    if (!creds) return;
    navigator.clipboard?.writeText(`Login: ${window.location.origin}/login\nEmail: ${creds.email}\nPassword: ${creds.password}`).catch(() => {});
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

      <form onSubmit={onCreate} className="grid-forms" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "end", gap: 12 }}>
        <div className="field">
          <label className="label" htmlFor="cl-name">New client name</label>
          <input id="cl-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Cafe" required />
        </div>
        <div className="field">
          <label className="label" htmlFor="cl-slug">Slug <span className="muted">(optional)</span></label>
          <input id="cl-slug" className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-cafe" />
        </div>
        <div className="field">
          <label className="label" htmlFor="cl-email">Admin login email <span className="muted">(optional — creates the client&rsquo;s ADMIN account)</span></label>
          <input id="cl-email" className="input" type="email" autoComplete="off" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="owner@acme.com" />
        </div>
        <div className="field">
          <label className="label" htmlFor="cl-pass">Admin password <span className="muted">(leave blank to auto-generate)</span></label>
          <input id="cl-pass" className="input" autoComplete="new-password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="auto-generated if blank" />
        </div>
        <button className="btn" type="submit" disabled={busy || !name.trim()} aria-busy={busy} style={{ gridColumn: "1 / -1", justifySelf: "start" }}>
          {busy ? "Creating…" : "Create client"}
        </button>
      </form>
      {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}

      {creds && (
        <div className="card" style={{ marginTop: 14, borderColor: "var(--green)" }}>
          <strong>“{creds.client}” created with an ADMIN login.</strong>
          <p className="note" style={{ margin: "6px 0 10px" }}>
            {creds.generated
              ? "Copy these credentials now — the password is shown only once and isn’t stored in plaintext."
              : "Share these credentials with the client so they can sign in and connect their WhatsApp."}
          </p>
          <div style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.7 }}>
            <div>Login URL: {typeof window !== "undefined" ? window.location.origin : ""}/login</div>
            <div>Email: {creds.email}</div>
            <div>Password: {creds.password}</div>
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={copyCreds}>Copy</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCreds(null)}>Dismiss</button>
          </div>
        </div>
      )}
    </section>
  );
}
