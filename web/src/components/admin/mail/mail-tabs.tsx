import Link from "next/link";
import { cn } from "@/lib/utils";

/** Front desk list and mailbox list, as tabs on the Mail page. */
export function MailTabs({ active, requests }: { active: "desk" | "mailboxes"; requests?: number }) {
  const tabs = [
    { key: "desk", href: "/admin/mail", label: "At the front desk" },
    { key: "mailboxes", href: "/admin/mail?view=mailboxes", label: "Mailboxes" },
  ] as const;

  return (
    <nav aria-label="Mail sections" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border px-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
            active === tab.key ? "border-brand-500 text-foreground" : "border-transparent text-muted hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.key === "desk" && requests ? <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs text-white">{requests}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
