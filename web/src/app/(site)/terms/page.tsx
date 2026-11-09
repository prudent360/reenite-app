import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/site/legal-page";
import { hq, legalEntity } from "@/content/site";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms that apply when you use Reenite's business registration, tax, online presence, virtual address and workspace services.",
};

const company = legalEntity.rcNumber ? `${legalEntity.name} (RC ${legalEntity.rcNumber})` : legalEntity.name;
const email = <a href={`mailto:${legalEntity.email}`}>{legalEntity.email}</a>;

const sections: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: (
      <p>
        These terms are an agreement between you and {company}, of {hq.street}, {hq.city}, {hq.state} (&quot;Reenite&quot;, &quot;we&quot;). They
        apply when you create an account, order a service, book a space or buy a plan. By doing any of those you accept them. Our{" "}
        <Link href="/privacy">privacy policy</Link> explains how we handle your data.
      </p>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <ul>
        <li>You must be 18 or over and give us accurate details.</li>
        <li>Keep your password private. You are responsible for what happens in your account until you tell us it has been misused.</li>
        <li>We may suspend an account that is used for fraud, misuse or anything unlawful.</li>
      </ul>
    ),
  },
  {
    id: "services",
    title: "How our services work",
    body: (
      <>
        <p>
          We do the filing for you. When you order a service, you authorise Reenite to prepare and submit applications to the relevant agencies on
          your behalf, using the information and documents you give us.
        </p>
        <p>You confirm that:</p>
        <ul>
          <li>the information and documents you provide are true, complete and yours to share;</li>
          <li>you have permission from every director, shareholder, trustee or other person whose details you give us;</li>
          <li>the business you are registering is lawful.</li>
        </ul>
        <p>
          Approvals are decided by the agencies, not by us. We cannot guarantee that a name will be approved or an application accepted, but we will
          tell you what went wrong and help you fix it.
        </p>
      </>
    ),
  },
  {
    id: "prices",
    title: "Prices and payment",
    body: (
      <ul>
        <li>
          Each service shows our <strong>service fee</strong> and the <strong>government fees</strong> separately before you pay. We pay the government
          fees to the agency on your behalf.
        </li>
        <li>Work starts once your payment is confirmed. Bank transfers are confirmed after our finance team checks the receipt.</li>
        <li>We may change our prices, but never for an order you have already paid for.</li>
        <li>If an agency raises its fees after you pay, we will tell you before paying the difference on your behalf.</li>
      </ul>
    ),
  },
  {
    id: "turnaround",
    title: "Turnaround times and your part",
    body: (
      <>
        <p>
          The turnaround shown for each service is our usual time in working days, not a guarantee. Agency delays, public holidays and system outages
          are outside our control. You can follow every step in your dashboard.
        </p>
        <p>
          Please reply to requests for information or documents promptly. While we are waiting on you, the timeline for your order is paused.
        </p>
      </>
    ),
  },
  {
    id: "cancellations",
    title: "Cancellations and refunds",
    body: (
      <ul>
        <li>
          <strong>Before you pay:</strong> you can cancel an order at any time from your dashboard, at no cost.
        </li>
        <li>
          <strong>After you pay, before we start:</strong> we refund the full amount.
        </li>
        <li>
          <strong>After we have filed with an agency:</strong> government fees cannot be refunded, because the agency has received them. We refund the
          part of our service fee for work not yet done.
        </li>
        <li>Refunds go back to the way you paid, usually within 14 working days.</li>
      </ul>
    ),
  },
  {
    id: "workspace",
    title: "Workspace bookings, passes and memberships",
    body: (
      <ul>
        <li>The cancellation policy shown when you book a space applies to that booking, and you see it before you pay.</li>
        <li>Please arrive and leave within your booked time and follow the house rules shared at the front desk.</li>
        <li>You are responsible for damage you or your guests cause to the space or equipment.</li>
        <li>Passes and memberships are personal, cannot be transferred and end at the close of their period unless you renew.</li>
      </ul>
    ),
  },
  {
    id: "virtual-address",
    title: "Virtual address",
    body: (
      <p>
        A virtual address lets you use our address for your business and receive mail there, as described in your plan. It may only be used for
        lawful business. If your plan ends, you must stop using the address, including updating it with CAC where it was registered, and we may
        return or refuse mail that arrives afterwards.
      </p>
    ),
  },
  {
    id: "e-signatures",
    title: "Signing documents online",
    body: (
      <p>
        When you sign an agreement in your dashboard, you agree that your electronic signature is as binding as one on paper, as the Evidence Act
        2011 allows. We keep the signed copy, the time, your IP address and a fingerprint of the document as a record.
      </p>
    ),
  },
  {
    id: "ownership",
    title: "Websites, logos and other work we create",
    body: (
      <p>
        Once you have paid in full, the logos, brand kits and website designs we make for you belong to you, except for fonts, stock images, themes
        and software that belong to others and come with their own licences. We may show the work in our portfolio unless you ask us not to.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Our responsibility to you",
    body: (
      <>
        <p>
          We do our work with reasonable care and skill. We are not responsible for decisions made by government agencies, for losses caused by
          inaccurate information you gave us, or for indirect losses such as lost profits or opportunities.
        </p>
        <p>
          Our total responsibility for any order is limited to the amount you paid for it. Nothing in these terms limits any right you have that the
          law does not allow us to limit.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "Disagreements and the law that applies",
    body: (
      <p>
        If something goes wrong, contact us first at {email} or {hq.phone} and we will try to put it right. These terms are governed by the laws of
        the Federal Republic of Nigeria, and the courts of {hq.state} will deal with any dispute we cannot resolve together.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms. The date at the top shows the latest version, and we will tell you by email about significant changes. Orders you
        have already paid for continue under the terms that applied when you paid.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated={legalEntity.lastUpdated}
      intro={<p>These terms explain what you can expect from Reenite, and what we need from you. We have kept them as short and plain as we can.</p>}
      sections={sections}
    />
  );
}
