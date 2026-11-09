"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Leans the hero preview back and straightens it as the page scrolls, by setting `--tilt`
 * from 0 (top of the page) to 1 (about 520px down). The transform lives in `.hero-tilt`.
 */
export function HeroTilt({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      element.style.setProperty("--tilt", Math.min(1, window.scrollY / 520).toFixed(3));
    };
    const onScroll = () => {
      if (!frame) {
        frame = requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="hero-tilt">
      {children}
    </div>
  );
}
