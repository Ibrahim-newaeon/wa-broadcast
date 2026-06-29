import Link from "next/link";
import type { RecipientStatus, BroadcastStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import Nav from "@/components/Nav";
import UploadForm from "@/components/UploadForm";
import NewListForm from "@/components/NewListForm";
import BroadcastForm from "@/components/BroadcastForm";
import { getClientIdFromCookies } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const clientId = await getClientIdFromCookies();

  const [contacts, optedOut, lists, templates, broadcasts, recipientGroups, statusGroups, unreadAgg] =
    await Promise.all([
      prisma.contact.count({ where: { clientId } }),
      prisma.contact.count({ where: { clientId, optedOut: true } }),
      prisma.contactList.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
      prisma.template.findMany({ where: { clientId, status: "APPROVED" }, orderBy: { name: "asc" } }),
      prisma.broadcast.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { template: true, list: true },
      }),
      // Aggregate per-recipient delivery outcomes across every send for this tenant —
      // the raw material for the deliverability funnel.
      prisma.broadcastRecipient.groupBy({
        by: ["status"],
        where: { broadcast: { clientId } },
        _count: { _all: true },
      }),
      // Campaign lifecycle states → what is live right now.
      prisma.broadcast.groupBy({
        by: ["status"],
        where: { clientId },
        _count: { _all: true },
      }),
      prisma.conversation.aggregate({ where: { clientId }, _sum: { unread: true } }),
    ]);

  // ── Delivery funnel ──────────────────────────────────────────────
  const rc: Record<RecipientStatus, number> = { PENDING: 0, SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0 };
  for (const g of recipientGroups) rc[g.status] = g._count._all;
  const read = rc.READ;
  const delivered = rc.DELIVERED + rc.READ;
  const sent = rc.SENT + rc.DELIVERED + rc.READ;
  const failed = rc.FAILED;
  const pending = rc.PENDING;
  const totalRecipients = sent + failed + pending;
  const everSent = sent > 0;

  // ── Campaign lifecycle ───────────────────────────────────────────
  const bs: Record<BroadcastStatus, number> = { DRAFT: 0, SCHEDULED: 0, QUEUED: 0, SENDING: 0, COMPLETED: 0, FAILED: 0 };
  for (const g of statusGroups) bs[g.status] = g._count._all;
  const sendingNow = bs.SENDING + bs.QUEUED;
  const scheduled = bs.SCHEDULED;
  const unread = unreadAgg._sum.unread ?? 0;

  const optedIn = contacts - optedOut;
  const optInPct = pct(optedIn, contacts);

  return (
    <>
      <Nav />
      <main className="app">
        {/* ── Command-center header: title + honest live status line ── */}
        <header className="dash-head reveal">
          <div>
            <p className="eyebrow">Command center</p>
            <h1>Dashboard</h1>
            <p className="dash-status">
              {sendingNow > 0 ? (
                <>
                  <span className="pulse-dot" aria-hidden />
                  <span>
                    <strong>{nf(sendingNow)}</strong> {plural(sendingNow, "campaign")} sending now
                  </span>
                </>
              ) : scheduled > 0 ? (
                <span>
                  <strong>{nf(scheduled)}</strong> {plural(scheduled, "campaign")} scheduled to send
                </span>
              ) : (
                <span>Nothing sending right now — all quiet.</span>
              )}
              {unread > 0 && (
                <>
                  <span className="dash-status__sep" aria-hidden>
                    ·
                  </span>
                  <Link href="/inbox" className="dash-status__link">
                    {nf(unread)} unread {plural(unread, "reply", "replies")}
                  </Link>
                </>
              )}
            </p>
          </div>
          <p className="dash-asof">Snapshot · {timeLabel(new Date())}</p>
        </header>

        {/* ── Deliverability (hero) + live pulse ── */}
        <section className="analytics reveal d1" aria-label="Deliverability">
          <div className="card">
            <div className="dash-cardhead">
              <h3>Deliverability</h3>
              <span className="note">across all sends</span>
            </div>

            {everSent ? (
              <>
                <div className="dash-rates">
                  <Rate value={`${pct(delivered, sent)}%`} label="Reached the phone" />
                  <Rate value={`${pct(read, delivered)}%`} label="Opened & read" />
                  <Rate value={`${pct(failed, totalRecipients)}%`} label="Failed" muted={failed === 0} />
                </div>
                <div className="funnel">
                  <FunnelRow label="Sent" value={sent} total={totalRecipients} accent />
                  <FunnelRow label="Delivered" value={delivered} total={totalRecipients} />
                  <FunnelRow label="Read" value={read} total={totalRecipients} />
                </div>
              </>
            ) : (
              <div className="dash-empty dash-empty--inset">
                <strong>No messages sent yet</strong>
                Your delivery funnel — sent, delivered, read — appears here after your first broadcast.
              </div>
            )}
          </div>

          <div className="card">
            <div className="dash-cardhead">
              <h3>Live now</h3>
              {sendingNow > 0 && <span className="pulse-dot" aria-hidden />}
            </div>
            <div className="dash-pulse">
              <PulseRow k="Sending" v={bs.SENDING} live={bs.SENDING > 0} />
              <PulseRow k="Queued" v={bs.QUEUED} />
              <PulseRow k="Scheduled" v={scheduled} />
              <PulseRow k="Unread replies" v={unread} href="/inbox" accent={unread > 0} />
            </div>
          </div>
        </section>

        {/* ── Audience ledger — varied band, not identical stat cards ── */}
        <section className="dash-ledger reveal d2" aria-label="Audience">
          <div className="dash-ledger__item">
            <div className="dash-ledger__num">{nf(contacts)}</div>
            <div className="dash-ledger__label">Contacts</div>
            {contacts > 0 && (
              <>
                <div className="dash-ledger__meter" aria-hidden>
                  <i style={{ width: `${optInPct}%` }} />
                </div>
                <div className="dash-ledger__sub">
                  {optInPct}% opted in · {nf(optedOut)} opted out
                </div>
              </>
            )}
          </div>
          <div className="dash-ledger__item">
            <div className="dash-ledger__num">{nf(lists.length)}</div>
            <div className="dash-ledger__label">Lists</div>
            <Link href="/lists" className="dash-ledger__sub dash-ledger__sub--link">
              Manage lists →
            </Link>
          </div>
          <div className="dash-ledger__item">
            <div className="dash-ledger__num">{nf(templates.length)}</div>
            <div className="dash-ledger__label">Approved templates</div>
            <Link href="/templates" className="dash-ledger__sub dash-ledger__sub--link">
              View templates →
            </Link>
          </div>
        </section>

        {/* ── Compose — the three core actions, kept intact ── */}
        <section className="dash-section reveal d3">
          <p className="eyebrow">Compose</p>
          <h2>Build a list, import contacts, send</h2>
        </section>
        <section className="grid-forms reveal d3">
          <NewListForm />
          <UploadForm lists={lists} />
          <BroadcastForm lists={lists} templates={templates} />
        </section>

        {/* ── Recent broadcasts ── */}
        <section className="dash-section reveal d4">
          <h2>Recent broadcasts</h2>
        </section>
        <div className="card reveal d4" style={{ padding: 0, overflow: "hidden" }}>
          <table data-test-id="broadcasts-table" className="table dash-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>List</th>
                <th>Status</th>
                <th>Delivery</th>
                <th>Failed</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => {
                const progress = pct(b.sentCount, b.totalCount);
                const when =
                  b.status === "SCHEDULED" && b.scheduledAt
                    ? `Scheduled ${dateLabel(b.scheduledAt)}`
                    : rel(b.createdAt);
                return (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/broadcasts/${b.id}`} data-test-id="broadcast-link" className="dash-table__tpl">
                        {b.template.name}
                      </Link>
                    </td>
                    <td className="muted">{b.list.name}</td>
                    <td>
                      <span className={`badge badge--${b.status}`}>{b.status}</span>
                    </td>
                    <td>
                      <div className="dash-prog">
                        <span className="dash-prog__track" aria-hidden>
                          <span className="dash-prog__bar" style={{ width: `${progress}%` }} />
                        </span>
                        <span className="dash-prog__num">
                          {nf(b.sentCount)}/{nf(b.totalCount)}
                        </span>
                      </div>
                    </td>
                    <td className={b.failedCount > 0 ? "dash-fail" : "muted"}>{nf(b.failedCount)}</td>
                    <td className="muted dash-table__when">{when}</td>
                  </tr>
                );
              })}
              {broadcasts.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="dash-empty">
                      <strong>No broadcasts yet</strong>
                      Pick a template and a list above, then send — your sends will show up here with live delivery.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

/* ── server-rendered presentational helpers ── */

function Rate({ value, label, muted }: { value: string; label: string; muted?: boolean }) {
  return (
    <div className="dash-rate">
      <div className={`dash-rate__val${muted ? " dash-rate__val--muted" : ""}`}>{value}</div>
      <div className="dash-rate__label">{label}</div>
    </div>
  );
}

function FunnelRow({ label, value, total, accent }: { label: string; value: number; total: number; accent?: boolean }) {
  const w = pct(value, total);
  return (
    <div className="funnel__row">
      <span className="funnel__label">{label}</span>
      <span className="funnel__track">
        <span className={`funnel__bar${accent ? " funnel__bar--accent" : ""}`} style={{ width: `${w}%` }} />
      </span>
      <span className="funnel__val">
        {nf(value)} · {w}%
      </span>
    </div>
  );
}

function PulseRow({ k, v, live, accent, href }: { k: string; v: number; live?: boolean; accent?: boolean; href?: string }) {
  const val = (
    <span className={`dash-pulse__v${accent && v > 0 ? " dash-pulse__v--accent" : ""}`}>{nf(v)}</span>
  );
  return (
    <div className="dash-pulse__row">
      <span className="dash-pulse__k">
        {live && <span className="pulse-dot" aria-hidden />}
        {k}
      </span>
      {href && v > 0 ? <Link href={href}>{val}</Link> : val}
    </div>
  );
}

/* ── pure formatters ── */

function nf(n: number): string {
  return n.toLocaleString("en-US");
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function plural(n: number, one: string, many?: string): string {
  return n === 1 ? one : many ?? `${one}s`;
}

function rel(date: Date): string {
  const m = Math.round((Date.now() - date.getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return dateLabel(date);
}

function dateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
