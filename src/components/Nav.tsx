import Link from "next/link";
import LogoutButton from "./LogoutButton";

/** Brand wordmark + primary nav (3 links, per the design system). */
export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/" className="brand" aria-label="Broadcast Console home">
        <span className="mark" aria-hidden />
        <span><span className="b1">broadcast</span><span className="b2">console</span></span>
      </Link>
      <div className="nav__links">
        <Link href="/">Dashboard</Link>
        <Link href="/contacts">Contacts</Link>
        <Link href="/campaigns">Campaigns</Link>
        <Link href="/settings">Settings</Link>
        <LogoutButton />
      </div>
    </nav>
  );
}
