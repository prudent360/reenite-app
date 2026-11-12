import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Armchair,
  DoorClosed,
  PartyPopper,
  BadgeCheck,
  Bell,
  Building2,
  CalendarClock,
  Check,
  ChartColumn,
  ChevronDown,
  ClipboardList,
  Clock,
  Code,
  Coffee,
  FileText,
  FolderLock,
  Globe,
  GraduationCap,
  HandCoins,
  Headphones,
  Mic,
  PenTool,
  Sparkles,
  Ticket,
  Video,
  BookOpen,
  LayoutDashboard,
  Lock,
  MapPinned,
  MessageSquare,
  MessagesSquare,
  Receipt,
  ReceiptText,
  Search,
  ShieldCheck,
  Store,
  Upload,
  UserRound,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { CategoryIcon } from "@/components/catalogue/category-icon";
import { FeatureTabs } from "@/components/home/feature-tabs";
import { HeroTilt } from "@/components/home/hero-tilt";
import { Reveal } from "@/components/home/reveal";
import { howItWorksScenes, howItWorksSteps } from "@/components/home/scenes";
import { Plans } from "@/components/site/plans";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { academy, amenities, hq, pillars, referral, spaceTypes } from "@/content/site";
import { bookingHref, getBookingSettings, getWorkspaceCatalogue } from "@/lib/booking";
import type { BookingSettings } from "@/lib/types";
import { getCatalogue } from "@/lib/catalogue";
import type { Catalogue, Service, Space, WorkspaceCatalogue } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

/*
 * Reenite Spaces first: desks, offices, the podcast studio and event halls in Uyo. Business
 * services (registration, tax, online presence, virtual address) are one part of what Reenite
 * offers, alongside the community and the Academy. Bookings follow the admin switch (this site
 * or book.reenite.com).
 */
export default async function HomePage() {
  const [catalogue, bookingSettings, workspace] = await Promise.all([getCatalogue(), getBookingSettings(), getWorkspaceCatalogue()]);

  return (
    <div className="reenite-home">
      <Hero settings={bookingSettings} />
      <NeedPicker catalogue={catalogue} settings={bookingSettings} />
      <Intro />
      <SpacesSection settings={bookingSettings} workspace={workspace} />
      <PodcastStudio settings={bookingSettings} />
      <ServiceAreas />
      <LegalExpertsSection />
      <HowServicesWork />
      <PopularServices catalogue={catalogue} />
      <Plans only="virtual-address" />
      <WhoWeHelp />
      <CommunityRow />
      <AcademySection />
      <ReferralBand />
      <Faq />
      <FinalCta settings={bookingSettings} />
    </div>
  );
}

function SectionHeading({ title, body, align = "center" }: { title: ReactNode; body?: string; align?: "center" | "left" }) {
  return (
    <div data-reveal="" className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <h2 className="text-3xl font-semibold leading-[1.15] tracking-tight text-foreground sm:text-[2.6rem]">{title}</h2>
      {body && <p className="mt-4 text-lg leading-relaxed text-muted">{body}</p>}
    </div>
  );
}

/* ---------- Hero ---------- */

const heroHighlights = [
  { icon: Armchair, label: "Desks and offices" },
  { icon: Mic, label: "Podcast studio" },
  { icon: PartyPopper, label: "Event halls" },
  { icon: BadgeCheck, label: "Business services" },
];

/** Frosted glass for the pieces that sit on the navy hero. */
const glass = "border border-white/15 bg-white/[0.07] backdrop-blur-md shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]";

