import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom tokens so e.g. `bg-navy-900` overrides `bg-surface`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "background", "surface", "surface-muted", "foreground", "muted", "border", "ring",
        "success", "success-soft", "warning", "warning-soft", "danger", "danger-soft", "info", "info-soft",
        { navy: ["950", "900", "800", "700", "600", "400", "200", "100", "50"] },
        { brand: ["700", "600", "500", "400", "100", "50"] },
      ],
    },
  },
});

/** Joins class names; later Tailwind classes win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

export function formatDate(value: string | null | undefined): string {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

/** Amounts from the API are in kobo. */
export function formatNaira(kobo: number): string {
  return nairaFormatter.format(kobo / 100);
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}
