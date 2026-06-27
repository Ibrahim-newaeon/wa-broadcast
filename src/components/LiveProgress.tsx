"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface Recipient { id: string; phone: string; name: string | null; status: string; error: string | null }
interface Detail {
  broadcast: { id: string; status: string; totalCount: number; sentCount: number; failedCount: number };
  counts: Record<string, number>;
  page: { offset: number; limit: number; filteredTotal: number; status: string | null };
  recipients: Recipient[];
}

const TERMINAL = new Set(["COMPLETED", "FAILED"]);
const FILTERS = ["ALL", "PENDING", "SENT", "DELIVERED", "READ", "FAILED"] as const;
const PAGE = 50;

export default function LiveProgress({
  broadcastId, initialStatus, initialCounts,
}: {
  broadcastId: string;
  initialStatus: string;
  initialCounts: { total: number; sent: number; failed: number };
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [live, setLive] = useState(!TERMINAL.has(initialStatus));
  const [retrying, setRetrying] = useState(false);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const offsetRef = useRef(0);

  // Load a page. mode "replace" resets the list (filter change / poll),
  // "append" adds the next page (load-more).
  const load = useCallback(async (mode: "replace" | "append") => {
    const offset = mode === "append" ? offsetRef.current : 0;
    const q = new URLSearchParams({ offset: String(offset), limit: String(PAGE) });
    if (filter !== "ALL") q.set("status", filter);
    const res = await apiFetch(`/api/broadcasts/${broadcastId}?${q}`);
    if (!res.ok) return;
    const json = (await res.json()) as Detail;
    offsetRef.current = offset + json.recipients.length;
    setData((prev) =>
      mode === "append" && prev
        ? { ...json, recipients: [...prev.recipients, ...json.recipients] }
        : json,
    );
    if (TERMINAL.has(json.broadcast.status)) setLive(false);
  }, [broadcastId, filter]);

  // Reload list when the filter changes.
  useEffect(() => { offsetRef.current = 0; void load("replace"); }, [load]);

  // Poll counts + first page while in flight.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { offsetRef.current = 0; void load("replace"); }, 4000);
    return () => clearInterval(t);
  }, [live, load]);

  const b = data?.broadcast ?? { status: initialStatus, totalCount: initialCounts.total, sentCount: initialCounts.sent, failedCount: initialCounts.failed };
  const counts = data?.counts ?? {};
  const done = b.sentCount + b.failedCount;
  const pct = b.totalCount > 0 ? Math.round((done / b.totalCount) * 100) : 0;
  const recipients = data?.recipients ?? [];
  const filteredTotal = data?.page.filteredTotal ?? 0;

  const retryFailed = useCallback(async () => {
    setRetrying(true); setRetryMsg(null);
    const res = await apiFetch(`/api/broadcasts/${broadcastId}/retry`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setRetrying(false);
    if (res.ok) {
      setRetryMsg(`Re-queued ${json.retried} failed recipient(s).`);
      setLive(true); offsetRef.current = 0; await load("replace");
    } else setRetryMsg(`Error: ${json.error ?? res.status}`);
  }, [broadcastId, load]);

  return (
    <div data-test-id="live-progress">
      <div className="stats">
        <Stat label="Status" value={<span className={`badge badge--${b.status}`}>{b.status}</span>} />
        <Stat label="Total" value={b.totalCount} />
        <Stat label="Sent" value={b.sentCount} />
        <Stat label="Failed" value={b.failedCount} />
        {live && <span className="live-dot" style={{ alignSelf: "center" }}>● live</span>}
      </div>

      <div className="progress"><div className="progress__bar" style={{ width: `${pct}%` }} /></div>
      <div className="note" style={{ margin: "6px 0 16px" }}>{pct}% processed ({done}/{b.totalCount})</div>

      {b.failedCount > 0 && (
        <div className="row" style={{ marginBottom: 16 }}>
          <button data-test-id="retry-failed" className="btn btn--danger btn--sm" onClick={retryFailed} disabled={retrying} aria-busy={retrying}>
            {retrying ? "Retrying…" : `Retry ${b.failedCount} failed`}
          </button>
          {retryMsg && <span className="note">{retryMsg}</span>}
        </div>
      )}

      {/* status filter chips */}
      <div className="row" style={{ marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <button key={f} data-test-id={`filter-${f}`}
            className={`pill ${filter === f ? "is-active" : ""}`} onClick={() => setFilter(f)}>
            {f}{f !== "ALL" && counts[f] != null ? ` ${counts[f]}` : ""}
          </button>
        ))}
      </div>

      <table data-test-id="recipients-table" className="table">
        <thead><tr><th>Phone</th><th>Name</th><th>Status</th><th>Error</th></tr></thead>
        <tbody>
          {recipients.map((r) => (
            <tr key={r.id}>
              <td>{r.phone}</td>
              <td>{r.name ?? "—"}</td>
              <td><span className={`badge badge--${r.status}`}>{r.status}</span></td>
              <td className="note">{r.error ?? ""}</td>
            </tr>
          ))}
          {recipients.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>No recipients.</td></tr>}
        </tbody>
      </table>

      {recipients.length < filteredTotal && (
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 12 }} onClick={() => load("append")}>
          Load more ({recipients.length}/{filteredTotal})
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat__num">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}
