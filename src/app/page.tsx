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
  { no: "01", title: { en: "Bulk & single contacts", ar: "جهات اتصال مفردة وبالجملة" },
    body: { en: "Import by CSV or add one at a time, grouped into lists. Custom columns become per-recipient message variables.",
      ar: "استورد عبر CSV أو أضف واحدة تلو الأخرى ضمن قوائم. تتحوّل الأعمدة المخصّصة إلى متغيّرات لكل مستلم." } },
  { no: "02", title: { en: "Approved templates only", ar: "قوالب معتمدة فقط" },
    body: { en: "Send Meta-approved WhatsApp templates, with each template's variables resolved from the contact.",
      ar: "أرسل قوالب واتساب المعتمدة من ميتا، مع تعبئة متغيّرات كل قالب من بيانات جهة الاتصال." } },
  { no: "03", title: { en: "Real-time delivery", ar: "تسليم لحظي" },
    body: { en: "Sent → delivered → read → failed, updated live from Cloud API webhooks as the broadcast goes out.",
      ar: "أُرسلت ← سُلّمت ← قُرئت ← فشلت، تتحدّث مباشرةً من إشعارات الواجهة السحابية أثناء الإرسال." } },
  { no: "04", title: { en: "Opt-out compliance", ar: "الامتثال لإلغاء الاشتراك" },
    body: { en: "Inbound STOP keywords and manual opt-outs are honored and excluded from every future send.",
      ar: "تُحترم كلمات الإيقاف الواردة وإلغاءات الاشتراك اليدوية وتُستبعد من كل إرسال لاحق." } },
  { no: "05", title: { en: "Recurring campaigns", ar: "حملات متكرّرة" },
    body: { en: "Schedule template sends on a cron — the worker fans them out on time, every time.",
      ar: "جدوِل إرسال القوالب وفق توقيت محدّد، ويتولّى العامل توزيعها في موعدها." } },
  { no: "06", title: { en: "Rate-limited & resilient", ar: "منظّمة المعدّل ومرنة" },
    body: { en: "A queue-backed worker paces sends to your Meta tier, with automatic retries and backoff.",
      ar: "عامل قائم على الطابور ينظّم الإرسال حسب حدّ حسابك في ميتا، مع إعادة محاولة تلقائية." } },
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
            <T en="Self-hosted · WhatsApp Cloud API" ar="استضافة ذاتية · واجهة واتساب السحابية" />
          </p>
          <h1 className="lp-h1 reveal d1">
            <span data-lang="en">Broadcast to thousands on WhatsApp — and watch every message land in <em>real time</em>.</span>
            <span data-lang="ar">راسل الآلاف على واتساب — وتابع وصول كل رسالة <em>لحظة بلحظة</em>.</span>
          </h1>
          <p className="lp-lead reveal d2">
            <T
              en="NazzilVideo Broadcast Console sends Meta-approved template messages to your contact lists, paces them safely to your tier, and tracks delivery as it happens — built straight on Meta's Cloud API, with no per-message middleman."
              ar="تُرسل منصة NazzilVideo رسائل القوالب المعتمدة من ميتا إلى قوائم جهات اتصالك، وتنظّم إرسالها بما يتوافق مع حدّ حسابك، وتتعقّب التسليم لحظة حدوثه — مبنية مباشرةً على واجهة واتساب السحابية من ميتا، دون وسيط لكل رسالة."
            />
          </p>
          <div className="lp-actions reveal d3">
            <Link href="/login" className="btn" data-test-id="landing-cta">
              <T en="Log in to console" ar="ادخل إلى المنصة" />
            </Link>
            <a href="/tutorial.html" className="btn btn--ghost" data-test-id="landing-tutorial">
              <T en="See how it works" ar="شاهد كيف تعمل" />
            </a>
          </div>
          <div className="lp-trust reveal d4">
            <span><T en="No per-message fees" ar="بلا رسوم لكل رسالة" /></span>
            <span><T en="Honors opt-outs" ar="يحترم إلغاء الاشتراك" /></span>
            <span><T en="Runs on your infrastructure" ar="يعمل على بنيتك التحتية" /></span>
          </div>
        </div>

        {/* Live delivery demo — a real slice of the product, not decoration. */}
        <aside className="lp-demo reveal d2" aria-label="Live broadcast preview">
          <div className="lp-demo__head">
            <span className="lp-demo__name">eid_promo · <T en="Eid Sale" ar="تخفيضات العيد" /></span>
            <span className="lp-demo__live"><i aria-hidden /><T en="LIVE" ar="مباشر" /></span>
          </div>
          <p className="lp-demo__meta">
            <T en="Sending to “VIP customers” · 1,240 recipients" ar="الإرسال إلى ‹كبار العملاء› · 1,240 مستلمًا" />
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
          <h2><T en="Everything you need to run compliant broadcasts" ar="كل ما تحتاجه لإدارة حملات متوافقة" /></h2>
          <p><T en="From import to delivery receipts, the whole pipeline runs on infrastructure you control."
            ar="من الاستيراد حتى إيصالات التسليم، تعمل المنظومة كاملةً على بنية تحتية تتحكّم بها أنت." /></p>
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
        <h2><T en="Start broadcasting from your own console." ar="ابدأ الإرسال من منصتك الخاصة." /></h2>
        <Link href="/login" className="btn"><T en="Log in to console" ar="ادخل إلى المنصة" /></Link>
      </section>

      <footer className="lp-foot">
        <span><T en="© NazzilVideo · Broadcast Console" ar="© NazzilVideo · منصة البث" /></span>
        <span style={{ display: "inline-flex", gap: 18 }}>
          <a href="/tutorial.html"><T en="Tutorial" ar="الدليل التفاعلي" /></a>
          <Link href="/login"><T en="Log in" ar="تسجيل الدخول" /></Link>
        </span>
      </footer>
    </main>
  );
}
