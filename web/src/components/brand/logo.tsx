import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Full lockup. `tone="light"` is the white version for navy backgrounds;
 * `tone="auto"` follows the colour theme.
 */
export function Logo({
  tone = "dark",
  className,
  href = "/",
}: {
  tone?: "dark" | "light" | "auto";
  className?: string;
  href?: string | null;
}) {
  const lockup = (variant: "dark" | "light", extra?: string) => (
    <Image
      src={variant === "light" ? "/brand/reenite-logo-white.png" : "/brand/reenite-logo-full.png"}
      alt="Reenite"
      width={2344}
      height={626}
      priority
      className={cn("h-8 w-auto", className, extra)}
    />
  );

  const image =
    tone === "auto" ? (
      <>
        {lockup("dark", "dark:hidden")}
        {lockup("light", "hidden dark:block")}
      </>
    ) : (
      lockup(tone)
    );

  return href ? (
    <Link href={href} aria-label="Reenite home" className="inline-flex shrink-0">
      {image}
    </Link>
  ) : (
    image
  );
}

/** The mark only (dots + chevron), drawn inline so it can take any colour. */
export function LogoMark({
  className,
  dotClassName = "fill-navy-900 dark:fill-white",
  chevronClassName = "fill-brand-500",
}: {
  className?: string;
  dotClassName?: string;
  chevronClassName?: string;
}) {
  return (
    <svg viewBox="0 0 1195 1256" aria-hidden className={cn("size-8", className)}>
      <circle cx="585" cy="230" r="230" className={dotClassName} />
      <circle cx="230" cy="635" r="230" className={dotClassName} />
      <circle cx="585" cy="1026" r="230" className={dotClassName} />
      <polygon points="692,635 1060,268 1195,404 963,635 1195,869 1060,1004" className={chevronClassName} />
    </svg>
  );
}
