"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { adminNav, customerNav, filterNav, type NavLink } from "./nav-config";

type Entry = NavLink & { group: string };

function entriesFor(area: "customer" | "admin", allowed?: string[]): Entry[] {
  const seen = new Set<string>();
  return filterNav(area === "admin" ? adminNav : customerNav, allowed).flatMap((section) =>
    section.items
      .flatMap((item) => (item.children ? item.children : [item]))
      .filter((link) => !seen.has(link.href) && seen.add(link.href))
      .map((link) => ({ ...link, group: section.title })),
  );
}

function matches(entry: Entry, query: string): boolean {
  const haystack = `${entry.label} ${entry.group} ${entry.keywords ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** "Search or jump to…" trigger plus a ⌘K / Ctrl+K command palette over the pages this user can open. */
export function CommandPalette({ area, allowed }: { area: "customer" | "admin"; allowed?: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo(() => entriesFor(area, allowed), [area, allowed]);
  const results = useMemo(() => (query.trim() ? entries.filter((entry) => matches(entry, query)) : entries), [entries, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }

  function go(entry: Entry | undefined) {
    if (!entry) {
      return;
    }
    close();
    router.push(entry.href);
  }

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[cursor]);
    } else if (event.key === "Escape") {
      close();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-11 w-full max-w-md items-center gap-3 rounded-xl border border-border bg-surface px-3.5 text-left text-sm text-muted shadow-sm transition hover:border-navy-200 dark:hover:border-navy-400"
      >
        <Search className="size-[18px] shrink-0" />
        <span className="flex-1 truncate">Search or jump to…</span>
        <kbd className="hidden rounded-md border border-border bg-surface-muted px-1.5 py-0.5 font-sans text-[11px] font-medium sm:inline">⌘ K</kbd>
      </button>

      {/* Portal to <body>: the sticky, blurred header would otherwise trap this fixed overlay. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
          <button type="button" aria-label="Close search" onClick={close} className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-pop">
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-5 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Search pages…"
                aria-label="Search pages"
                aria-controls="command-results"
                aria-activedescendant={results[cursor] ? `command-${results[cursor].href}` : undefined}
                className="h-14 flex-1 bg-transparent text-base text-foreground placeholder:text-muted focus:outline-none"
              />
              <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
            </div>

            <ul id="command-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && <li className="px-3 py-10 text-center text-sm text-muted">No pages match &ldquo;{query}&rdquo;.</li>}
              {results.map((entry, index) => (
                <li key={entry.href} id={`command-${entry.href}`} role="option" aria-selected={index === cursor}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(entry)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                      index === cursor ? "bg-surface-muted" : "",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg",
                        index === cursor ? "bg-navy-900 text-white dark:bg-navy-700" : "bg-navy-50 text-muted",
                      )}
                    >
                      <entry.icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{entry.label}</span>
                      <span className="block text-xs text-muted">{entry.group}</span>
                    </span>
                    {index === cursor && <CornerDownLeft className="size-4 text-muted" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function CommandPaletteSkeleton() {
  return <div className="skeleton h-11 w-full max-w-md rounded-xl" aria-hidden />;
}
