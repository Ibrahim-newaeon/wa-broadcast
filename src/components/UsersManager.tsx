"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { useRole } from "@/lib/useRole";

interface User { id: string; email: string; name: string | null; role: string; createdAt: string }

/** Strong, human-typeable temporary password (no ambiguous characters). */
function generatePassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export default function UsersManager() {
  const { me } = useRole();
  const [users, setUsers] = useState<User[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgError, setMsgError] = useState(false);
  const [busy, setBusy] = useState(false);

  // Row-level state: which user is being edited, and the draft values.
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [resetting, setResetting] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  function say(text: string) { setMsg(text); setMsgError(false); }
  function fail(text: string) { setMsg(text); setMsgError(true); }

  const load = useCallback(async () => {
    const res = await apiFetch("/api/users");
    if (res.status === 403) { setForbidden(true); return; }
    if (res.ok) setUsers((await res.json()).users);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await apiFetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || undefined, password, role }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      say(`Created ${j.user.email}.`);
      setEmail(""); setName(""); setPassword("");
      await load();
    } else fail(j.error ?? `Error ${res.status}`);
  }

  function startEdit(u: User) {
    setResetting(null);
    setEditing(u.id);
    setDraftName(u.name ?? "");
    setDraftRole(u.role === "ADMIN" ? "ADMIN" : "MEMBER");
    setMsg(null);
  }

  function startReset(u: User) {
    setEditing(null);
    setResetting(u.id);
    setNewPassword("");
    setMsg(null);
  }

  async function patch(u: User, body: Record<string, unknown>, done: string) {
    setRowBusy(u.id); setMsg(null);
    const res = await apiFetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    setRowBusy(null);
    if (res.ok) {
      say(done);
      setEditing(null); setResetting(null); setNewPassword("");
      await load();
      return true;
    }
    fail(j.error ?? `Error ${res.status}`);
    return false;
  }

  async function saveEdit(u: User) {
    await patch(u, { name: draftName.trim(), role: draftRole }, `Saved ${u.email}.`);
  }

  async function saveReset(u: User) {
    if (newPassword.length < 8) { fail("Password must be at least 8 characters."); return; }
    const ok = await patch(u, { password: newPassword }, `Password reset for ${u.email} — send it to them, they are signed out everywhere.`);
    if (ok) setNewPassword("");
  }

  async function remove(u: User) {
    if (!confirm(`Remove ${u.email}?\n\nThey lose access immediately. Their audit-log entries are kept.\n\nThis cannot be undone.`)) return;
    setRowBusy(u.id); setMsg(null);
    const res = await apiFetch(`/api/users/${u.id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    setRowBusy(null);
    if (res.ok) { say(`Removed ${u.email}.`); await load(); }
    else fail(j.error ?? `Error ${res.status}`);
  }

  if (forbidden) {
    return <p className="note">Only ADMIN users can manage team members.</p>;
  }

  const isSelf = (u: User) => me?.email?.toLowerCase() === u.email.toLowerCase();
  // A tenant admin must not be able to reset a super-admin's password.
  const canManage = (u: User) => u.role !== "SUPERADMIN" || me?.role === "SUPERADMIN";

  return (
    <div className="grid-forms">
      <form onSubmit={invite} className="card">
        <h3>Invite teammate</h3>
        <div className="field">
          <label className="label" htmlFor="user-email">Email</label>
          <input id="user-email" className="input" data-test-id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="user-name">Name (optional)</label>
          <input id="user-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="user-password">Temporary password (≥8 chars)</label>
          <div className="row">
            <input id="user-password" className="input" data-test-id="user-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPassword(generatePassword())}>Generate</button>
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="user-role">Role</label>
          <select id="user-role" className="input" value={role} onChange={(e) => setRole(e.target.value as "MEMBER" | "ADMIN")}>
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <button className="btn" type="submit" data-test-id="user-submit" disabled={busy}>{busy ? "Creating…" : "Create user"}</button>
        {msg && (
          <p className="note" data-test-id="users-msg"
            style={{ marginTop: 10, color: msgError ? "var(--danger)" : "var(--green)" }}>{msg}</p>
        )}
      </form>

      <div className="card">
        <h3>Team</h3>
        <table className="table">
          <thead><tr><th>Email</th><th>Name</th><th>Role</th><th style={{ textAlign: "end" }}>Manage</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-test-id="user-row">
                <td>{u.email}{isSelf(u) && <span className="muted"> · you</span>}</td>
                <td>
                  {editing === u.id ? (
                    <input className="input" style={{ maxWidth: 160 }} value={draftName}
                      onChange={(e) => setDraftName(e.target.value)} placeholder="Name" maxLength={120} />
                  ) : (u.name ?? "—")}
                </td>
                <td>
                  {editing === u.id && u.role !== "SUPERADMIN" ? (
                    <select className="input" style={{ maxWidth: 130 }} value={draftRole}
                      onChange={(e) => setDraftRole(e.target.value as "MEMBER" | "ADMIN")} disabled={isSelf(u)}>
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  ) : (
                    <span className={`badge badge--${u.role === "MEMBER" ? "PENDING" : "READ"}`}>{u.role}</span>
                  )}
                </td>
                <td style={{ textAlign: "end" }}>
                  {!canManage(u) ? (
                    <span className="muted" style={{ fontSize: 13 }}>super-admin only</span>
                  ) : editing === u.id ? (
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn btn--sm" onClick={() => saveEdit(u)} disabled={rowBusy === u.id} aria-busy={rowBusy === u.id}>
                        {rowBusy === u.id ? "Saving…" : "Save"}
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  ) : resetting === u.id ? (
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <input className="input" style={{ maxWidth: 190 }} type="text" value={newPassword}
                        data-test-id="user-new-password" placeholder="New password (≥8)"
                        onChange={(e) => setNewPassword(e.target.value)} minLength={8} />
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setNewPassword(generatePassword())}>Generate</button>
                      <button className="btn btn--sm" onClick={() => saveReset(u)} disabled={rowBusy === u.id} aria-busy={rowBusy === u.id}>
                        {rowBusy === u.id ? "Saving…" : "Set"}
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={() => { setResetting(null); setNewPassword(""); }}>Cancel</button>
                    </div>
                  ) : (
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn btn--ghost btn--sm" data-test-id="user-edit" onClick={() => startEdit(u)}>Edit</button>
                      <button className="btn btn--ghost btn--sm" data-test-id="user-reset" onClick={() => startReset(u)}>Reset password</button>
                      {!isSelf(u) && (
                        <button className="btn btn--ghost btn--sm" data-test-id="user-remove" style={{ color: "var(--danger)" }}
                          onClick={() => remove(u)} disabled={rowBusy === u.id} aria-busy={rowBusy === u.id}>
                          {rowBusy === u.id ? "Removing…" : "Remove"}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>No users yet.</td></tr>}
          </tbody>
        </table>
        <p className="note" style={{ marginTop: 12 }}>
          A password reset signs that person out everywhere and hands you the new password to pass on — nobody
          receives it by email. Change your own password in the card below.
        </p>
      </div>
    </div>
  );
}
