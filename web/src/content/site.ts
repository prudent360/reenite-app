import {
  Armchair,
  BookOpen,
  Building2,
  Calculator,
  Coffee,
  DoorClosed,
  Globe,
  Mailbox,
  Mic,
  PartyPopper,
  Presentation,
  Ticket,
  type LucideIcon,
} from "lucide-react";

/**
 * Marketing content for the public site. The service catalogue and workspace
 * listings move to the API (admin-managed) in Milestones 2 and 5.
 */

export type Pillar = {
  slug: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  items: string[];
  /** Where the pillar's services are listed. */
  href: string;
};

export const pillars: Pillar[] = [
  {
    slug: "incorporation",
    href: "/services#business-registration",
    title: "Business Registration",
    summary: "CAC registration done properly, from name search to certificate.",
    icon: Building2,
    items: [
      "Business Name registration",
      "Limited Liability Company (LTD)",
      "Incorporated Trustees (NGO / church)",
      "Post-incorporation changes",
      "Annual returns",
      "SCUML registration",
    ],
  },
  {
    slug: "tax",
    href: "/services#tax-compliance",
    title: "Tax & Compliance",
    summary: "TIN, VAT, PAYE and tax clearance handled by our filing team.",
    icon: Calculator,
    items: [
      "TIN registration",
      "VAT registration & monthly returns",
      "Company Income Tax filing",
      "PAYE setup",
      "Tax Clearance Certificate (TCC)",
      "Withholding Tax",
    ],
  },
  {
    slug: "online-presence",
    href: "/services#online-presence",
    title: "Online Presence",
    summary: "Get found online with a domain, website, email and brand kit.",
    icon: Globe,
    items: [
      ".ng and .com domains",
      "Business email setup",
      "Website design packages",
      "Google Business Profile",
      "Social media setup",
      "Logo & brand kit",
    ],
  },
  {
    slug: "workspace",
    href: "/workspace",
    title: "Workspace",
    summary: "Desks, private offices, a podcast studio and event space in Uyo.",
    icon: Armchair,
    items: ["Hot desks", "Private offices", "Podcast studio", "Event space", "Flexible passes", "Memberships"],
  },
];

/**
 * Spaces and prices as listed on book.reenite.com (October 2026). They move to the
 * admin-managed Locations/Spaces in Milestone 5; until then edit them here.
 */
export type SpaceType = {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  capacity: number;
  /** Starting price per hour, in kobo like every other amount in the app. */
  fromHourly: number;
  extras?: string[];
};

export const spaceTypes: SpaceType[] = [
  {
    slug: "hot-desk",
    title: "Hot Desk",
    description: "Flexible seating in our open coworking area. Book by the hour, day or with a pass.",
    icon: Armchair,
    capacity: 40,
    fromHourly: 120000,
    extras: ["₦4,500 a day", "3 days a week and 12 days a month passes"],
  },
  {
    slug: "private-office",
    title: "Private Office",
    description: "A quiet, lockable room for you and a colleague.",
    icon: DoorClosed,
    capacity: 2,
    fromHourly: 200000,
  },
  {
    slug: "meeting-room",
    title: "Meeting Room",
    description: "For meetings, interviews and client presentations, with a TV screen and whiteboard.",
    icon: Presentation,
    capacity: 10,
    fromHourly: 750000,
    extras: ["₦25,000 a day"],
  },
  {
    slug: "podcast-studio",
    title: "Podcast Studio",
    description: "A sound-treated room with mics, set up for recording.",
    icon: Mic,
    capacity: 1,
    fromHourly: 700000,
  },
  {
    slug: "event-space",
    title: "Event Space",
    description: "Two halls for workshops, launches and meetups: one for 30 guests, one for 70.",
    icon: PartyPopper,
    capacity: 70,
    fromHourly: 3000000,
  },
];

export const teamSizes = [
  { value: 1, label: "Just me" },
  { value: 2, label: "2+ people" },
  { value: 5, label: "5+ people" },
  { value: 10, label: "10+ people" },
  { value: 25, label: "25+ people" },
];

export const bookingSteps = [
  { title: "Find a space", body: "Choose the space and team size, and see the live price." },
  { title: "Pick your time", body: "Book by the hour, day, week or month, whatever the work needs." },
  { title: "Pay securely", body: "Pay by card, transfer or POS. Your booking is confirmed straight away." },
  { title: "Show up and work", body: "Check in with your booking code. WiFi, power and coffee are ready." },
];

export const amenities = ["High-speed WiFi", "Steady power", "Café and refreshments", "Parking on site", "Printer"];

