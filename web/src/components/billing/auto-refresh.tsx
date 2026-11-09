"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-renders the page every few seconds (up to `times`) while a payment is still being confirmed. */
export function AutoRefresh({ every = 3000, times = 10 }: { every?: number; times?: number }) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= times) {
      return;
    }
    const timer = setTimeout(() => {
      router.refresh();
      setCount((value) => value + 1);
    }, every);
    return () => clearTimeout(timer);
  }, [count, every, times, router]);

  return null;
}
