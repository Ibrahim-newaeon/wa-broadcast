import Link from "next/link";
import { prisma } from "@/lib/db";
import Nav from "@/components/Nav";
import UploadForm from "@/components/UploadForm";
import NewListForm from "@/components/NewListForm";
import BroadcastForm from "@/components/BroadcastForm";
import { getClientIdFromCookies } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const clientId = await getClientIdFromCookies();
  const [contacts, optedOut, lists, templates, broadcasts] = await Promise.all([
    prisma.contact.count({ where: { clientId } }),
    prisma.contact.count({ where: { clientId, optedOut: true } }),
    prisma.contactList.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
    prisma.template.findMany({ where: { clientId, status: "APPROVED" }, orderBy: { name: "asc" } }),
    prisma.broadcast.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { template: true, list: true },
    }),
  ]);

  return (
    <>
      <Nav />
      <main className="app">
        <h1>Dashboard</h1>

        <section className="stats">
          <Stat label="Contacts" value={contacts} />
          <Stat label="Opted out" value={optedOut} />
          <Stat label="Lists" value={lists.length} />
          <Stat label="Templates" value={templates.length} />
        </section>

        <section className="grid-forms">
          <NewListForm />
          <UploadForm lists={lists} />
          <BroadcastForm lists={lists} templates={templates} />
        </section>

        <h2>Recent broadcasts</h2>
        <table data-test-id="broadcasts-table" className="table">
          <thead>
            <tr><th>Template</th><th>List</th><th>Status</th><th>Sent</th><th>Failed</th><th>Total</th><th>Scheduled</th></tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => (
              <tr key={b.id}>
                <td><Link href={`/broadcasts/${b.id}`} data-test-id="broadcast-link">{b.template.name}</Link></td>
                <td>{b.list.name}</td>
                <td><span className={`badge badge--${b.status}`}>{b.status}</span></td>
                <td>{b.sentCount}</td>
                <td>{b.failedCount}</td>
                <td>{b.totalCount}</td>
                <td className="muted">{b.scheduledAt ? new Date(b.scheduledAt).toLocaleString() : "—"}</td>
              </tr>
            ))}
            {broadcasts.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ padding: 16 }}>No broadcasts yet.</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="stat__num">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}
