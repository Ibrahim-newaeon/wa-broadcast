import type { Metadata } from "next";
import Link from "next/link";
import LegalShell, { LEGAL } from "@/components/LegalShell";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `Privacy Policy — ${LEGAL.service}`,
  description: `How ${LEGAL.service} collects, uses, stores, and protects information when you connect your WhatsApp Business Account and message your customers.`,
};

const UPDATED = "July 2, 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalShell title="Privacy Policy" updated={UPDATED}>
      <section>
        <h2>1. Introduction</h2>
        <p>
          {LEGAL.company} (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates {LEGAL.service} (the
          &quot;Service&quot;), a WhatsApp messaging platform built on Meta&apos;s WhatsApp Cloud API.
          This Privacy Policy explains what information we collect, how we use it, with whom we
          share it, and the rights you have over it. It applies to businesses that use the Service
          to message their customers (&quot;Customers&quot;) and to the individuals those messages
          reach (&quot;Recipients&quot;).
        </p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>
        <p><strong>Information Customers provide</strong></p>
        <ul>
          <li>Account details: business name, email address, and login credentials (passwords are stored only as salted hashes).</li>
          <li>WhatsApp Business Account credentials: phone number ID, WhatsApp Business Account (WABA) ID, Meta app ID, access token, and app secret, entered in Settings to connect the Service to Meta.</li>
          <li>Contact lists: names, phone numbers, and optional attributes of Recipients that Customers upload or add, along with the Customer&apos;s confirmation that those Recipients opted in.</li>
        </ul>
        <p><strong>Messaging data</strong></p>
        <ul>
          <li>Message metadata received from Meta via webhook: message IDs, timestamps, delivery/read status, and recipient phone numbers.</li>
          <li>Message content sent and received through the Service, stored to power the two-way inbox and campaign history.</li>
          <li>Opt-out requests (e.g. a Recipient replying STOP), which we record and honor automatically.</li>
        </ul>
        <p><strong>Technical data</strong></p>
        <ul>
          <li>IP addresses and usage logs, including an audit trail of account actions.</li>
          <li>Local preferences such as language and theme, stored in your browser via localStorage.</li>
          <li>Details submitted through our public lead form (name, WhatsApp number, business name).</li>
        </ul>
      </section>

      <section>
        <h2>3. How We Use Information</h2>
        <ul>
          <li>To operate the Service: authenticate users, send WhatsApp template and session messages Customers initiate, and track delivery.</li>
          <li>To receive and display inbound messages and delivery events from Meta.</li>
          <li>To honor Recipient opt-outs across all future sends.</li>
          <li>To maintain security, prevent abuse, and keep an audit trail of account actions.</li>
          <li>To respond to inquiries submitted through the lead form.</li>
          <li>To comply with legal obligations and Meta platform requirements.</li>
        </ul>
      </section>

      <section>
        <h2>4. Legal Bases (GDPR)</h2>
        <p>
          Where the GDPR or similar laws apply, we process personal data on these legal bases:
          (a) performance of our contract with the Customer; (b) consent, where required —
          Customers are responsible for collecting Recipient opt-in before messaging them;
          (c) our legitimate interests in operating and securing the Service; and (d) compliance
          with legal obligations.
        </p>
      </section>

      <section>
        <h2>5. How We Share Information</h2>
        <p>We do not sell personal data. We share information only with:</p>
        <ul>
          <li><strong>Meta / WhatsApp</strong> — as required to send messages and operate the WhatsApp Cloud API integration, under Meta&apos;s own terms.</li>
          <li><strong>Infrastructure providers</strong> — hosting, database, and queue vendors (currently Railway) that process data under our instructions.</li>
          <li><strong>Legal authorities</strong> — when required by law or to protect rights and safety.</li>
          <li><strong>Successors</strong> — in a merger, acquisition, or asset sale, with notice.</li>
        </ul>
        <p>
          The Service is multi-tenant: each Customer&apos;s workspace is isolated, and one
          Customer&apos;s contacts, messages, and credentials are never visible to another.
        </p>
      </section>

      <section>
        <h2>6. Data Security</h2>
        <p>
          Transport is protected by TLS. Passwords are hashed with bcrypt. WhatsApp credentials
          are write-only in the interface once saved, and webhook deliveries are verified with
          HMAC signatures. Access to production systems is limited and role-based, and
          consequential account actions are recorded in an audit log. No method of transmission
          or storage is 100% secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section>
        <h2>7. Data Retention</h2>
        <ul>
          <li>WhatsApp credentials are retained while the Customer&apos;s integration is active and deleted when the workspace is removed.</li>
          <li>Contacts, messages, and campaign history are retained until the Customer deletes them or their workspace is removed.</li>
          <li>Opt-out records are retained so that opted-out Recipients are never messaged again.</li>
          <li>Audit logs are retained for accountability while the workspace exists.</li>
          <li>Account records may be retained after closure where required for tax and legal compliance.</li>
        </ul>
      </section>

      <section>
        <h2>8. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate data.</li>
          <li>Request deletion of your data (see our <Link href="/data-deletion">Data Deletion Instructions</Link>).</li>
          <li>Object to or restrict processing, and withdraw consent.</li>
          <li>Lodge a complaint with your local data protection authority.</li>
        </ul>
        <p>
          Recipients can stop receiving messages at any time by replying <strong>STOP</strong>;
          the opt-out is applied automatically. To exercise any other right, email{" "}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
        </p>
      </section>

      <section>
        <h2>9. International Transfers</h2>
        <p>
          Your data may be processed in countries other than the one in which you reside. Where
          required, we rely on appropriate safeguards such as Standard Contractual Clauses.
        </p>
      </section>

      <section>
        <h2>10. Children&apos;s Privacy</h2>
        <p>
          The Service is not directed to children under 18 and we do not knowingly collect their
          personal data. If you believe a child has provided us with personal data, contact us
          and we will delete it.
        </p>
      </section>

      <section>
        <h2>11. Changes to This Policy</h2>
        <p>
          Changes will be posted on this page with an updated &quot;Last updated&quot; date.
          Material changes will be communicated through the Service or by email.
        </p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>
          Privacy inquiries: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
        </p>
      </section>
    </LegalShell>
  );
}
