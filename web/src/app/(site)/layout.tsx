import { ScrollReveals } from "@/components/home/reveal";
import { bookingHref, getBookingSettings } from "@/lib/booking";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const settings = await getBookingSettings();
  const booking = { href: bookingHref(settings), external: settings.destination === "external" };

  return (
    <>
      <SiteHeader booking={booking} />
      {/* Reveals [data-reveal] and [data-stagger] sections on every public page. */}
      <ScrollReveals />
      <main className="flex-1">{children}</main>
      <SiteFooter booking={booking} />
    </>
  );
}
