import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

// Public marketing landing page — shown before login. Stays outside auth
// (see middleware: pathname === "/" is allowed through).
export const dynamic = "force-static";

const CAPABILITIES: { no: string; title: string; body: string }[] = [
  { no: "01", title: "Bulk & single contacts", body: "Import by CSV or add one at a time, grouped into lists. Custom columns become per-recipient message variables." },
  { no: "02", title: "Approved templates only", body: "Send Meta-approved WhatsApp templates, with each template's variables resolved from the contact." },
  { no: "03", title: "Real-time delivery", body: "Sent → delivered → read → failed, updated live from Cloud API webhooks as the broadcast goes out." },
  { no: "04", title: "Opt-out compliance", body: "Inbound STOP keywords and manual opt-outs are honored and excluded from every future send." },
  { no: "05", title: "Recurring campaigns", body: "Schedule template sends on a cron — the worker fans them out on time, every time." },
  { no: "06", title: "Rate-limited & resilient", body: "A queue-backed worker paces sends to your Meta tier, with automatic retries and backoff." },
];

const STEPS: { no: string; title: string; body: string }[] = [
  { no: "01", title: "Upload contacts", body: "CSV import or add individually, grouped into lists." },
  { no: "02", title: "Pick a template", body: "Map its variables to each contact's fields." },
  { no: "03", title: "Send or schedule", body: "A rate-limited worker delivers every message." },
  { no: "04", title: "Track & comply", body: "Live delivery status; opt-outs excluded automatically." },
];

export default function Landing() {
  return (
    <main className="lp">
      <header className="lp-bar reveal">
        <div className="brand">
          <span className="mark" aria-hidden />
          <span><span className="b1">broadcast</span><span className="b2">console</span></span>
        </div>
        <div className="lp-bar__right">
          <ThemeToggle />
          <Link href="/login" className="btn btn--sm" data-test-id="landing-login">Log in</Link>
        </div>
      </header>

      <section className="lp-hero">
        <div>
          <p className="lp-kicker reveal">Self-hosted · WhatsApp Cloud API</p>
          <h1 className="lp-h1 reveal d1">
            Broadcast to thousands on WhatsApp — and watch every message land in <em>real time</em>.
          </h1>
          <p className="lp-lead reveal d2">
            NazzilVideo Broadcast Console sends Meta-approved template messages to your contact
            lists, paces them safely to your tier, and tracks delivery as it happens — built
            straight on Meta&rsquo;s Cloud API, with no per-message middleman.
          </p>
          <div className="lp-actions reveal d3">
            <Link href="/login" className="btn" data-test-id="landing-cta">Log in to console</Link>
            <a href="#how" className="btn btn--ghost">See how it works</a>
          </div>
          <div className="lp-trust reveal d4">
            <span>No per-message fees</span>
            <span>Honors opt-outs</span>
            <span>Runs on your infrastructure</span>
          </div>
        </div>

        {/* Live delivery demo — a real slice of the product, not decoration. */}
        <aside className="lp-demo reveal d2" aria-label="Live broadcast preview">
          <div className="lp-demo__head">
            <span className="lp-demo__name">eid_promo · Eid Sale</span>
            <span className="lp-demo__live"><i aria-hidden />LIVE</span>
          </div>
          <p className="lp-demo__meta">Sending to “VIP customers” · 1,240 recipients</p>
          <div className="lp-demo__track"><div className="lp-demo__fill" /></div>
          <div className="lp-demo__nums">
            <div className="lp-demo__num"><b>1,240</b><span>Sent</span></div>
            <div className="lp-demo__num"><b>968</b><span>Delivered</span></div>
            <div className="lp-demo__num"><b>412</b><span>Read</span></div>
          </div>
          <div className="lp-demo__rows">
            <div className="lp-demo__row reveal d3"><span>+9665••••0192</span><span className="badge badge--READ">READ</span></div>
            <div className="lp-demo__row reveal d4"><span>+9715••••8830</span><span className="badge badge--DELIVERED">DELIVERED</span></div>
            <div className="lp-demo__row reveal d5"><span>+9745••••1188</span><span className="badge badge--SENT">SENT</span></div>
          </div>
        </aside>
      </section>

      <section className="lp-section lp-caps">
        <div className="lp-caps__lede">
          <h2>Everything you need to run compliant broadcasts</h2>
          <p>From import to delivery receipts, the whole pipeline runs on infrastructure you control.</p>
        </div>
        <div className="lp-caps__list">
          {CAPABILITIES.map((c) => (
            <article key={c.no} className="lp-cap">
              <div className="lp-cap__no">{c.no}</div>
              <div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="lp-section">
        <h2>From contact to delivery receipt in four steps</h2>
        <div className="lp-steps">
          {STEPS.map((s) => (
            <div key={s.no} className="lp-step">
              <div className="lp-step__no">{s.no}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-final">
        <h2>Start broadcasting from your own console.</h2>
        <Link href="/login" className="btn">Log in to console</Link>
      </section>

      <footer className="lp-foot">
        <span>© NazzilVideo · Broadcast Console</span>
        <span style={{ display: "inline-flex", gap: 18 }}>
          <a href="/tutorial.html">Tutorial</a>
          <Link href="/login">Log in</Link>
        </span>
      </footer>
    </main>
  );
}
