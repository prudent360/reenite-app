/** Slowly drifting rings, sweep lines and diamonds behind the hero, echoing the reference design. */
export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 [background-image:linear-gradient(rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:320px_240px]" />
      <svg className="absolute -right-40 -top-56 size-[880px] animate-hero-drift text-white/10" viewBox="0 0 880 880" fill="none">
        <circle cx="440" cy="440" r="430" stroke="currentColor" />
        <circle cx="440" cy="440" r="330" stroke="currentColor" strokeDasharray="4 8" />
        <circle cx="440" cy="440" r="220" stroke="currentColor" />
      </svg>
      <svg className="absolute -bottom-24 -left-20 h-[420px] w-[900px] animate-hero-drift text-white/10 [animation-delay:-7s]" viewBox="0 0 900 420" fill="none">
        {[0, 30, 60, 90, 120].map((offset) => (
          <path key={offset} d={`M0 ${400 - offset} C 300 ${330 - offset}, 520 ${150 - offset / 2}, 900 ${40 + offset / 3}`} stroke="currentColor" />
        ))}
      </svg>
      <svg className="absolute -bottom-10 right-6 hidden size-72 sm:block" viewBox="0 0 280 280" fill="none">
        <rect x="70" y="10" width="110" height="110" transform="rotate(45 125 65)" stroke="rgb(255 255 255 / 0.12)" />
        <rect x="20" y="110" width="110" height="110" transform="rotate(45 75 165)" stroke="rgb(255 255 255 / 0.12)" />
        <rect x="140" y="140" width="110" height="110" transform="rotate(45 195 195)" stroke="#f05a28" strokeOpacity="0.55" strokeWidth="1.5" />
      </svg>
      <div className="absolute -right-24 top-1/3 size-96 rounded-full bg-brand-500/20 blur-3xl" />
    </div>
  );
}
