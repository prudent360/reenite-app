import QRCode from "qrcode";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** The link the QR code holds: the admin bookings page with the check-in code filled in. */
export function checkInLink(code: string): string {
  return `${site}/admin/bookings?checkin=${encodeURIComponent(code)}`;
}

/**
 * A QR code for the front desk. Staff scan it with any phone camera: it opens the admin bookings
 * page with this code ready to check in, so no scanner app is needed. Anyone else who scans it
 * just reaches the sign-in page.
 */
export async function CheckInQr({ code, className }: { code: string; className?: string }) {
  const svg = await QRCode.toString(checkInLink(code), {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#10152c", light: "#ffffff" },
  });

  return <div role="img" aria-label={`QR code for check-in code ${code}`} className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
