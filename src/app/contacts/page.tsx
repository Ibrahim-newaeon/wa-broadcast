import Nav from "@/components/Nav";
import ContactsTable from "@/components/ContactsTable";
import AddContactForm from "@/components/AddContactForm";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const lists = await prisma.contactList.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <Nav />
      <main className="app">
        <h1>Contacts</h1>
        <p className="note" style={{ marginBottom: 16 }}>
          Add a contact, search, opt out / re-subscribe, or delete. Opt-outs are excluded from every broadcast.
        </p>
        <section className="grid-forms" style={{ marginBottom: 16 }}>
          <AddContactForm lists={lists} />
        </section>
        <div className="card">
          <ContactsTable />
        </div>
      </main>
    </>
  );
}
