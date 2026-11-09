"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "reenite.theme";
const CHANGE_EVENT = "reenite:theme";
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "system" ? value : "light";
  } catch {
    return "light";
  }
}

/** Mirrors the inline script in the root layout. */
function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && darkQuery().matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  // The server can't know the saved choice, so nothing is highlighted until hydration.
  const preference = useSyncExternalStore<ThemePreference | null>(subscribe, readPreference, () => null);

  // Follow the OS while "System" is selected.
  useEffect(() => {
    if (preference !== "system") {
      return;
    }
    const query = darkQuery();
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  function choose(value: ThemePreference) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {}
    applyTheme(value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  if (compact) {
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === preference));
    const next = options[(currentIndex + 1) % options.length]!;
    const Current = options[currentIndex]!.icon;
    return (
      <button
        type="button"
        onClick={() => choose(next.value)}
        title={`Theme: ${options[currentIndex]!.label}. Switch to ${next.label}`}
        aria-label={`Theme: ${options[currentIndex]!.label}. Switch to ${next.label}`}
        className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-surface-muted hover:text-foreground"
      >
        <Current className="size-[18px]" />
      </button>
    );
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-muted p-1">
      {options.map((option) => {
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(option.value)}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
              active ? "bg-surface text-brand-600 shadow-card" : "text-muted hover:text-foreground",
            )}
          >
            <option.icon className="size-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
