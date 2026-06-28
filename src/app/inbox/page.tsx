import Nav from "@/components/Nav";
import InboxClient from "@/components/InboxClient";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  return (
    <>
      <Nav />
      <main className="app">
        <h1>Inbox</h1>
        <p className="note" style={{ marginBottom: 16 }}>
          Two-way conversations. Reply within 24 hours of a contact&apos;s message; after that, send an approved template to re-open.
        </p>
        <InboxClient />
      </main>
    </>
  );
}
