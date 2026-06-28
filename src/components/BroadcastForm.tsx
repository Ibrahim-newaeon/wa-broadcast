"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface List { id: string; name: string }
interface Template { id: string; name: string; language: string; variableCount: number; headerFormat?: string | null }

export default function BroadcastForm({ lists, templates }: { lists: List[]; templates: Template[] }) {
  const [templateId, setTemplateId] = useState("");
  const [listId, setListId] = useState("");
  const [vars, setVars] = useState<string[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => templates.find((t) => t.id === templateId), [templateId, templates]);
  const mediaHeader = !!selected && ["IMAGE", "DOCUMENT", "VIDEO"].includes(selected.headerFormat ?? "");

  function onTemplateChange(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    setVars(Array(t?.variableCount ?? 0).fill(""));
    setHeaderMediaUrl("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const variableMap = vars.map((v) => (v.startsWith("field:") ? { from: v.slice(6).trim() } : { literal: v }));
    const body: Record<string, unknown> = { templateId, listId, variableMap };
    if (mediaHeader && headerMediaUrl.trim()) body.headerMediaUrl = headerMediaUrl.trim();
    if (scheduleAt) body.scheduleAt = new Date(scheduleAt).toISOString();

    const res = await apiFetch("/api/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(
      res.ok
        ? j.scheduledAt
          ? `Scheduled ${j.queued} messages for ${new Date(j.scheduledAt).toLocaleString()}.`
          : `Queued ${j.queued} messages now.`
        : `Error: ${j.error ?? res.status}`,
    );
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <h3>New broadcast</h3>

      <div className="field">
        <label className="label" htmlFor="tpl">Template (approved only)</label>
        <select id="tpl" data-test-id="bc-template" className="input" value={templateId} onChange={(e) => onTemplateChange(e.target.value)} required>
          <option value="">— choose —</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.language}) · {t.variableCount} vars</option>)}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="lst">Recipient list</label>
        <select id="lst" data-test-id="bc-list" className="input" value={listId} onChange={(e) => setListId(e.target.value)} required>
          <option value="">— choose —</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {mediaHeader && (
        <div className="field">
          <label className="label" htmlFor="bc-hdr">
            Header media URL <span className="muted">— this template has a {selected?.headerFormat?.toLowerCase()} header</span>
          </label>
          <input id="bc-hdr" data-test-id="bc-header-media" className="input" type="url" value={headerMediaUrl}
            onChange={(e) => setHeaderMediaUrl(e.target.value)}
            placeholder="https://… (public link to the image/PDF/video)" required />
        </div>
      )}

      {selected && selected.variableCount > 0 && (
        <div className="field">
          <label className="label">
            Template variables — literal text, or <code>field:name</code> / <code>field:city</code> to pull per-contact
          </label>
          {vars.map((v, i) => (
            <input key={i} data-test-id={`bc-var-${i + 1}`} className="input" placeholder={`{{${i + 1}}}`}
              value={v} onChange={(e) => setVars((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))}
              style={{ marginBottom: 8 }} />
          ))}
        </div>
      )}

      <div className="field">
        <label className="label" htmlFor="sch">Schedule (optional — blank = send now)</label>
        <input id="sch" data-test-id="bc-schedule" className="input" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
      </div>

      <button data-test-id="bc-submit" className="btn" type="submit"
        disabled={busy || !templateId || !listId || (mediaHeader && !headerMediaUrl.trim())} aria-busy={busy}>
        {busy ? "Submitting…" : scheduleAt ? "Schedule broadcast" : "Send now"}
      </button>
      {msg && <p data-test-id="bc-result" className="note" style={{ marginTop: 10 }}>{msg}</p>}
    </form>
  );
}
