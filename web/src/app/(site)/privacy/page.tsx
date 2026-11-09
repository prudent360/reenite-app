import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/site/legal-page";
import { hq, legalEntity } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Reenite collects, uses, shares and protects your personal data, and your rights under the Nigeria Data Protection Act 2023.",
};

const company = legalEntity.rcNumber ? `${legalEntity.name} (RC ${legalEntity.rcNumber})` : legalEntity.name;
const email = <a href={`mailto:${legalEntity.email}`}>{legalEntity.email}</a>;

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          {company} provides business registration, tax compliance, online presence, virtual address and workspace services from {hq.street},{" "}
          {hq.city}, {hq.state}. We decide how and why your personal data is used, which makes us the data controller under the Nigeria Data
          Protection Act 2023 (NDPA).
        </p>
        <p>
          Questions about your data can go to {email}, to {hq.phone}, or by post to our office.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <p>We only collect what we need to do the work you ask for:</p>
        <ul>
          <li>
            <strong>Your account:</strong> your name, email address, phone number and password (stored scrambled, so nobody at Reenite can read it).
          </li>
          <li>
            <strong>Your business:</strong> proposed and registered names, addresses, business activity, share details, and the names, contact
            details and ID numbers of directors, shareholders, trustees and secretaries.
          </li>
          <li>
            <strong>Documents you upload:</strong> means of identification, passport photographs, signatures, proof of address and similar
            documents an agency asks for.
          </li>
          <li>
            <strong>Payments:</strong> invoices, amounts, payment references and bank transfer receipts. Card details go straight to the payment
            provider and never reach our systems.
          </li>
          <li>
            <strong>Bookings:</strong> the space, date and time you book and, if you book without an account, your name, email and phone.
          </li>
          <li>
            <strong>Agreements you sign online:</strong> the name you sign with, the time, your IP address and a fingerprint of the document.
          </li>
          <li>
            <strong>Messages:</strong> what you send your legal expert through your dashboard, WhatsApp or email.
          </li>
          <li>
            <strong>Security information:</strong> when you sign in, failed sign-in attempts, your IP address and the type of browser you used.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How we use it, and why we are allowed to",
    body: (
      <ul>
        <li>
          <strong>To deliver the services you order</strong>, such as preparing and submitting your filings, booking your space and sending your
          certificates. This is needed to perform our contract with you.
        </li>
        <li>
          <strong>To meet our legal duties</strong>, including tax records and the anti-money-laundering checks that apply to some registrations.
        </li>
        <li>
          <strong>To keep accounts and payments safe</strong>, for example by limiting repeated sign-in attempts and keeping a record of changes our
          staff make. This is in our legitimate interest and yours.
        </li>
        <li>
          <strong>To remind you about deadlines and bookings</strong> connected to services you use with us.
        </li>
        <li>
          <strong>To send news and offers</strong>, only if you have agreed to receive them. You can stop them at any time.
        </li>
      </ul>
    ),
  },
  {
    id: "who-we-share-with",
    title: "Who we share it with",
    body: (
      <>
        <p>We never sell your data. We share it only where the work requires it:</p>
        <ul>
          <li>
            <strong>Government agencies</strong> we file with on your behalf, such as the Corporate Affairs Commission (CAC), the Federal Inland
            Revenue Service, state internal revenue services, SCUML and the trademarks registry.
          </li>
          <li>
            <strong>Payment providers</strong> (Paystack, Flutterwave or Stripe, depending on how you pay), who process your payment.
          </li>
          <li>
            <strong>Companies that run parts of our service</strong>, such as website and server hosting, email delivery and file storage. They may
            only use your data to provide that service to us.
          </li>
          <li>
            <strong>Professional advisers and authorities</strong> where the law requires it, or to protect our rights in a dispute.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "international-transfers",
    title: "Data stored outside Nigeria",
    body: (
      <p>
        Some of the providers above store or process data outside Nigeria. When that happens we use providers that protect it to a standard at
        least as high as the NDPA requires, through contracts and security measures, as Part VIII of the Act allows.
      </p>
    ),
  },
  {
    id: "how-long",
    title: "How long we keep it",
    body: (
      <ul>
        <li>
          <strong>Your account, orders, documents and payments:</strong> for as long as your account is open, then for as long as Nigerian law
          requires us to keep business and tax records, usually six years.
        </li>
        <li>
          <strong>Guest bookings:</strong> two years after the booking.
        </li>
        <li>
          <strong>Sign-in and staff activity records:</strong> one year.
        </li>
        <li>
          <strong>Backups:</strong> overwritten on a rolling basis within weeks.
        </li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <p>
        Your data travels over encrypted connections. Uploaded documents are kept in private storage that only you, your assigned legal expert and
        the staff who need it can open. Payment keys are encrypted, staff accounts have only the access their role needs, and every change made in our
        admin system is recorded. No system is perfectly secure; if a breach affects your data, we will tell you and the Nigeria Data Protection
        Commission as the law requires.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>Under the NDPA you can ask us to:</p>
        <ul>
          <li>give you a copy of the personal data we hold about you;</li>
          <li>correct anything that is wrong or incomplete;</li>
          <li>delete your data, where we no longer need it or the law doesn&apos;t require us to keep it;</li>
          <li>limit or stop how we use it, or object to a use based on our legitimate interests;</li>
          <li>send your data to you or another provider in a common format;</li>
          <li>withdraw your consent, for example to marketing messages.</li>
        </ul>
        <p>
          Email {email} and we will reply within 30 days. If you are unhappy with our answer, you can complain to the Nigeria Data Protection
          Commission at{" "}
          <a href="https://ndpc.gov.ng" target="_blank" rel="noreferrer">
            ndpc.gov.ng
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <>
        <p>We keep cookies to a minimum and use no advertising or tracking cookies:</p>
        <ul>
          <li>
            <strong>A sign-in cookie</strong> keeps you signed in to your dashboard. The site cannot work without it.
          </li>
          <li>
            <strong>A light or dark mode setting</strong> is saved in your browser so the site remembers your choice.
          </li>
          <li>
            <strong>Google Maps</strong> on our contact page is provided by Google, which may set its own cookies when the map loads.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Our services are for people aged 18 and over. We do not knowingly collect data from children.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        If we change this policy we will update the date at the top of this page, and tell you by email if the change is significant. See also our{" "}
        <Link href="/terms">terms of service</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated={legalEntity.lastUpdated}
      intro={
        <p>
          When you register a business with us, you trust us with personal details and documents. This policy explains, in plain language, what we
          collect, why, who sees it and what you can ask us to do with it.
        </p>
      }
      sections={sections}
    />
  );
}
