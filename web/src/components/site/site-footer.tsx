import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock, MapPin, MessageSquare, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { academy, hq, pillars, socials, spaceTypes } from "@/content/site";

/** `booking` is where "Book a space" goes (this site or the booking site), set by the admin switch. */
export function SiteFooter({ booking, account }: { booking: { href: string; external: boolean }; account: ReactNode }) {
  return (
    <footer className="bg-navy-950 text-navy-200 print:hidden">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr] lg:px-8">
        <div className="space-y-4">
          <Logo tone="light" className="h-8" />
          <p className="max-w-xs text-sm leading-relaxed">
            Building a business? Don&apos;t build alone. Registration, tax and online presence for Nigerian businesses, done for
            you.
          </p>
          <ul className="flex gap-4 text-sm font-semibold text-white">
            {socials.map((social) => (
              <li key={social.label}>
                <a href={social.href} className="hover:text-brand-400">
                  {social.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold text-white">Services</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {pillars
              .filter((pillar) => pillar.slug !== "workspace")
              .map((pillar) => (
                <li key={pillar.slug}>
                  <Link href={pillar.href} className="hover:text-white">
                    {pillar.title}
                  </Link>
                </li>
              ))}
            <li>
              <Link href="/#virtual-address" className="hover:text-white">
                Virtual address
              </Link>
            </li>
            <li>
              <Link href="/services" className="hover:text-white">
                All services and prices
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold text-white">Workspace</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {spaceTypes.map((space) => (
              <li key={space.slug}>
                <a href={booking.href} className="hover:text-white">
                  {space.title}
                </a>
              </li>
            ))}
            <li>
              <a href={booking.href} className="inline-flex items-center gap-1 font-semibold text-white hover:text-brand-400">
                Book a space {booking.external && <ArrowUpRight className="size-3.5" />}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold text-white">Company</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/about" className="hover:text-white">About us</Link></li>
            <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
            <li>
              <a href={academy.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">
                Reenite Academy <ArrowUpRight className="size-3.5" />
              </a>
            </li>
            <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            <li>{account}</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold text-white">Visit us</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand-400" />
              <span>
                {hq.street}, {hq.city}
              </span>
            </li>
            <li className="flex gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-brand-400" />
              <a href={hq.phoneHref} className="hover:text-white">
                {hq.phone}
              </a>
            </li>
            <li className="flex gap-2.5">
              <MessageSquare className="mt-0.5 size-4 shrink-0 text-brand-400" />
              <a href={hq.whatsapp} className="hover:text-white">
                Chat on WhatsApp
              </a>
            </li>
            <li className="flex gap-2.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-brand-400" />
              {hq.hoursShort}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p>&copy; 2026 Reenite. All rights reserved.</p>
          <p className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/privacy" className="hover:text-white">
              Privacy policy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms of service
            </Link>
            <span>162 Oron Road, Opposite Kilimanjaro, Uyo</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
