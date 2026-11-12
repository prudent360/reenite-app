import { Suspense } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getOptionalUser, homeFor } from "@/lib/session";
import { cn, firstName } from "@/lib/utils";

type Variant = "bar" | "compact" | "menu" | "footer";

/**
 * "Sign in / Get started" for visitors, "Dashboard" (or "Admin" for staff) once signed in.
 * Rendered on the server and streamed in, so the cached page shell stays shared; the placeholder
 * keeps the space without flashing the wrong buttons.
 */
export function HeaderAccount({ variant }: { variant: Variant }) {
  return (
    <Suspense fallback={<Placeholder variant={variant} />}>
      <Account variant={variant} />
    </Suspense>
  );
}

async function Account({ variant }: { variant: Variant }) {
  const user = await getOptionalUser();

  if (!user) {
    switch (variant) {
      case "bar":
        return (
          <>
            <ButtonLink href="/login" variant="glass" size="sm" className="px-4">
              Sign in
            </ButtonLink>
            <ButtonLink href="/register" variant="light" size="sm" className="px-4">
              Get started
            </ButtonLink>
          </>
        );
      case "compact":
        return (
          <ButtonLink href="/register" variant="light" size="sm" className="px-3.5">
            Get started
          </ButtonLink>
        );
      case "menu":
        return (
          <>
            <ButtonLink href="/login" variant="glass" size="lg">
              Sign in
            </ButtonLink>
            <ButtonLink href="/register" variant="light" size="lg">
              Get started
            </ButtonLink>
          </>
        );
      default:
        return (
          <Link href="/login" className="hover:text-white">
            Sign in
          </Link>
        );
    }
  }

  const href = homeFor(user);
  const label = user.type === "staff" ? "Admin" : "Dashboard";

  switch (variant) {
    case "bar":
      return (
        <>
          <span className="hidden text-sm text-navy-100 xl:inline">Hi, {firstName(user.name)}</span>
          <ButtonLink href={href} variant="light" size="sm" className="px-4">
            <LayoutDashboard className="size-4" /> {label}
          </ButtonLink>
        </>
      );
    case "compact":
      return (
        <ButtonLink href={href} variant="light" size="sm" className="px-3.5">
          {label}
        </ButtonLink>
      );
    case "menu":
      return (
        <ButtonLink href={href} variant="light" size="lg" className="col-span-2">
          <LayoutDashboard className="size-5" /> Go to your {label.toLowerCase()}
        </ButtonLink>
      );
    default:
      return (
        <Link href={href} className="hover:text-white">
          {label === "Admin" ? "Admin" : "My dashboard"}
        </Link>
      );
  }
}

function Placeholder({ variant }: { variant: Variant }) {
  const sizes: Record<Variant, string> = { bar: "h-9 w-48", compact: "h-9 w-28", menu: "col-span-2 h-13", footer: "h-5 w-16" };
  return <span aria-hidden className={cn("inline-block rounded-xl", sizes[variant])} />;
}
