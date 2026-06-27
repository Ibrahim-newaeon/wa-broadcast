import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Nav from "@/components/Nav";
import LiveProgress from "@/components/LiveProgress";

export const dynamic = "force-dynamic";

export default async function BroadcastDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const b = await prisma.broadcast.findUnique({
    where: { id },
    include: { template: true, list: true },
  });
  if (!b) notFound();

  return (
    <>
      <Nav />
      <main className="app">
        <Link href="/dashboard" className="muted" style={{ fontSize: 13 }}>← Back to dashboard</Link>
        <h1>
          {b.template.name} <span className="muted" style={{ fontSize: 16, fontWeight: 400 }}>→ {b.list.name}</span>
        </h1>
        <p className="note">
          {b.scheduledAt ? `Scheduled for ${b.scheduledAt.toLocaleString()} · ` : ""}
          {b.startedAt ? `Started ${b.startedAt.toLocaleString()} · ` : ""}
          {b.completedAt ? `Completed ${b.completedAt.toLocaleString()}` : "in progress"}
        </p>

        <LiveProgress
          broadcastId={b.id}
          initialStatus={b.status}
          initialCounts={{ total: b.totalCount, sent: b.sentCount, failed: b.failedCount }}
        />
      </main>
    </>
  );
}
