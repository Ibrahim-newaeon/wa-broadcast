import Nav from "@/components/Nav";
import UsersManager from "@/components/UsersManager";
import WhatsAppSetup from "@/components/WhatsAppSetup";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <Nav />
      <main className="app">
        <h1>Settings</h1>
        <h2>WhatsApp connection</h2>
        <WhatsAppSetup />
        <h2 style={{ marginTop: 32 }}>Team members</h2>
        <UsersManager />
      </main>
    </>
  );
}
