import Nav from "@/components/Nav";
import UsersManager from "@/components/UsersManager";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <Nav />
      <main className="app">
        <h1>Settings</h1>
        <h2>Team members</h2>
        <UsersManager />
      </main>
    </>
  );
}
