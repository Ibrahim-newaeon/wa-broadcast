"use client";

import { useState } from "react";

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span data-lang="en">{en}</span>
      <span data-lang="ar">{ar}</span>
    </>
  );
}

/** Public lead-capture form on the landing page (POSTs to /api/leads). */
export default function LeadForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [business, setBusiness] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — visually hidden
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(false);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, business: business.trim() || undefined, website }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) setDone(true);
    else setErr(true);
  }

  if (done) {
    return (
      <p className="dk-form__done" data-test-id="lead-done">
        <T en="Got it — we'll message you on WhatsApp shortly. 💬"
          ar="وصلنا طلبك — سنراسلك على واتساب قريبًا. 💬" />
      </p>
    );
  }

  return (
    <form className="dk-form" onSubmit={onSubmit} data-test-id="lead-form">
      <input className="dk-form__input" data-test-id="lead-name" value={name} maxLength={120} required
        onChange={(e) => setName(e.target.value)} placeholder="Name · الاسم" />
      <input className="dk-form__input" data-test-id="lead-phone" value={phone} required
        inputMode="tel" dir="ltr" onChange={(e) => setPhone(e.target.value)}
        placeholder="WhatsApp · 9665xxxxxxxx" />
      <input className="dk-form__input" data-test-id="lead-business" value={business} maxLength={120}
        onChange={(e) => setBusiness(e.target.value)} placeholder="Business (optional) · اسم النشاط (اختياري)" />
      {/* Honeypot: hidden from humans; bots that fill it are silently dropped. */}
      <input className="dk-form__hp" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" />
      <button className="dk-btn dk-btn--primary" type="submit" data-test-id="lead-submit"
        disabled={busy || !name.trim() || !phone.trim()} aria-busy={busy}>
        {busy
          ? <T en="Sending…" ar="جارٍ الإرسال…" />
          : <T en="Message me on WhatsApp" ar="راسلوني على واتساب" />}
      </button>
      {err && (
        <p className="dk-form__err" data-test-id="lead-error">
          <T en="Check the number (international format, e.g. 9665xxxxxxxx) and try again."
            ar="تحقّق من الرقم (بالصيغة الدولية مثل 9665xxxxxxxx) وحاول مجددًا." />
        </p>
      )}
    </form>
  );
}
