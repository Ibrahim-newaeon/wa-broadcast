"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface User { id: string; email: string; name: string | null; role: string; createdAt: string }

export default function UsersManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setMsg(`Created ${j.user.email}.`);
      setEmail(""); setName(""); setPassword("");
      await load();
    } else setMsg(`Error: ${j.error ?? res.status}`);
  }

  if (forbidden) {
    return <p className="note">Only ADMIN users can manage team members.</p>;
  }

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
          <input id="user-password" className="input" data-test-id="user-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="field">
          <label className="label" htmlFor="user-role">Role</label>
          <select id="user-role" className="input" value={role} onChange={(e) => setRole(e.target.value as "MEMBER" | "ADMIN")}>
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <button className="btn" type="submit" data-test-id="user-submit" disabled={busy}>{busy ? "Creating…" : "Create user"}</button>
        {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}
      </form>

      <div className="card">
        <h3>Team</h3>
        <table className="table">
          <thead><tr><th>Email</th><th>Name</th><th>Role</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name ?? "—"}</td>
                <td><span className={`badge badge--${u.role === "ADMIN" ? "READ" : "PENDING"}`}>{u.role}</span></td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={3} className="muted" style={{ padding: 16 }}>No users yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
