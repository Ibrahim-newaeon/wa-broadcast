import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LangToggle from "@/components/LangToggle";

// Public marketing landing page — shown before login. Stays outside auth
// (see middleware: pathname === "/" is allowed through).
// Bilingual EN/AR: both languages are rendered; CSS shows one based on
// <html lang>, set pre-paint by the script in layout.tsx (no flash, no
// hydration mismatch). Arabic flips to RTL + Cairo via the design system.
export const dynamic = "force-static";

// Renders both languages inline; globals.css hides the inactive one.
function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span data-lang="en">{en}</span>
      <span data-lang="ar">{ar}</span>
    </>
  );
}

type Bi = { en: string; ar: string };

const CAPABILITIES: { no: string; title: Bi; body: Bi }[] = [
  { no: "📋", title: { en: "Send Menu", ar: "إرسال القائمة" },
    body: { en: "Send your menu as an approved template message to one number or a whole list.",
      ar: "أرسِل قائمة الطعام كرسالة قالب معتمدة لرقم أو قائمة أرقام." } },
  { no: "⭐", title: { en: "Request Feedback", ar: "طلب تقييم" },
    body: { en: "Ask for the customer's review after their order with a ready-made message.",
      ar: "اطلب رأي العميل بعد الطلب برسالة جاهزة." } },
  { no: "📡", title: { en: "Delivery Status", ar: "حالة التسليم" },
    body: { en: "Track Sent · Delivered · Read for every message.",
      ar: "تابِع: أُرسِلت · وصلت · قُرئت — لكل رسالة." } },
  { no: "🗂️", title: { en: "Message Log", ar: "سجل الإرسال" },
    body: { en: "Review sent messages with their timestamp and status.",
      ar: "راجِع الرسائل المُرسَلة مع التوقيت والحالة." } },
  { no: "✅", title: { en: "Consent Management", ar: "إدارة الموافقات" },
    body: { en: "Opted-in numbers only, with the opt-in date on record.",
      ar: "أرقام بموافقة مسبقة (Opt-in) فقط، مع توثيق التاريخ." } },
];

