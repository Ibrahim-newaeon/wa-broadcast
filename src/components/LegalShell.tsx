import Link from "next/link";

// Shared frame for the public legal pages (privacy, terms, data deletion).
// English-only by design: Meta App Review reads these, and a single canonical
// text avoids translation drift on legal wording.
export const LEGAL = {
  company: "NazzilVideo",
  service: "Broadcast Hub",
  contactEmail: "abd.rabo.940@gmail.com",
} as const;

export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="dk">
      <div className="legal">
        <Link className="legal__back" href="/">← {LEGAL.service}</Link>
        <h1>{title}</h1>
        <p className="legal__updated">Last updated: {updated}</p>
        {children}
      </div>
    </main>
  );
}
