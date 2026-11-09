import { LogoMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <LogoMark className="size-14" />
      <p className="mt-8 font-display text-sm font-bold uppercase tracking-wider text-brand-600">404</p>
      <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">We couldn&apos;t find that page</h1>
      <p className="mt-3 max-w-md text-muted">The link may be broken, or the page may have moved.</p>
      <ButtonLink href="/" className="mt-8">
        Back to home
      </ButtonLink>
    </main>
  );
}
