import { prisma } from "@/lib/db";
import Nav from "@/components/Nav";
import CampaignsManager from "@/components/CampaignsManager";
import { getClientIdFromCookies } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const clientId = await getClientIdFromCookies();
  const [lists, templates] = await Promise.all([
    prisma.contactList.findMany({ where: { clientId, archived: false }, orderBy: { createdAt: "desc" } }),
    prisma.template.findMany({ where: { clientId, status: "APPROVED" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <Nav />
      <main className="app">
        <h1>Recurring campaigns</h1>
        <p className="note" style={{ marginBottom: 16 }}>
          Drip/recurring sends. Each tick creates a fresh broadcast from the template + list, honoring opt-outs. Schedules run in UTC.
        </p>
        <CampaignsManager lists={lists} templates={templates} />
      </main>
    </>
  );
}
