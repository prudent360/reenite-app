import { Check } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col">
        <div className="bg-diamonds absolute inset-0" aria-hidden />
        <LogoMark
          className="absolute -bottom-24 -right-24 size-[28rem] opacity-[0.07]"
          dotClassName="fill-white"
          chevronClassName="fill-white"
        />
        <div className="relative">
          <Logo tone="light" className="h-9" />
        </div>
        <div className="relative mt-auto max-w-md">
          <p className="inline-block bg-brand-500 px-2.5 py-1 font-display text-xl font-extrabold">Building a Business?</p>
          <p className="mt-2 font-display text-4xl font-extrabold leading-tight">Don&apos;t Build Alone.</p>
          <ul className="mt-8 space-y-3 text-navy-100">
            {[
              "Track every filing from your dashboard",
              "Store certificates and documents securely",
              "Get reminders before tax and annual return deadlines",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex size-6 items-center justify-center rounded-full bg-brand-500/20 text-brand-400">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-sm text-navy-400">162 Oron Road, Uyo, Akwa Ibom State</p>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8">
        <div className="lg:hidden">
          <Logo tone="auto" className="h-7" />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
