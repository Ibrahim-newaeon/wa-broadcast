import Nav from "@/components/Nav";
import UsersManager from "@/components/UsersManager";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import WhatsAppSetup from "@/components/WhatsAppSetup";
import ClientsManager from "@/components/ClientsManager";
import RedirectsManager from "@/components/RedirectsManager";
import AuditLogViewer from "@/components/AuditLogViewer";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <Nav />
      <main className="app">
        <h1>Settings</h1>
        {/* SUPERADMIN-only; renders nothing for regular users. */}
        <ClientsManager />
        <h2 style={{ marginTop: 32 }}>WhatsApp connection</h2>
        <WhatsAppSetup />
        <h2 style={{ marginTop: 32 }}>Team members</h2>
        <UsersManager />
        <h2 id="my-account" className="anchor-target" style={{ marginTop: 32 }}>My account</h2>
        <div className="grid-forms">
          <ChangePasswordForm />
        </div>
        {/* Both ADMIN-only; render nothing (including their headings) for members. */}
        <RedirectsManager />
        <AuditLogViewer />
      </main>
    </>
  );
}
