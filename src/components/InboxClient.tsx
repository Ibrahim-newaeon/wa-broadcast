"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface Convo {
  id: string; phone: string; name: string | null;
  lastPreview: string | null; lastMessageAt: string; lastInboundAt: string | null; unread: number;
}
interface Msg {
  id: string; direction: "IN" | "OUT"; type: string; text: string | null;
  mediaMime: string | null; mediaFilename: string | null; status: string | null; error: string | null; createdAt: string;
}

const MEDIA_LABEL: Record<string, string> = {
  image: "📷 Photo", audio: "🎙️ Voice message", video: "🎬 Video",
  sticker: "🌟 Sticker", location: "📍 Location", reaction: "Reaction",
};
function bodyOf(m: Msg): string {
  if (m.text) return m.text;
  if (m.type === "document") return "📄 " + (m.mediaFilename ?? "Document");
  return MEDIA_LABEL[m.type] ?? "Message";
}
const hhmm = (s: string) => new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function InboxClient() {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [windowOpen, setWindowOpen] = useState(false);
  const [head, setHead] = useState<{ name: string | null; phone: string } | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const loadConvos = useCallback(async () => {
    const r = await apiFetch("/api/conversations");
    if (r.ok) setConvos((await r.json()).conversations);
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const r = await apiFetch(`/api/conversations/${id}`);
    if (!r.ok) return;
    const j = await r.json();
    setMessages(j.messages);
    setWindowOpen(j.conversation.windowOpen);
    setHead({ name: j.conversation.name, phone: j.conversation.phone });
  }, []);

  useEffect(() => {
    loadConvos();
    const t = setInterval(loadConvos, 5000);
    return () => clearInterval(t);
  }, [loadConvos]);

  useEffect(() => {
    if (!activeId) return;
    loadThread(activeId);
    const t = setInterval(() => loadThread(activeId), 5000);
    return () => clearInterval(t);
  }, [activeId, loadThread]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, activeId]);

  function open(id: string) {
    setActiveId(id);
    setErr(null);
    setConvos((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = reply.trim();
    if (!text || !activeId) return;
    setBusy(true);
    setErr(null);
    const r = await apiFetch(`/api/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setReply("");
      setMessages((m) => [...m, j.message]);
      loadConvos();
    } else {
      setErr(j.error ?? "Could not send");
    }
  }

  return (
    <div className="inbox">
      <aside className="inbox__list">
        {convos.length === 0 && (
          <p className="muted" style={{ padding: 16 }}>No conversations yet — they appear here when a contact messages you back.</p>
        )}
        {convos.map((c) => (
          <button key={c.id} type="button" className={`convo${c.id === activeId ? " convo--active" : ""}`} onClick={() => open(c.id)}>
            <div className="convo__top">
              <span className="convo__name">{c.name ?? c.phone}</span>
              {c.unread > 0 && <span className="convo__badge">{c.unread}</span>}
            </div>
            <div className="convo__preview">{c.lastPreview ?? ""}</div>
          </button>
        ))}
      </aside>

      <section className="inbox__thread">
        {!activeId ? (
          <div className="inbox__empty muted">Select a conversation to read and reply.</div>
        ) : (
          <>
            <header className="thread__head">
              <strong>{head?.name ?? head?.phone}</strong>
              {head?.name && <span className="muted"> · {head?.phone}</span>}
            </header>

            <div className="thread__body" ref={threadRef}>
              {messages.map((m) => (
                <div key={m.id} className={`bubble bubble--${m.direction === "OUT" ? "out" : "in"}`}>
                  <div className="bubble__text">{bodyOf(m)}</div>
                  <div className="bubble__meta">
                    {hhmm(m.createdAt)}
                    {m.direction === "OUT" && m.status ? ` · ${m.status.toLowerCase()}` : ""}
                  </div>
                </div>
              ))}
            </div>

            <form className="thread__reply" onSubmit={send}>
              {!windowOpen && (
                <div className="thread__closed">
                  The 24-hour reply window is closed. Send an approved <b>template</b> to re-open the conversation.
                </div>
              )}
              <div className="thread__inputrow">
                <input
                  className="input"
                  placeholder={windowOpen ? "Type a reply…" : "Window closed — a free-form reply may be rejected"}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <button className="btn" type="submit" disabled={busy || !reply.trim()} aria-busy={busy}>
                  {busy ? "Sending…" : "Send"}
                </button>
              </div>
              {err && <p className="note" style={{ color: "var(--danger)", marginTop: 8 }}>{err}</p>}
            </form>
          </>
        )}
      </section>
    </div>
  );
}
