"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Fades and lifts its content into view the first time it scrolls on screen.
 * Content is only hidden when JS runs (see `.js [data-reveal]` in globals.css).
 */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          element.dataset.reveal = "visible";
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal="" className={className} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

/**
 * Reveals every `data-reveal` and `data-stagger` element on the page as it scrolls into view,
 * including ones added later by client navigation,
 * so server-rendered sections only need the attribute. A `data-stagger` container brings its
 * children in one after another (see globals.css).
 */
export function ScrollReveals() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const element = entry.target as HTMLElement;
          if ("stagger" in element.dataset) {
            element.dataset.stagger = "visible";
          } else {
            element.dataset.reveal = "visible";
          }
          observer.unobserve(element);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const observeAll = () =>
      document.querySelectorAll<HTMLElement>('[data-reveal=""], [data-stagger=""]').forEach((element) => observer.observe(element));
    observeAll();

    // The layout stays mounted across client navigations, so pick up sections the next page adds.
    let frame = 0;
    const mutations = new MutationObserver(() => {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          observeAll();
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
