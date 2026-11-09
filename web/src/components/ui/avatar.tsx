import { cn, initials } from "@/lib/utils";

const palette = ["bg-navy-900 text-white", "bg-brand-500 text-white", "bg-navy-600 text-white", "bg-brand-100 text-brand-700"];

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const color = palette[name.length % palette.length];

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cn("size-9 rounded-full object-cover", className)} />;
  }

  return (
    <span
      aria-hidden
      className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold", color, className)}
    >
      {initials(name)}
    </span>
  );
}
