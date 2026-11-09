import Image from "next/image";
import type { ReactNode } from "react";

type HeroImage = { src: string; alt: string };

/** Navy page header. Pass `image` to show a photo beside the text on wide screens. */
export function PageHero({ eyebrow, title, body, image, children }: { eyebrow: string; title: string; body?: string; image?: HeroImage; children?: ReactNode }) {
  const text = (
    <div>
      <p className="font-semibold text-brand-400">{eyebrow}</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-[1.1] sm:text-5xl">{title}</h1>
      {body && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-navy-100">{body}</p>}
      {children}
    </div>
  );

  return (
    <section className="bg-navy-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        {image ? (
          <div className="grid items-center gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
            {text}
            <div className="relative aspect-[4/3] overflow-hidden rounded-md">
              <Image src={image.src} alt={image.alt} fill priority sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
            </div>
          </div>
        ) : (
          text
        )}
      </div>
    </section>
  );
}