function Hero({ settings }: { settings: BookingSettings }) {
  return (
    <section className="home-hero relative isolate overflow-hidden bg-[var(--navy-950)] pb-16 text-white md:bg-[linear-gradient(to_bottom,var(--navy-950)_0,var(--navy-950)_calc(100%-14rem),var(--surface)_calc(100%-14rem))] md:pb-0">
      <HeroBackdrop />
      <div className="relative mx-auto max-w-7xl px-4 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className={`intro inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-navy-100 ${glass}`}>
            <MapPinned className="size-4 text-brand-400" /> Reenite Spaces, Uyo
          </p>
          <h1 className="mt-7 text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            <span className="intro block" style={introDelay(120)}>
              Building a business?
            </span>
            <span className="intro block" style={introDelay(240)}>
              Don&apos;t build <span className="text-brand-500">alone.</span>
            </span>
          </h1>
          <p className="intro mt-6 max-w-2xl text-base leading-relaxed text-navy-200 sm:text-lg" style={introDelay(360)}>
            Reenite gives you a place to work, meet, record and grow in Uyo. Book a desk, an office, the podcast studio or an event hall,
            and when you&apos;re ready, our team can register your business, handle your taxes and get you online too.
          </p>
          <div className="intro mt-9 flex flex-wrap justify-center gap-3" style={introDelay(460)}>
            <a
              href={bookingHref(settings)}
              className={buttonClasses({ size: "lg", variant: "light", className: "rounded-full shadow-[0_14px_40px_-12px_rgb(0_0_0/0.6)]" })}
            >
              Book a space
            </a>
            <Link
              href="/services"
              className={buttonClasses({
                size: "lg",
                variant: "glass",
                className: `rounded-full border-white/25 bg-white/[0.07] backdrop-blur-md hover:border-white/40 hover:bg-white/15 hover:text-white`,
              })}
            >
              Business services
            </Link>
          </div>

          <ul
            className={`intro mt-12 grid w-full max-w-3xl grid-cols-2 overflow-hidden rounded-2xl sm:flex sm:w-auto sm:rounded-full ${glass}`}
            style={introDelay(560)}
          >
            {heroHighlights.map((item, index) => (
              <li
                key={item.label}
                className={`flex items-center justify-start gap-2 px-3.5 py-3 text-[13px] text-navy-100 sm:justify-center sm:px-6 sm:text-sm ${index % 2 ? "border-l border-white/10" : ""} ${index > 1 ? "border-t border-white/10 sm:border-t-0" : ""} ${index === 2 ? "sm:border-l" : ""}`}
              >
                <item.icon className="size-4 shrink-0 text-brand-400" />
                <span className="font-medium text-white">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Phones skip the preview: drawn at their width it is a tall, cramped copy of the desktop. */}
        <div className="intro-preview mt-20 hidden md:block" style={introDelay(680)}>
          <HeroTilt>
            <DashboardPreview />
          </HeroTilt>
        </div>
      </div>
    </section>
  );
}

/** Faint grid lines, rings and an oversized Reenite mark behind the hero copy. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full overflow-hidden md:h-[calc(100%-14rem)]">
      <div
        className="absolute inset-0 bg-[size:20%_18rem] bg-[position:center_top_4rem] [mask-image:radial-gradient(ellipse_75%_70%_at_50%_35%,#000_30%,transparent_100%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(255 255 255 / 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.06) 1px, transparent 1px)",
        }}
      />
      <div className="absolute -left-40 top-1/3 size-[32rem] rounded-full bg-brand-500/15 blur-[120px]" />
      <div className="absolute -right-32 -top-24 size-[36rem] rounded-full bg-[#3b4a9a]/40 blur-[120px]" />
      <svg viewBox="0 0 800 800" className="absolute -right-[22rem] -top-40 w-[60rem] max-w-none text-white sm:-right-64 lg:-right-40">
        <circle cx="400" cy="400" r="395" fill="none" stroke="currentColor" strokeOpacity="0.07" />
        <circle cx="400" cy="400" r="320" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="2 6" />
        <circle cx="400" cy="400" r="240" fill="none" stroke="currentColor" strokeOpacity="0.06" />
      </svg>
      <LogoMark
        className="absolute -right-32 top-6 size-[26rem] opacity-[0.05] sm:-right-16 lg:-right-[2%] lg:top-12 lg:size-[34rem]"
        dotClassName="fill-white"
        chevronClassName="fill-brand-500"
      />
      <LogoMark className="absolute -bottom-24 -left-24 size-72 rotate-180 opacity-[0.04]" dotClassName="fill-white" chevronClassName="fill-white" />
    </div>
  );
}

function introDelay(ms: number) {
  return { "--intro-delay": `${ms}ms` } as CSSProperties;
}

const previewNav = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: CalendarClock, label: "My bookings" },
  { icon: Building2, label: "My Businesses" },
  { icon: Store, label: "Services" },
  { icon: ClipboardList, label: "Orders" },
  { icon: FolderLock, label: "Documents" },
  { icon: Receipt, label: "Billing" },
  { icon: MessagesSquare, label: "Messages" },
];

const previewStages = [
  { label: "Details received", done: true },
  { label: "Name approved", done: true },
  { label: "Filed with CAC", current: true },
  { label: "Certificate ready" },
];

const previewBooking = [
  { name: "Hot Desk", when: "Tue 12 Nov, 9am to 5pm" },
  { name: "Podcast Studio", when: "Fri 15 Nov, 2pm to 4pm" },
];

const previewDocuments = ["Certificate of registration.pdf", "TIN certificate.pdf", "Proof of address.pdf"];

/**
 * A static picture of the customer dashboard, drawn in its light theme whatever the site theme is.
 * It is one image to assistive tech, so nothing inside it is focusable.
 */
function DashboardPreview() {
  const card = "rounded-[12px] border border-[#e3e6ef] bg-white p-4 sm:p-5";
  return (
    <div
      role="img"
      aria-label="Preview of the Reenite customer dashboard, showing upcoming space bookings, a business name registration filed with CAC, stored documents and orders"
      className="home-preview relative select-none overflow-hidden rounded-[14px] border-2 border-[#2b3463] bg-[#f6f7fb] text-[#1a2142] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.6)] sm:border-[3px]"
    >
      <div className="flex items-center gap-2 border-b border-[#e3e6ef] bg-white px-4 py-2.5" aria-hidden>
        {/* Close, minimise and full screen, in the macOS colours. */}
        <span className="size-3 rounded-full border border-[#e0443e] bg-[#ff5f57]" />
        <span className="size-3 rounded-full border border-[#dea123] bg-[#febc2e]" />
        <span className="size-3 rounded-full border border-[#1aab29] bg-[#28c840]" />
      </div>
      <div className="grid grid-cols-[190px_1fr]" aria-hidden>
        <aside className="border-r border-[#e3e6ef] bg-white p-4">
          <Logo tone="dark" href={null} className="!h-6" />
          <ul className="mt-8 space-y-1 text-[13px]">
            {previewNav.map((item) => (
              <li
                key={item.label}
                className={
                  item.active
                    ? "flex items-center gap-2.5 rounded-[8px] bg-[#1a2142] px-3 py-2 font-semibold text-white"
                    : "flex items-center gap-2.5 px-3 py-2 text-[#5c6488]"
                }
              >
                <item.icon className="size-4" /> {item.label}
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex h-9 w-full max-w-xs items-center gap-2 rounded-[8px] border border-[#e3e6ef] bg-white px-3 text-xs text-[#9aa1c4]">
              <Search className="size-3.5" /> Search or jump to
              <span className="ml-auto rounded border border-[#e3e6ef] px-1.5 text-[10px]">⌘K</span>
            </div>
            <div className="flex items-center gap-3">
              <Bell className="size-4 text-[#5c6488]" />
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1a2142] text-xs font-bold text-white">AO</span>
            </div>
          </div>

          <h2 className="mt-7 text-xl font-semibold sm:text-2xl">Good morning, Amara</h2>
          <p className="mt-1 text-sm text-[#5c6488]">Amara Foods · Business Name</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5 rounded-full bg-[#1a2142] px-3.5 py-2 text-white">
              <Armchair className="size-3.5" /> Book a space
            </span>
            {[
              { icon: Store, label: "Order a service" },
              { icon: Upload, label: "Upload documents" },
              { icon: MessagesSquare, label: "Message your officer" },
            ].map((action) => (
              <span key={action.label} className="flex items-center gap-1.5 rounded-full border border-[#e3e6ef] bg-white px-3.5 py-2">
                <action.icon className="size-3.5" /> {action.label}
              </span>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
            <div className={card}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-[#5c6488]">Order RN-2041 · Business Name registration</p>
                <span className="shrink-0 rounded-full bg-[#fdf0ea] px-2 py-0.5 text-[11px] font-semibold text-[#c2410f]">With CAC</span>
              </div>
              <ol className="mt-5 grid grid-cols-4 gap-2">
                {previewStages.map((stage) => (
                  <li key={stage.label}>
                    <span
                      className={`block h-1.5 rounded-full ${stage.done ? "bg-[#12805c]" : stage.current ? "bg-[#f05a28]" : "bg-[#eef0f6]"}`}
                    />
                    <span className={`mt-2 block text-[11px] leading-tight ${stage.done || stage.current ? "font-semibold text-[#1a2142]" : "text-[#9aa1c4]"}`}>
                      {stage.label}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 flex items-center gap-3 rounded-[10px] bg-[#f6f7fb] p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1a2142] text-white">
                  <UserRound className="size-4" />
                </span>
                <p className="text-xs leading-relaxed">
                  <span className="font-semibold">Ekemini, your legal officer:</span> Filed with CAC this morning. We expect the certificate in
                  about 5 working days.
                </p>
              </div>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#5c6488]">Upcoming bookings</p>
                <CalendarClock className="size-4 text-[#5c6488]" />
              </div>
              <ul className="mt-2 divide-y divide-[#eceef4]">
                {previewBooking.map((booking, index) => (
                  <li key={booking.name} className="py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{booking.name}</span>
                      {index === 0 && <span className="shrink-0 rounded-full bg-[#e7f5ef] px-2 py-0.5 text-[11px] font-semibold text-[#12805c]">Confirmed</span>}
                    </div>
                    <span className="mt-0.5 block text-xs text-[#5c6488]">{booking.when}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 rounded-[8px] bg-[#f6f7fb] px-3 py-2 text-xs">
                Check-in code <span className="font-mono font-bold tracking-wider">RB-7Q4K</span>
              </p>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#5c6488]">Document vault</p>
                <Lock className="size-4 text-[#5c6488]" />
              </div>
              <ul className="mt-3 space-y-2.5">
                {previewDocuments.map((name) => (
                  <li key={name} className="flex items-center gap-3 text-sm">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[#fdf0ea] text-[#c2410f]">
                      <FileText className="size-4" />
                    </span>
                    <span className="truncate font-medium">{name}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={card}>
              <p className="text-xs font-semibold text-[#5c6488]">Other orders</p>
              <ul className="mt-3 space-y-4">
                {[
                  { name: "TIN registration", status: "Completed", percent: 100 },
                  { name: "Website and business email", status: "Designing", percent: 45 },
                ].map((order) => (
                  <li key={order.name}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-semibold">{order.name}</span>
                      <span className={`shrink-0 text-xs font-semibold ${order.percent === 100 ? "text-[#12805c]" : "text-[#c2410f]"}`}>{order.status}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef0f6]">
                      <div className={`h-full rounded-full ${order.percent === 100 ? "bg-[#12805c]" : "bg-[#f05a28]"}`} style={{ width: `${order.percent}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- What do you need ---------- */

const chip =
  "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-brand-500 hover:text-brand-600";

/** Spaces first, then the business-service categories, so visitors can jump straight to what they came for. */
function NeedPicker({ catalogue, settings }: { catalogue: Catalogue | null; settings: BookingSettings }) {
  const categories = catalogue?.categories ?? [];
  return (
    <section className="bg-surface">
      <div data-reveal="" className="mx-auto max-w-5xl px-4 pt-12 text-center sm:px-6">
        <p className="text-lg font-semibold text-foreground">What brings you to Reenite?</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <a href="#spaces" className={chip}>
            <Armchair className="size-4 text-brand-500" /> A place to work
          </a>
          <a href="#podcast" className={chip}>
            <Mic className="size-4 text-brand-500" /> Podcast studio
          </a>
          <a href={bookingHref(settings)} className={chip}>
            <PartyPopper className="size-4 text-brand-500" /> Meetings and events
          </a>
          {categories.map((category) => (
              <Link
                key={category.id}
              href={`/services#${category.slug}`}
              className={chip}
            >
              <CategoryIcon name={category.icon} className="size-4 text-brand-500" />
              {category.name}
            </Link>
          ))}
        </div>
      </div>
      <Marquee />
    </section>
  );
}

const marqueeItems = [
  { icon: Armchair, label: "Hot desks by the hour, day or month" },
  { icon: DoorClosed, label: "Private offices and a meeting room" },
  { icon: Mic, label: "Podcast studio by the hour" },
  { icon: PartyPopper, label: "Event halls for 30 and 70 guests" },
  { icon: Coffee, label: "Café, library and fast WiFi" },
  { icon: BadgeCheck, label: "Business Name and company registration" },
  { icon: ReceiptText, label: "TIN, VAT and tax clearance" },
  { icon: Globe, label: "Websites, domains and business email" },
  { icon: MapPinned, label: "Virtual business address" },
  { icon: GraduationCap, label: "Reenite Academy tech scholarships" },
];

/** What Reenite does, on an endless sideways strip. */
function Marquee() {
  return (
    <div
      className="marquee mt-10 overflow-hidden border-y border-border py-5"
      style={{ maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}
    >
      <ul className="marquee-track flex w-max gap-12 pr-12 text-sm font-medium text-muted">
        {[...marqueeItems, ...marqueeItems].map((item, index) => (
          // The second copy only exists to make the loop seamless, so screen readers skip it.
          <li key={index} className="flex items-center gap-2 whitespace-nowrap" aria-hidden={index >= marqueeItems.length || undefined}>
            <item.icon className="size-4 text-brand-500" /> {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Intro ---------- */

const reasons = [
  { icon: Armchair, title: "Spaces ready when you arrive", body: "Desks, offices, the studio and event halls with steady power, fast WiFi and coffee on hand." },
  { icon: BadgeCheck, title: "Business services, done for you", body: "Our team registers your business, files your taxes and gets you online. You follow it all from your dashboard." },
  { icon: UserRound, title: "One team, one account", body: "Book a space and order a service from the same account, with people in Uyo you can talk to." },
];

function Intro() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <p data-reveal="" className="mx-auto max-w-3xl text-center text-xl leading-relaxed text-foreground sm:text-2xl">
          Reenite Spaces is where people in Uyo come to work, meet, record and learn. Now we also help you set up and run the business
          behind the work.
        </p>
        <div data-stagger="" className="mt-14 grid gap-10 sm:grid-cols-3">
          {reasons.map((item) => (
            <div key={item.title} className="flex gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                <item.icon className="size-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                <p className="mt-1 leading-relaxed text-muted">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Spaces ---------- */

/** Stock photos used until an admin uploads a real one for the space (Admin > Workspace > Spaces). */
const stockSpacePhotos: Record<string, string> = {
  "hot-desk": "/images/home/coworking-lagos.jpg",
  "private-office": "/images/home/private-office.jpg",
  "meeting-room": "/images/home/team-meeting.jpg",
  "podcast-studio": "/images/home/podcast-studio.jpg",
};

const spaceIcons: Record<string, typeof Mic> = {
  "hot-desk": Armchair,
  "private-office": DoorClosed,
  "meeting-room": Building2,
  "podcast-studio": Mic,
  "event-space": PartyPopper,
};

const rateUnits: Record<string, string> = { hour: "an hour", day: "a day", week: "a week", month: "a month" };

type HomeSpace = {
  key: string;
  name: string;
  description: string;
  photo: string | null;
  icon: typeof Mic;
  capacity: number;
  price: number | null;
  unit: string;
  href: string;
};

/** The spaces set up in Admin > Workspace, with their photos and prices. Falls back to the fixed list if the API is unreachable. */
function homeSpaces(workspace: WorkspaceCatalogue | null, settings: BookingSettings): HomeSpace[] {
  const live = (workspace?.locations ?? []).flatMap((location) => (location.spaces ?? []) as Space[]).filter((space) => space.is_active);

  if (live.length === 0) {
    return spaceTypes.map((space) => ({
      key: space.slug,
      name: space.title,
      description: space.description,
      photo: stockSpacePhotos[space.slug] ?? null,
      icon: space.icon,
      capacity: space.capacity,
      price: space.fromHourly,
      unit: rateUnits.hour,
      href: bookingHref(settings),
    }));
  }

  return live.slice(0, 6).map((space) => {
    const rates = (space.rates ?? []).filter((rate) => rate.is_active);
    const rate = rates.find((item) => item.unit === "hour") ?? [...rates].sort((x, y) => x.price - y.price)[0];
    const type = space.type?.slug ?? "";
    return {
      key: space.slug,
      name: space.name,
      description: space.summary ?? space.type?.description ?? "",
      photo: space.photo_url ?? stockSpacePhotos[type] ?? null,
      icon: spaceIcons[type] ?? Armchair,
      capacity: space.capacity,
      price: rate?.price ?? null,
      unit: rate ? (rateUnits[rate.unit] ?? `per ${rate.unit}`) : "",
      href: bookingHref(settings, `/${space.slug}`),
    };
  });
}

/** The spaces at Reenite with their starting prices. "Book" follows the admin switch (this site or the booking site). */
function SpacesSection({ settings, workspace }: { settings: BookingSettings; workspace: WorkspaceCatalogue | null }) {
  const spaces = homeSpaces(workspace, settings);
  return (
    <section id="spaces" className="scroll-mt-20 bg-surface-muted">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div data-reveal="" className="max-w-2xl">
            <p className="font-semibold text-brand-600">Reenite Spaces</p>
            <h2 className="mt-3 text-3xl font-semibold leading-[1.15] tracking-tight text-foreground sm:text-[2.6rem]">
              A space for every kind of <span className="text-brand-500">work</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Book by the hour, day, week or month at 162 Oron Road, Uyo. Pay online and you&apos;re confirmed straight away.
            </p>
          </div>
          <a href={bookingHref(settings)} className={buttonClasses({ size: "lg", variant: "navy", className: "shrink-0" })}>
            Book a space
          </a>
        </div>

        <div data-stagger="" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <SpaceCard key={space.key} space={space} />
          ))}
        </div>

        <ul data-reveal="" className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-[15px] text-foreground">
          {amenities.map((amenity) => (
            <li key={amenity} className="flex items-center gap-2">
              <Check className="size-4 text-brand-500" strokeWidth={2.5} /> {amenity}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SpaceCard({ space }: { space: HomeSpace }) {
  return (
    <a
      href={space.href}
      className="group flex flex-col overflow-hidden rounded-[16px] border border-border bg-surface transition hover:border-navy-200 hover:shadow-card"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-navy-50">
        {space.photo ? (
          <Image
            src={space.photo}
            alt=""
            fill
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-brand-500">
            <space.icon className="size-10" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold text-foreground group-hover:text-brand-600">{space.name}</h3>
        {space.description && <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{space.description}</p>}
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {space.price !== null ? (
            <p className="text-sm text-muted">
              From <span className="font-display text-lg font-bold text-foreground">{formatNaira(space.price)}</span> {space.unit}
            </p>
          ) : (
            <span />
          )}
          <p className="text-xs text-muted">{space.capacity === 1 ? "Up to 1 person" : `Up to ${space.capacity} people`}</p>
        </div>
      </div>
    </a>
  );
}

/* ---------- Business services ---------- */

function ServiceAreas() {
  const services = pillars.filter((pillar) => pillar.slug !== "workspace");
  return (
    <section id="services" className="scroll-mt-20 bg-navy-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div data-reveal="">
            <p className="font-semibold text-brand-400">New at Reenite</p>
            <h2 className="mt-3 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-[2.6rem]">
              Business services, <span className="text-brand-500">under the same roof</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-navy-200">
              Alongside our spaces, Reenite now helps you set up and run your business. Our team handles registration, tax and your online
              presence, so you can focus on the work.
            </p>
            <ButtonLink href="/services" variant="light" size="lg" className="mt-9">
              See services and prices
            </ButtonLink>
          </div>

          <div data-stagger="" className="grid gap-4 sm:grid-cols-3">
            {services.map((pillar) => (
              <Link key={pillar.slug} href={pillar.href} className="group flex flex-col rounded-[16px] border border-white/10 bg-white/5 p-6 transition-colors hover:bg-white/10">
                <pillar.icon className="size-7 text-brand-500" />
                <h3 className="mt-5 text-lg font-bold">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-200">{pillar.summary}</p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm text-white/90">
                  {pillar.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-500" /> {item}
                    </li>
                  ))}
                </ul>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400">
                  See prices <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HowServicesWork() {
  return (
    <section id="how" className="scroll-mt-20 bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <SectionHeading title="How our business services work" body="Four steps. You stay in control, and our legal experts do the filing." />
        <Reveal className="mt-14">
          <FeatureTabs label="How Reenite works" items={howItWorksSteps} scenes={howItWorksScenes} numbered />
        </Reveal>
      </div>
    </section>
  );
}

function PopularServices({ catalogue }: { catalogue: Catalogue | null }) {
  const services: (Service & { categoryName: string })[] = (catalogue?.categories ?? [])
    .flatMap((category) => (category.services ?? []).slice(0, 2).map((service) => ({ ...service, categoryName: category.name })))
    .slice(0, 6);

  if (services.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading align="left" title="Clear prices. Real turnaround times." body="What you see is what you pay, government fees included." />
          <Link href="/services" className="inline-flex shrink-0 items-center gap-2 font-semibold text-brand-600 hover:underline">
            View all services <ArrowRight className="size-4" />
          </Link>
        </div>
        <div data-stagger="" className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/services/${service.slug}`}
              className="group flex flex-col rounded-md border border-border bg-surface p-6 transition hover:border-navy-200 hover:shadow-card"
            >
              <p className="text-sm font-medium text-brand-600">{service.categoryName}</p>
              <h3 className="mt-2 text-lg font-bold text-foreground">{service.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{service.summary}</p>
              <div className="mt-6 flex items-end justify-between border-t border-border pt-4">
                <div>
                  <p className="font-display text-xl font-bold text-foreground">{formatNaira(service.total_fee)}</p>
                  {service.turnaround_days && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <Clock className="size-3.5" /> About {service.turnaround_days} working days
                    </p>
                  )}
                </div>
                <ArrowRight className="size-5 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Who we help ---------- */

const audiences = [
  {
    title: "Remote workers and freelancers",
    body: "A quiet desk with steady power and fast WiFi, by the hour or with a pass. Add a registered name and website when you're ready.",
    photo: "/images/home/freelancer-laptop.jpg",
    href: "#spaces",
  },
  {
    title: "Founders and startups",
    body: "A private office or meeting room for the team, plus company registration, TIN and PAYE handled for you.",
    photo: "/images/home/founder-tablet.jpg",
    href: "#spaces",
  },
  {
    title: "Creators and podcasters",
    body: "Record in a sound-treated studio, host workshops in our event halls and meet the people building in Uyo.",
    photo: "/images/home/founder-orange-blazer.jpg",
    href: "#podcast",
  },
  {
    title: "Traders and small businesses",
    body: "Register your business, get a virtual address and look established online, without leaving your shop.",
    photo: "/images/home/shop-owner-door.jpg",
    href: "/services",
  },
];

function WhoWeHelp() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <SectionHeading title="Who comes to Reenite" body="Whether you need a desk for the day or help making your business official." />
        <div data-stagger="" className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map((audience) => (
            <div key={audience.title}>
              <Link href={audience.href} className="group block">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] bg-surface-muted">
                  <Image
                    src={audience.photo}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <h3 className="mt-5 text-lg font-bold text-foreground group-hover:text-brand-600">{audience.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{audience.body}</p>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Officer ---------- */

const legalWork = [
  {
    title: "Business filings",
    icon: BadgeCheck,
    items: ["Business Name, LTD and Incorporated Trustees registration", "Changes to directors, shares and addresses", "Annual returns filed on time", "SCUML registration"],
  },
  {
    title: "Tax compliance",
    icon: ReceiptText,
    items: ["TIN registration", "VAT registration and monthly returns", "PAYE and Company Income Tax filing", "Tax Clearance Certificate (TCC)"],
  },
];

/** The legal team: who does the filing, and everything they take off the customer's hands. */
function LegalExpertsSection() {
  return (
    <section id="legal" className="scroll-mt-20 bg-surface-muted">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div data-reveal="" className="relative">
          <div className="relative aspect-[5/4] overflow-hidden rounded-[18px]">
            <Image
              src="/images/home/consultant-window.jpg"
              alt="A Reenite legal officer reviewing a customer's documents"
              fill
              sizes="(min-width: 1024px) 600px, 100vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-8 right-4 w-[min(320px,85%)] rounded-[14px] border border-border bg-surface p-4 shadow-pop sm:right-6">
            <p className="text-xs font-semibold text-muted">Order RN-2041 · Business Name</p>
            <div className="mt-3 space-y-2 text-sm">
              <p className="rounded-[10px] bg-surface-muted px-3 py-2 text-foreground">Your passport photo is a bit blurry. Could you upload a clearer one?</p>
              <p className="ml-auto w-fit rounded-[10px] bg-navy-900 px-3 py-2 text-white dark:bg-navy-700">Done, just uploaded it.</p>
              <p className="rounded-[10px] bg-surface-muted px-3 py-2 text-foreground">Perfect. Filing with CAC now.</p>
            </div>
          </div>
        </div>

        <div data-reveal="" className="pt-8 lg:pt-0">
          <p className="font-semibold text-brand-600">Our legal team</p>
          <h2 className="mt-3 text-3xl font-semibold leading-[1.15] tracking-tight text-foreground sm:text-[2.6rem]">
            Our legal experts handle every filing and tax return
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            From registering your business to keeping it tax compliant, our legal experts handle the whole process. You share your
            details once, and a named expert checks your documents, files on your behalf and tells you what&apos;s happening, in plain
            language.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {legalWork.map((group) => (
              <div key={group.title}>
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <group.icon className="size-5 text-brand-500" /> {group.title}
                </p>
                <ul className="mt-3 space-y-2.5">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[15px] text-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-500" strokeWidth={2.5} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">We also remind you before every annual return and tax deadline, so nothing is missed.</p>
          <ButtonLink href="/register" size="lg" variant="navy" className="mt-8">
            Get started
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/* ---------- Podcast studio ---------- */

const studioUses = [
  { icon: Mic, label: "Podcasts" },
  { icon: Headphones, label: "Interviews" },
  { icon: Video, label: "Video content" },
];

const studioFeatures = [
  "Sound-treated room, so your audio comes out clean",
  "Microphones set up and ready when you arrive",
  "Book by the hour and pay online",
  "Steady power and fast WiFi through every session",
];

function PodcastStudio({ settings }: { settings: BookingSettings }) {
  const hourly = spaceTypes.find((space) => space.slug === "podcast-studio")?.fromHourly;
  return (
    <section id="podcast" className="scroll-mt-20 bg-surface-muted">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div data-reveal="" className="order-2 lg:order-1">
          <p className="font-semibold text-brand-600">Podcast Studio</p>
          <h2 className="mt-3 text-3xl font-semibold leading-[1.15] tracking-tight text-foreground sm:text-[2.6rem]">
            Record your show in a real studio
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Skip the echo of your bedroom. Bring your co-host and guests to our studio in Uyo, sit down at the mics and press record.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {studioUses.map((use) => (
              <span key={use.label} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground">
                <use.icon className="size-4 text-brand-500" /> {use.label}
              </span>
            ))}
          </div>
          <ul className="mt-7 space-y-3">
            {studioFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-[15px] text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-500" strokeWidth={2.5} />
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <a href={bookingHref(settings)} className={buttonClasses({ size: "lg", variant: "navy" })}>
              Book the studio
            </a>
            {hourly && (
              <p className="text-muted">
                From <span className="font-display text-xl font-bold text-foreground">{formatNaira(hourly)}</span> an hour
              </p>
            )}
          </div>
        </div>

        <div data-reveal="" className="relative order-1 lg:order-2">
          <div className="relative aspect-[5/4] overflow-hidden rounded-[18px]">
            <Image
              src="/images/home/podcast-studio.jpg"
              alt="A phone on a stand recording two armchairs in the podcast studio"
              fill
              sizes="(min-width: 1024px) 600px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Community ---------- */

const community = [
  { icon: Ticket, title: "Events and workshops", body: "Hands-on digital skills training and professional workshops for founders and teams." },
  { icon: Code, title: "Tech hub", body: "Developer meetups and a place to turn your startup idea into a product." },
  { icon: Coffee, title: "Café", body: "Freshly brewed coffee, parfaits and chilled drinks while you work." },
  { icon: BookOpen, title: "Library", body: "Books on business, productivity and tech. Read on site or take one home." },
];

function CommunityRow() {
  return (
    <section id="community" className="scroll-mt-20 bg-surface">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        <SectionHeading title="More than a place to work" body="People building in Uyo meet, learn and share ideas at Reenite every week." />
        <div data-stagger="" className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {community.map((item) => (
            <div key={item.title}>
              <span className="flex size-12 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                <item.icon className="size-6" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-foreground">{item.title}</h3>
              <p className="mt-1.5 leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Academy ---------- */

const trackDetails: Record<string, { icon: typeof Mic; body: string }> = {
  "Data Analysis": { icon: ChartColumn, body: "Clean, analyse and present data that helps businesses decide." },
  "UI/UX Design": { icon: PenTool, body: "Research, design and prototype products people enjoy using." },
  Cybersecurity: { icon: ShieldCheck, body: "Protect systems, networks and data from attacks." },
};

function AcademySection() {
  return (
    <section id="academy" className="scroll-mt-20 bg-navy-950 text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:px-8">
        <div data-reveal="">
          <p className="flex items-center gap-2 font-semibold text-brand-400">
            <GraduationCap className="size-5" /> {academy.name}
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-[2.6rem]">
            Start a career in tech, <span className="text-brand-500">on a scholarship</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-navy-200">
            Reenite Academy trains the next generation of tech talent. Applications are open for the {academy.programme}: pick a
            track, apply online and learn the skills employers are hiring for.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={academy.url} target="_blank" rel="noreferrer" className={buttonClasses({ size: "lg", variant: "light" })}>
              Apply for a scholarship
            </a>
            <a href={hq.whatsapp} className={buttonClasses({ size: "lg", variant: "glass" })}>
              Ask a question
            </a>
          </div>
        </div>

        <div data-stagger="" className="grid gap-4 sm:grid-cols-2">
          {academy.tracks.map((track) => {
            const detail = trackDetails[track];
            const Icon = detail?.icon ?? GraduationCap;
            return (
              <div key={track} className="rounded-[16px] border border-white/10 bg-white/5 p-6">
                <Icon className="size-7 text-brand-500" />
                <h3 className="mt-5 text-lg font-bold">{track}</h3>
                {detail && <p className="mt-2 text-sm leading-relaxed text-navy-200">{detail.body}</p>}
              </div>
            );
          })}
          <a
            href={academy.url}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col rounded-[16px] border border-dashed border-white/20 p-6 transition-colors hover:bg-white/5"
          >
            <Sparkles className="size-7 text-brand-500" />
            <h3 className="mt-5 text-lg font-bold">And more tracks</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-navy-200">See every track and how the scholarship works.</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400">
              scholarship.reenite.com <ArrowUpRight className="size-4" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------- Referral ---------- */

function ReferralBand() {
  const message = encodeURIComponent("Hi Reenite, I'd like to know how the referral programme works.");
  return (
    <section className="bg-surface px-4 pt-20 sm:px-6 lg:px-8">
      <div
        data-reveal=""
        className="mx-auto flex max-w-7xl flex-col gap-6 rounded-[18px] border border-brand-100 bg-brand-50 p-8 sm:p-10 md:flex-row md:items-center md:justify-between dark:border-white/10 dark:bg-white/5"
      >
        <div className="flex items-start gap-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-500 text-white">
            <HandCoins className="size-6" />
          </span>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Refer a customer, earn up to {formatNaira(referral.maxMonthly)} a month</h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-muted">
              Know someone who needs a desk, an office or the studio? Send them to Reenite and earn every time they book.
            </p>
          </div>
        </div>
        <a href={`${hq.whatsapp}?text=${message}`} className={buttonClasses({ size: "lg", variant: "navy", className: "shrink-0" })}>
          Ask how it works
        </a>
      </div>
    </section>
  );
}

/* ---------- FAQ, CTA ---------- */

const faqs = [
  {
    q: "What is Reenite Spaces?",
    a: `Our coworking space at ${hq.street}, Uyo, with hot desks, private offices, a meeting room, a podcast studio and two event halls. Alongside the spaces, we now offer business services: registration, tax, online presence and a virtual address.`,
  },
  {
    q: "Can I book a desk or meeting room?",
    a: "Yes. Book a hot desk, private office, meeting room or event hall online, see live prices and pay straight away. You don't need an account to book.",
  },
  {
    q: "Can I record a podcast at Reenite?",
    a: "Yes. Our podcast studio is a sound-treated room with microphones set up for recording. Book it by the hour, bring your guests and record.",
  },
  {
    q: "Who handles my business filings and taxes?",
    a: "Our legal experts. Every order is assigned to a named Reenite legal expert who checks your documents, files with CAC, FIRS and the state tax office for you, and keeps you updated until it's done.",
  },
  {
    q: "Do I need to visit to use the business services?",
    a: "No. You order, upload documents and pay online, and we file on your behalf. You're welcome to drop by the space at 162 Oron Road, Uyo if you'd rather talk in person.",
  },
  {
    q: "What's the difference between the service fee and government fees?",
    a: "Government fees are what agencies like CAC charge, and we pay them on your behalf. The service fee is what Reenite charges for doing the work. Both are shown before you pay.",
  },
  {
    q: "How long does registration take?",
    a: "Each service shows its usual turnaround on its page. Your order timeline updates as your officer completes each step, so you're never guessing.",
  },
  {
    q: "Are my documents safe?",
    a: "Your documents are stored privately, and only you and the officer assigned to your order can open them.",
  },
  {
    q: "What is a virtual address?",
    a: "A professional address for your business without paying for an office. We receive your mail and let you know when it arrives. Plans start at ₦15,000 a month, and the Business and Premium plans can be used for CAC registration.",
  },
  {
    q: "What is Reenite Academy?",
    a: `Reenite Academy trains people for careers in tech. Through the ${academy.programme} you can apply for a scholarship in tracks like ${academy.tracks.join(", ")}. Apply at scholarship.reenite.com.`,
  },
];

function Faq() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <SectionHeading title="Frequently asked questions" />
        <div data-stagger="" className="mt-12 divide-y divide-border border-y border-border">
          {faqs.map((faq) => (
            <details key={faq.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                {faq.q}
                <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-6 pr-8 leading-relaxed text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center text-muted">
          Still have a question?{" "}
          <a href={hq.whatsapp} className="font-semibold text-brand-600 hover:underline">
            Chat with us on WhatsApp
          </a>{" "}
          or call{" "}
          <a href={hq.phoneHref} className="font-semibold text-foreground hover:underline">
            {hq.phone}
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function FinalCta({ settings }: { settings: BookingSettings }) {
  return (
    <section className="bg-surface px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <div data-reveal="" className="relative mx-auto max-w-7xl overflow-hidden rounded-[24px] bg-navy-950 px-6 py-16 text-center text-white sm:px-12 sm:py-20">
        <div className="home-cta-orbit" aria-hidden="true" />
        <div className="relative">
          <h2 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Work here. Build here. <span className="text-brand-400">Grow here.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-navy-200">
            Come and work at Reenite Spaces, and let our team handle the paperwork while you build.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={bookingHref(settings)} className={buttonClasses({ size: "lg", variant: "light" })}>
              Book a space
            </a>
            <ButtonLink href="/register" size="lg" variant="glass">
              Get started with business services
            </ButtonLink>
            <a href={hq.whatsapp} className={buttonClasses({ size: "lg", variant: "glass" })}>
              <MessageSquare className="size-4" /> WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
