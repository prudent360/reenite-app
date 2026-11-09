import type { ReactNode } from "react";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** A long legal document: a short navy header, a contents list that stays in view, and readable text. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <>
      <section className="bg-navy-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-16 lg:px-8">
          <p className="font-semibold text-brand-400">Legal</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{title}</h1>
          <p className="mt-4 text-navy-200">Last updated {updated}</p>
        </div>
      </section>

      <div className="bg-surface">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[240px_1fr] lg:gap-16 lg:px-8">
          <nav aria-label="Contents" className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-sm font-semibold text-foreground">Contents</p>
            <ol className="mt-3 space-y-2 text-sm">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-muted hover:text-brand-600">
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="max-w-3xl">
            <div className="text-lg leading-relaxed text-foreground">{intro}</div>
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-24 border-t border-border pt-8 mt-10 first-of-type:mt-10">
                <h2 className="text-xl font-semibold text-foreground">
                  {index + 1}. {section.title}
                </h2>
                <div className="legal-body mt-4 space-y-4 leading-relaxed text-muted">{section.body}</div>
              </section>
            ))}
          </article>
        </div>
      </div>
    </>
  );
}
