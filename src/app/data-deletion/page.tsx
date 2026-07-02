import type { Metadata } from "next";
import Link from "next/link";
import LegalShell, { LEGAL } from "@/components/LegalShell";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `Data Deletion Instructions — ${LEGAL.service}`,
  description: `How to request deletion of your data and disconnect your WhatsApp Business Account from ${LEGAL.service}.`,
};

const UPDATED = "July 2, 2026";

export default function DataDeletionPage() {
  return (
    <LegalShell title="Data Deletion Instructions" updated={UPDATED}>
      <section>
        <p>
          This page explains how to request deletion of your data and disconnect your WhatsApp
          Business Account (WABA) from {LEGAL.service}, operated by {LEGAL.company}. We comply
          with Meta&apos;s Platform Terms and applicable privacy laws, including the GDPR.
        </p>
      </section>

      <section>
        <h2>If you are a business customer</h2>
        <p><strong>Option 1 — Revoke access from Meta Business Manager</strong></p>
        <ol>
          <li>
            Sign in to{" "}
            <a href="https://business.facebook.com/settings/" target="_blank" rel="noopener noreferrer">
              Meta Business Manager Settings
            </a>.
          </li>
          <li>Select the Business Portfolio that contains your WhatsApp Business Account.</li>
          <li>Under <strong>System users</strong> or <strong>Business apps</strong>, remove the access token or integration used with {LEGAL.service}.</li>
          <li>Meta invalidates the token immediately, and the Service can no longer send or receive on your behalf.</li>
        </ol>
        <p><strong>Option 2 — Email us a deletion request</strong></p>
        <p>
          Email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> from the address
          associated with your account, with the subject &quot;Data deletion request&quot;.
          We will verify your identity, then permanently delete your workspace: contacts, lists,
          messages, campaign history, templates cache, stored credentials, and team logins.
          We confirm completion by email within 30 days.
        </p>
      </section>

      <section>
        <h2>If you received messages from a business using this Service</h2>
        <ul>
          <li>
            Reply <strong>STOP</strong> to the WhatsApp conversation at any time. The opt-out is
            recorded automatically and the business cannot message you through the Service again.
          </li>
          <li>
            To request deletion of your phone number and message history held for a specific
            business, contact that business directly — they control their contact lists — or
            email us at <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> and we
            will process the request with them.
          </li>
        </ul>
      </section>

      <section>
        <h2>What is deleted, and what is retained</h2>
        <ul>
          <li>Deletion removes contacts, messages, campaign history, templates, credentials, and logins for the workspace.</li>
          <li>Opt-out records may be retained where needed to keep honoring an opt-out.</li>
          <li>Records we are legally required to keep (e.g. for tax compliance) are retained only as long as the law requires.</li>
        </ul>
      </section>

      <section>
        <h2>Related pages</h2>
        <p>
          See our <Link href="/privacy-policy">Privacy Policy</Link> for full details on what we
          collect and why, and our <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>{" "}
          for the rules that govern the Service.
        </p>
      </section>
    </LegalShell>
  );
}
