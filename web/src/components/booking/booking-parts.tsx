import { Badge } from "@/components/ui/card";
import { bookingTones } from "@/lib/booking-format";
import type { Booking } from "@/lib/types";

export function BookingStatusBadge({ booking }: { booking: Pick<Booking, "status" | "status_label"> }) {
  return <Badge tone={bookingTones[booking.status]}>{booking.status_label}</Badge>;
}
