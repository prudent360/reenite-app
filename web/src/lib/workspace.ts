import type { AddonChargeType, OpeningDay, RateUnit } from "@/lib/types";

export const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const rateUnits: { unit: RateUnit; label: string; per: string }[] = [
  { unit: "hour", label: "Hourly", per: "hour" },
  { unit: "day", label: "Daily", per: "day" },
  { unit: "week", label: "Weekly", per: "week" },
  { unit: "month", label: "Monthly", per: "month" },
];

export const chargeTypes: Record<AddonChargeType, string> = {
  per_booking: "per booking",
  per_hour: "per hour",
  per_person: "per person",
};

export const defaultHours = (): OpeningDay[] =>
  [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, opens: day === 7 ? null : "09:00", closes: day === 7 ? null : "20:00", closed: day === 7 }));

/** "9:00am" from "09:00". */
export function formatTime(value: string | null): string {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

/**
 * Collapses a week into readable lines: "Mon to Sat, 9:00am to 8:00pm", "Sun, closed".
 */
export function summariseHours(hours: OpeningDay[]): string[] {
  const short = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const key = (day: OpeningDay) => (day.closed ? "closed" : `${day.opens}-${day.closes}`);
  const groups: { from: number; to: number; day: OpeningDay }[] = [];
  for (const day of [...hours].sort((a, b) => a.day - b.day)) {
    const last = groups.at(-1);
    if (last && key(last.day) === key(day) && last.to === day.day - 1) last.to = day.day;
    else groups.push({ from: day.day, to: day.day, day });
  }
  return groups.map(({ from, to, day }) => {
    const days = from === to ? short[from] : `${short[from]} to ${short[to]}`;
    return day.closed ? `${days}, closed` : `${days}, ${formatTime(day.opens)} to ${formatTime(day.closes)}`;
  });
}

/** "45 min", "2 hours", "1 day", "1 week". */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "No limit";
  if (minutes % 10080 === 0) return plural(minutes / 10080, "week");
  if (minutes % 1440 === 0) return plural(minutes / 1440, "day");
  if (minutes % 60 === 0) return plural(minutes / 60, "hour");
  return minutes > 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`;