export const extras: { title: string; body: string; icon: LucideIcon }[] = [
  { title: "Library", body: "Borrow books on productivity, business and tech. Read on site or take one home.", icon: BookOpen },
  { title: "Events and trainings", body: "Workshops, meetups and upskilling sessions for Uyo's tech and business community.", icon: Ticket },
  { title: "Virtual address", body: "A professional business address with mail handling, from ₦15,000 a month.", icon: Mailbox },
  { title: "Café", body: "Coffee, parfaits, cakes and cold drinks while you work.", icon: Coffee },
];

/** Membership and virtual address prices are monthly, in kobo. */
export const memberships = [
  {
    name: "Basic",
    price: 500000,
    discount: 10,
    features: ["10% off every booking", "Member badge on your profile", "Email support", "Early access to new spaces"],
  },
  {
    name: "Pro",
    price: 1000000,
    discount: 15,
    featured: true,
    features: ["Everything in Basic", "15% off every booking", "1 free guest pass a month", "Email and WhatsApp support"],
  },
  {
    name: "Elite",
    price: 2500000,
    discount: 20,
    features: ["20% off every booking", "Priority booking", "3 free guest passes a month", "24/7 WhatsApp support"],
  },
];

export const virtualAddressPlans = [
  {
    name: "Starter",
    price: 1500000,
    bestFor: "Freelancers and solopreneurs",
    features: ["Professional business address", "Use it on cards and your website", "Mail received and scanned (5 items a month)"],
  },
  {
    name: "Business",
    price: 3000000,
    bestFor: "Small businesses and LTDs",
    featured: true,
    features: ["Everything in Starter", "Use the address for CAC registration", "Business name shown at reception", "Dedicated phone number with call forwarding"],
  },
  {
    name: "Premium",
    price: 5000000,
    bestFor: "Established companies and remote teams",
    features: ["Everything in Business", "Unlimited mail and nationwide forwarding", "2 hours of private office a month", "5 hours of meeting room a month"],
  },
];

/** Reviews published on reenite.com. */
export const testimonials = [
  {
    quote: "The best workspace in Uyo. Serene environment, 24/7 electricity and very fast (and free) internet. You should definitely visit.",
    name: "Amarachi Iwuoha",
    role: "Legal Practitioner",
  },
  {
    quote: "This is a very good co-working space, I have had a good time working here. Check them out to see what they offer. Very good customer service.",
    name: "Ayobami",
    role: "Member",
  },
  {
    quote: "I do not regret booking a space at Reenite for my personal work. The experience was great, and they have good customer service.",
    name: "Ekemini",
    role: "Technical Writer",
  },
];

export const steps = [
  { title: "Choose a service", body: "Pick what your business needs, from registration to tax filing to a website." },
  { title: "Share your details", body: "Fill a short guided form and upload your documents securely." },
  { title: "Our legal experts file", body: "A named Reenite legal expert files with CAC, FIRS and the state tax office for you." },
  { title: "Track & receive", body: "Follow every step live, then download your certificates from your vault." },
];

/** Workspace bookings live on the separate booking site; this app is the business-services site. */
export const bookingUrl = "https://book.reenite.com";

export const hq = {
  name: "Reenite Uyo",
  street: "162 Oron Road, Opposite Kilimanjaro",
  city: "Uyo",
  state: "Akwa Ibom State",
  phone: "0916 123 1304",
  phoneHref: "tel:+2349161231304",
  whatsapp: "https://wa.me/2349161231304",
  hoursShort: "Mon to Sat, 9am to 8pm",
  hours: [
    { days: "Mon to Sat", time: "9:00am to 8:00pm" },
    { days: "Sunday", time: "Closed" },
  ],
};

export const socials = [
  { label: "Facebook", href: "https://www.facebook.com/reenited" },
  { label: "Instagram", href: "https://www.instagram.com/reenitenig/" },
  { label: "X", href: "https://x.com/reenitenig" },
];

/** Reenite Academy, as published on scholarship.reenite.com. Confirm the tracks with the Academy team before launch. */
export const academy = {
  name: "Reenite Academy",
  programme: "Tech Scholarship Program 2026",
  url: "https://scholarship.reenite.com",
  tracks: ["Data Analysis", "UI/UX Design", "Cybersecurity"],
};

/** Referral offer from reenite.com. Amount in kobo. */
export const referral = {
  maxMonthly: 25_000_000,
};

/**
 * Details used in the privacy policy and terms. Confirm the legal name, RC number and
 * contact email before launch: they must match Reenite's CAC records.
 */
export const legalEntity = {
  name: "Reenite",
  rcNumber: "",
  email: "hello@reenite.com",
  lastUpdated: "6 November 2026",
};
