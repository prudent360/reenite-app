"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Time left on a payment hold, ticking down. Refreshes the page when it runs out. */
export function HoldCountdown({ until }: { until: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, new Date(until).getTime() - now);

  useEffect(() => {
    if (remaining === 0) {
      router.refresh();
      return;
    }
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [now, remaining, router]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const hours = Math.floor(minutes / 60);

  return <span className="font-mono font-semibold tabular-nums text-foreground">{hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}:${String(seconds).padStart(2, "0")}`}</span>;
}
