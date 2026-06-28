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

/** Render a bubble's content — media is streamed (token-safe) via /api/media/:id. */
function MessageContent({ m }: { m: Msg }) {
  const src = `/api/media/${m.id}`;
  if (m.type === "image" || m.type === "sticker") {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bubble__media" src={src} alt={m.text ?? "image"} loading="lazy" />
        {m.text && <div className="bubble__text">{m.text}</div>}
      </>
    );
  }
  if (m.type === "video") {
    return (
      <>
        <video className="bubble__media" src={src} controls />
        {m.text && <div className="bubble__text">{m.text}</div>}
      </>
    );
  }
  if (m.type === "audio") return <audio className="bubble__audio" src={src} controls />;
  if (m.type === "document") {
    return <a className="bubble__doc" href={src} target="_blank" rel="noreferrer">📄 {m.mediaFilename ?? "Document"}</a>;
  }
  return <div className="bubble__text">{bodyOf(m)}</div>;
}

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
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function sendFile(file: File) {
    if (!activeId) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    if (reply.trim()) fd.append("caption", reply.trim());
    const r = await apiFetch(`/api/conversations/${activeId}/media`, { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setReply("");
      setMessages((m) => [...m, j.message]);
      loadConvos();
    } else {
      setErr(j.error ?? "Could not send file");
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
                  <MessageContent m={m} />
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
                  ref={fileRef}
                  type="file"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) sendFile(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="btn btn--ghost thread__attach"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  title="Attach a file"
                  aria-label="Attach a file"
                >
                  📎
                </button>
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
