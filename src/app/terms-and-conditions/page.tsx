import type { Metadata } from "next";
import Link from "next/link";
import LegalShell, { LEGAL } from "@/components/LegalShell";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: `Terms & Conditions — ${LEGAL.service}`,
  description: `The terms that govern use of ${LEGAL.service}, the WhatsApp messaging platform operated by ${LEGAL.company}.`,
};

const UPDATED = "July 2, 2026";

export default function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions" updated={UPDATED}>
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using {LEGAL.service} (the &quot;Service&quot;), operated by{" "}
          {LEGAL.company} (&quot;we&quot;, &quot;us&quot;), you agree to these Terms. If you use
          the Service on behalf of a business, you represent that you are authorized to bind that
          business.
        </p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>
          The Service lets businesses send approved WhatsApp template messages to opted-in
          contact lists, track delivery in real time, run scheduled and recurring campaigns, and
          reply to customers in a two-way inbox — all over Meta&apos;s WhatsApp Cloud API. The
          Service is not affiliated with, endorsed by, or sponsored by Meta or WhatsApp.
        </p>
      </section>

      <section>
        <h2>3. Eligibility</h2>
        <p>
          You must be at least 18 years old and able to enter a binding contract. You must also
          comply with Meta&apos;s{" "}
          <a href="https://www.whatsapp.com/legal/business-terms" target="_blank" rel="noopener noreferrer">
            WhatsApp Business Terms
          </a>{" "}
          and{" "}
          <a href="https://business.whatsapp.com/policy" target="_blank" rel="noopener noreferrer">
            WhatsApp Business Messaging Policy
          </a>.
        </p>
      </section>

      <section>
        <h2>4. Account Connection and Credentials</h2>
        <ul>
          <li>You connect your own WhatsApp Business Account by providing Meta credentials in Settings. You are responsible for the validity and permissions of those credentials.</li>
          <li>You are responsible for safeguarding your login credentials and for all activity in your workspace, including activity by team members you invite.</li>
          <li>We store your credentials to operate the integration and never use them for any purpose other than providing the Service.</li>
        </ul>
      </section>

      <section>
        <h2>5. Acceptable Use</h2>
        <p>You agree NOT to use the Service to:</p>
        <ul>
          <li>Message people who have not given you prior opt-in consent, or continue messaging anyone who has opted out.</li>
          <li>Send spam, scams, or deceptive, harassing, or illegal content.</li>
          <li>Violate Meta&apos;s WhatsApp Business Messaging Policy, Commerce Policy, or any applicable law (including data protection and anti-spam laws).</li>
          <li>Upload contact data you do not have the legal right to use.</li>
          <li>Probe, disrupt, or attempt to gain unauthorized access to the Service or other customers&apos; workspaces.</li>
        </ul>
        <p>
          The Service enforces opt-outs automatically (Recipients can reply STOP), and you must
          not attempt to circumvent that mechanism. We may suspend or terminate accounts that
          violate this section.
        </p>
      </section>

      <section>
        <h2>6. Intellectual Property</h2>
        <p>
          We retain all rights in the Service, its software, and branding. You retain all rights
          in the content and contact data you upload; you grant us a limited license to process
          it solely to provide the Service. WhatsApp and Meta are trademarks of Meta Platforms, Inc.
        </p>
      </section>

      <section>
        <h2>7. Fees and Billing</h2>
        <p>
          Fees for the Service, if any, are agreed with you separately in writing. Meta charges
          for WhatsApp conversations directly under your own Meta billing; those charges are
          between you and Meta and are not collected by us.
        </p>
      </section>

      <section>
        <h2>8. Disclaimers</h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without
          warranties of any kind. We do not guarantee that messages will be delivered, that
          templates will be approved by Meta, or that the Service will be uninterrupted or
          error-free. Message delivery ultimately depends on Meta&apos;s platform and the
          Recipient&apos;s device.
        </p>
      </section>

      <section>
        <h2>9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, {LEGAL.company} is not liable for indirect,
          incidental, special, consequential, or punitive damages, or for lost profits, revenue,
          or data. Our total liability for any claim arising from the Service is limited to the
          amount you paid us for the Service in the 12 months preceding the claim.
        </p>
      </section>

      <section>
        <h2>10. Termination</h2>
        <p>
          You may stop using the Service at any time and request deletion of your data (see{" "}
          <Link href="/data-deletion">Data Deletion Instructions</Link>). We may suspend or
          terminate access for breach of these Terms, for violation of Meta policies, or where
          required by law. Sections 6, 8, 9, and 12 survive termination.
        </p>
      </section>

      <section>
        <h2>11. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Changes will be posted on this page with
          an updated &quot;Last updated&quot; date; material changes will be communicated through
          the Service or by email. Continued use after changes take effect constitutes acceptance.
        </p>
      </section>

      <section>
        <h2>12. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the jurisdiction in which {LEGAL.company} is
          established, without regard to conflict-of-law rules. Disputes will be resolved in the
          courts of that jurisdiction unless applicable law provides otherwise.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>
          Questions about these Terms: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
        </p>
      </section>
    </LegalShell>
  );
}
