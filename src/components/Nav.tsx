import Link from "next/link";
import LogoutButton from "./LogoutButton";
import ClientSwitcher from "./ClientSwitcher";

/** Brand wordmark + primary nav (3 links, per the design system). */
export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/dashboard" className="brand" aria-label="Broadcast Console home">
        <span className="mark" aria-hidden />
        <span><span className="b1">broadcast</span><span className="b2">console</span></span>
      </Link>
      <div className="nav__links">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/contacts">Contacts</Link>
        <Link href="/lists">Lists</Link>
        <Link href="/templates">Templates</Link>
        <Link href="/campaigns">Campaigns</Link>
        <Link href="/settings">Settings</Link>
        <ClientSwitcher />
        <LogoutButton />
      </div>
    </nav>
  );
}
