"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface List { id: string; name: string; _count: { memberships: number } }
interface Snapshot { id: string; listName: string; memberCount: number; reason: string; createdAt: string }

export default function ListsManager() {
  const [lists, setLists] = useState<List[]>([]);
  const [snaps, setSnaps] = useState<Record<string, Snapshot[]>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    const res = await apiFetch("/api/lists");
    if (res.ok) setLists((await res.json()).lists ?? []);
  }, []);
  useEffect(() => { void loadLists(); }, [loadLists]);

  const loadSnaps = useCallback(async (listId: string) => {
    const res = await apiFetch(`/api/lists/${listId}/snapshots`);
    if (!res.ok) return;
    const data = await res.json();
    setSnaps((p) => ({ ...p, [listId]: data.snapshots ?? [] }));
  }, []);

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setMsg(null);
    const res = await apiFetch("/api/lists", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) { setNewName(""); await loadLists(); }
    else { const j = await res.json().catch(() => ({})); setMsg(j.error ?? "Could not create list"); }
  }

  function toggle(listId: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) next.delete(listId);
      else { next.add(listId); void loadSnaps(listId); }
      return next;
    });
  }

  async function snapshotNow(listId: string) {
    setBusy(`snap:${listId}`); setMsg(null);
    const res = await apiFetch(`/api/lists/${listId}/snapshots`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      setMsg(`Snapshot saved (${j.memberCount} member${j.memberCount === 1 ? "" : "s"}).`);
      if (!open.has(listId)) toggle(listId); else void loadSnaps(listId);
    } else setMsg(j.error ?? "Snapshot failed");
  }

  async function restore(listId: string, snapshotId: string) {
    if (!confirm("Restore this list to the snapshot? Current members will be replaced.")) return;
    setBusy(`restore:${snapshotId}`); setMsg(null);
    const res = await apiFetch(`/api/lists/${listId}/snapshots/${snapshotId}/restore`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      setMsg(`Restored ${j.restored} member(s)${j.missing > 0 ? ` · ${j.missing} skipped (deleted contacts)` : ""}.`);
      await loadLists();
    } else setMsg(j.error ?? "Restore failed");
  }

  return (
    <div>
      <form onSubmit={createList} className="row" style={{ marginBottom: 18 }}>
        <input className="input" style={{ maxWidth: 320 }} value={newName}
          onChange={(e) => setNewName(e.target.value)} placeholder="New list name" maxLength={120} />
        <button className="btn btn--sm" type="submit" disabled={!newName.trim()}>Create list</button>
        {msg && <span className="note" data-test-id="lists-msg" style={{ color: "var(--green)" }}>{msg}</span>}
      </form>

      <div className="grid-forms" style={{ gridTemplateColumns: "1fr" }}>
        {lists.map((l) => (
          <div key={l.id} className="card" data-test-id="list-card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{l.name}</strong>
                <span className="muted"> · {l._count.memberships} member{l._count.memberships === 1 ? "" : "s"}</span>
              </div>
              <div className="row">
                <button className="btn btn--ghost btn--sm" onClick={() => snapshotNow(l.id)}
                  disabled={busy === `snap:${l.id}`} aria-busy={busy === `snap:${l.id}`}>
                  {busy === `snap:${l.id}` ? "Saving…" : "Snapshot now"}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => toggle(l.id)}>
                  {open.has(l.id) ? "Hide snapshots" : "Snapshots"}
                </button>
              </div>
            </div>

            {open.has(l.id) && (
              <table className="table" style={{ marginTop: 12 }}>
                <thead><tr><th>Taken</th><th>Reason</th><th>Members</th><th style={{ textAlign: "end" }}>Restore</th></tr></thead>
                <tbody>
                  {(snaps[l.id] ?? []).map((s) => (
                    <tr key={s.id}>
                      <td>{new Date(s.createdAt).toLocaleString()}</td>
                      <td><span className="badge badge--PENDING">{s.reason}</span></td>
                      <td>{s.memberCount}</td>
                      <td style={{ textAlign: "end" }}>
                        <button className="btn btn--ghost btn--sm" data-test-id="restore-snapshot"
                          onClick={() => restore(l.id, s.id)} disabled={busy === `restore:${s.id}`} aria-busy={busy === `restore:${s.id}`}>
                          {busy === `restore:${s.id}` ? "Restoring…" : "Restore"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(snaps[l.id] ?? []).length === 0 && (
                    <tr><td colSpan={4} className="muted" style={{ padding: 14 }}>No snapshots yet — take one before changing the list.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        ))}
        {lists.length === 0 && <p className="muted">No lists yet. Create one above or from the dashboard.</p>}
      </div>
    </div>
  );
}