const STEPS: { no: string; title: Bi; body: Bi }[] = [
  { no: "01", title: { en: "Upload contacts", ar: "ارفع جهات الاتصال" },
    body: { en: "CSV import or add individually, grouped into lists.", ar: "استيراد CSV أو إضافة فردية ضمن قوائم." } },
  { no: "02", title: { en: "Pick a template", ar: "اختر قالبًا" },
    body: { en: "Map its variables to each contact's fields.", ar: "اربط متغيّراته بحقول كل جهة اتصال." } },
  { no: "03", title: { en: "Send or schedule", ar: "أرسل أو جدوِل" },
    body: { en: "A rate-limited worker delivers every message.", ar: "عامل منظّم المعدّل يوصِل كل رسالة." } },
  { no: "04", title: { en: "Track & comply", ar: "تابع والتزم" },
    body: { en: "Live delivery status; opt-outs excluded automatically.", ar: "حالة تسليم لحظية؛ تُستبعد إلغاءات الاشتراك تلقائيًا." } },
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
          <LangToggle />
          <ThemeToggle />
          <Link href="/login" className="btn btn--sm" data-test-id="landing-login">
            <T en="Log in" ar="تسجيل الدخول" />
          </Link>
        </div>
      </header>

      <section className="lp-hero">
        <div>
          <p className="lp-kicker reveal">
            <T en="WhatsApp Cloud API" ar="واجهة واتساب السحابية" />
          </p>
          <h1 className="lp-h1 reveal d1">
            <span data-lang="en"><em>WhatsApp</em> Hub</span>
            <span data-lang="ar">مركز <em>واتساب</em></span>
          </h1>
          <p className="lp-lead reveal d2">
            <T
              en="Send menus and feedback requests to your customers, and track the status of every message — sent, delivered, read — from one place."
              ar="أرسِل قوائم الطعام وطلبات التقييم لعملائك، وتابِع حالة كل رسالة — أُرسِلت، وصلت، قُرئت — من مكان واحد."
            />
          </p>
          <div className="lp-actions reveal d3">
            <Link href="/login" className="btn" data-test-id="landing-cta">
              <T en="Open the hub" ar="افتح المركز" />
            </Link>
            <a href="/tutorial.html" className="btn btn--ghost" data-test-id="landing-tutorial">
              <T en="See how it works" ar="شاهد كيف تعمل" />
            </a>
          </div>
          <div className="lp-trust reveal d4">
            <span><T en="Connected to WhatsApp API" ar="متصل بواجهة واتساب" /></span>
            <span><T en="Approved templates: Menu, Feedback" ar="القوالب المعتمدة: قائمة الطعام، طلب تقييم" /></span>
            <span><T en="Opted-in numbers only" ar="أرقام بموافقة مسبقة فقط" /></span>
          </div>
        </div>

        {/* Live delivery demo — a real slice of the product, not decoration. */}
        <aside className="lp-demo reveal d2" aria-label="Live broadcast preview">
          <div className="lp-demo__head">
            <span className="lp-demo__name">menu · <T en="Today's Menu" ar="قائمة اليوم" /></span>
            <span className="lp-demo__live"><i aria-hidden /><T en="LIVE" ar="مباشر" /></span>
          </div>
          <p className="lp-demo__meta">
            <T en="Sending the menu to “Regulars” · 1,240 recipients" ar="إرسال القائمة إلى ‹العملاء الدائمين› · 1,240 مستلمًا" />
          </p>
          <div className="lp-demo__track"><div className="lp-demo__fill" /></div>
          <div className="lp-demo__nums">
            <div className="lp-demo__num"><b>1,240</b><span><T en="Sent" ar="أُرسلت" /></span></div>
            <div className="lp-demo__num"><b>968</b><span><T en="Delivered" ar="سُلّمت" /></span></div>
            <div className="lp-demo__num"><b>412</b><span><T en="Read" ar="قُرئت" /></span></div>
          </div>
          <div className="lp-demo__rows">
            <div className="lp-demo__row reveal d3"><span>+9665••••0192</span><span className="badge badge--READ"><T en="READ" ar="قُرئت" /></span></div>
            <div className="lp-demo__row reveal d4"><span>+9715••••8830</span><span className="badge badge--DELIVERED"><T en="DELIVERED" ar="سُلّمت" /></span></div>
            <div className="lp-demo__row reveal d5"><span>+9745••••1188</span><span className="badge badge--SENT"><T en="SENT" ar="أُرسلت" /></span></div>
          </div>
        </aside>
      </section>

      <section className="lp-section lp-caps">
        <div className="lp-caps__lede">
          <h2><T en="Everything you need on WhatsApp" ar="كل ما تحتاجه على واتساب" /></h2>
          <p><T en="From sending the menu to delivery receipts — managed from one place."
            ar="من إرسال القائمة حتى إيصالات التسليم — من مكان واحد." /></p>
        </div>
        <div className="lp-caps__list">
          {CAPABILITIES.map((c) => (
            <article key={c.no} className="lp-cap">
              <div className="lp-cap__no">{c.no}</div>
              <div>
                <h3><T en={c.title.en} ar={c.title.ar} /></h3>
                <p><T en={c.body.en} ar={c.body.ar} /></p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="lp-section">
        <h2><T en="From contact to delivery receipt in four steps" ar="من جهة الاتصال إلى إيصال التسليم في أربع خطوات" /></h2>
        <div className="lp-steps">
          {STEPS.map((s) => (
            <div key={s.no} className="lp-step">
              <div className="lp-step__no">{s.no}</div>
              <h3><T en={s.title.en} ar={s.title.ar} /></h3>
              <p><T en={s.body.en} ar={s.body.ar} /></p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-final">
        <h2><T en="Start sending from your WhatsApp Hub." ar="ابدأ الإرسال من مركز واتساب." /></h2>
        <Link href="/login" className="btn"><T en="Open the hub" ar="افتح المركز" /></Link>
      </section>

      <footer className="lp-foot">
        <span><T en="© NazzilVideo · WhatsApp Hub" ar="© NazzilVideo · مركز واتساب" /></span>
        <span style={{ display: "inline-flex", gap: 18 }}>
          <a href="/tutorial.html"><T en="Tutorial" ar="الدليل التفاعلي" /></a>
          <Link href="/login"><T en="Log in" ar="تسجيل الدخول" /></Link>
        </span>
      </footer>
    </main>
  );
}
