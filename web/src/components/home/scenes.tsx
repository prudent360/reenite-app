import {
  Bell,
  CalendarCheck,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  Lock,
  MessageSquare,
  Mic,
  QrCode,
  Receipt,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatBadge, MiniBar, MockWindow } from "./mock";

/* ---------- How it works ---------- */

export const howItWorksSteps = [
  { title: "Choose a service", body: "Pick what your business needs, from CAC registration to tax clearance or a website. Every price is shown upfront." },
  { title: "Pay securely", body: "Pay online by card, bank transfer or USSD. Government fees are listed separately, with no hidden charges." },
  { title: "Our legal experts file", body: "Upload your documents once. Our legal experts file with CAC, FIRS and the state tax office, and update you at every step." },
  { title: "Receive & stay compliant", body: "Download your certificates from your secure vault, and get reminders before every annual return and tax deadline." },
];

export const howItWorksScenes = [
  <div key="choose" className="relative pt-10">
    <FloatBadge icon={Receipt} tone="brand" className="-top-1 left-0 sm:-left-6">
      Fees shown upfront
    </FloatBadge>
    <MockWindow title="Services">
      <ul className="space-y-2.5">
        {[
          { name: "Business Name Registration", meta: "₦35,000 · about 7 days" },
          { name: "Limited Liability Company", meta: "₦105,000 · about 14 days", selected: true },
          { name: "TIN Registration", meta: "₦10,000 · about 3 days" },
        ].map((service) => (
          <li
            key={service.name}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3",
              service.selected ? "border-brand-500 bg-brand-50" : "border-border",
            )}
          >
            <span className={cn("flex size-9 items-center justify-center rounded-lg", service.selected ? "bg-brand-500 text-white" : "bg-navy-50 text-foreground")}>
              <Landmark className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{service.name}</span>
              <span className="block text-xs text-muted">{service.meta}</span>
            </span>
            {service.selected && <CheckCircle2 className="size-5 text-brand-500" />}
          </li>
        ))}
      </ul>
    </MockWindow>
  </div>,

  <div key="pay" className="relative pb-10">
    <MockWindow title="Checkout">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Reenite service fee</dt>
          <dd className="font-medium text-foreground">₦80,000</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Government fees (CAC)</dt>
          <dd className="font-medium text-foreground">₦25,000</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-2">
          <dt className="font-semibold text-foreground">Total</dt>
          <dd className="font-display text-lg font-extrabold text-foreground">₦105,000</dd>
        </div>
      </dl>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-semibold">
        {[
          { label: "Card", icon: CreditCard, active: true },
          { label: "Transfer", icon: Landmark },
          { label: "USSD", icon: Smartphone },
        ].map((method) => (
          <span
            key={method.label}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border py-2.5",
              method.active ? "border-brand-500 text-brand-600" : "border-border text-muted",
            )}
          >
            <method.icon className="size-4" />
            {method.label}
          </span>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-brand-500 py-2.5 text-center text-sm font-semibold text-white">Pay ₦105,000</div>
    </MockWindow>
    <FloatBadge icon={ShieldCheck} tone="success" className="-bottom-1 right-0 sm:-right-6">
      Payment confirmed
    </FloatBadge>
  </div>,

  <div key="file" className="relative pt-10">
    <FloatBadge icon={Bell} tone="brand" className="-top-1 right-0 sm:-right-4">
      Your officer updated your order
    </FloatBadge>
    <MockWindow title="Order RN-2026-000184">
      <p className="text-sm font-bold text-foreground">LTD Company Registration</p>
      <ol className="mt-4">
        {[
          { label: "Documents received", done: true },
          { label: "Name reservation approved", done: true },
          { label: "Filed with CAC", current: true },
          { label: "Certificate issued" },
        ].map((stage, index, stages) => (
          <li key={stage.label} className="relative flex gap-3 pb-4 last:pb-0">
            {index < stages.length - 1 && <span className={cn("absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5", stage.done ? "bg-brand-500" : "bg-navy-100")} />}
            <span
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full",
                stage.done ? "bg-brand-500 text-white" : stage.current ? "bg-navy-900 text-white ring-4 ring-navy-100 dark:bg-navy-700" : "border-2 border-navy-100 bg-surface",
              )}
            >
              {stage.done && <Check className="size-3.5" strokeWidth={3} />}
              {stage.current && <span className="size-2 animate-ping rounded-full bg-brand-400" />}
            </span>
            <span className={cn("text-sm", stage.done || stage.current ? "font-semibold text-foreground" : "text-muted")}>{stage.label}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface-muted p-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-navy-900 text-white dark:bg-navy-700">
          <UserRound className="size-4" />
        </span>
        <span className="text-xs">
          <span className="block font-semibold text-foreground">Ekemini, your Reenite officer</span>
          <span className="text-muted">&ldquo;Filed today. Expect your certificate this week.&rdquo;</span>
        </span>
      </div>
    </MockWindow>
  </div>,

  <div key="receive" className="relative pb-10">
    <MockWindow title="Document vault">
      <ul className="space-y-2.5">
        {[
          { name: "CAC Certificate.pdf", meta: "Added today", fresh: true },
          { name: "Memorandum & Articles.pdf", meta: "Added today", fresh: true },
          { name: "Status Report.pdf", meta: "Added today" },
        ].map((file) => (
          <li key={file.name} className="flex items-center gap-3 rounded-xl border border-border p-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <FileText className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{file.name}</span>
              <span className="block text-xs text-muted">{file.meta}</span>
            </span>
            {file.fresh && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">New</span>}
          </li>
        ))}
      </ul>
    </MockWindow>
    <FloatBadge icon={CalendarCheck} className="-bottom-1 left-0 sm:-left-6">
      Annual returns reminder set
    </FloatBadge>
  </div>,
];

/* ---------- Your business, in one place ---------- */

export const platformFeatures = [
  { title: "Your dashboard", body: "Your next deadline, your open orders and your setup progress, the moment you sign in." },
  { title: "Live order tracking", body: "Follow every filing step by step, and message your officer right on the order." },
  { title: "Secure document vault", body: "Certificates, IDs and filings kept private and encrypted, ready to download any time." },
  { title: "Workspace booking", body: "Book a desk, office, podcast studio or event space in Uyo, and check in with a QR code." },
];

export const platformScenes = [
  <div key="dashboard" className="relative py-10">
    <FloatBadge icon={FileText} tone="brand" className="-top-0 right-0 sm:-right-8">
      Certificate ready
    </FloatBadge>
    <MockWindow title="Dashboard">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-foreground">Good evening, Aniekan</p>
          <p className="text-xs text-muted">Ekpo Ventures Ltd</p>
        </div>
        <div className="relative size-14 shrink-0">
          <svg viewBox="0 0 56 56" className="size-14 -rotate-90" aria-hidden>
            <circle cx="28" cy="28" r="23" fill="none" strokeWidth="6" className="stroke-navy-50" />
            <circle cx="28" cy="28" r="23" fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-brand-500" strokeDasharray={144.5} strokeDashoffset={29} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">80%</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-border p-3">
          <p className="text-[11px] text-muted">Next deadline</p>
          <p className="mt-1 text-sm font-bold text-foreground">Annual returns</p>
          <p className="mt-0.5 text-xs font-semibold text-warning">Due in 14 days</p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-[11px] text-muted">Active order</p>
          <p className="mt-1 text-sm font-bold text-foreground">TIN registration</p>
          <p className="mt-0.5 text-xs font-semibold text-success">Filed today</p>
        </div>
      </div>
      <div className="mt-3 space-y-3 rounded-xl border border-border p-3">
        <MiniBar label="Business setup" value="4 of 5" percent={80} />
        <MiniBar label="Documents" value="6 of 7" percent={86} tone="navy" />
      </div>
    </MockWindow>
    <FloatBadge icon={CalendarCheck} className="-bottom-0 left-0 sm:-left-8">
      Added to your calendar
    </FloatBadge>
  </div>,

  <div key="tracking" className="relative py-10">
    <MockWindow title="Messages · RN-2026-000184">
      <div className="space-y-3 text-sm">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-muted px-3.5 py-2.5 text-foreground">
          Hi Aniekan, your name reservation was approved. I&apos;ve filed the incorporation documents with CAC.
        </div>
        <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-sm bg-navy-900 px-3.5 py-2.5 text-white dark:bg-navy-700">Great, thank you! How long now?</div>
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-muted px-3.5 py-2.5 text-foreground">Usually 3 to 5 working days. I&apos;ll upload the certificate here.</div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm text-muted">
        <MessageSquare className="size-4" /> Reply to Ekemini…
      </div>
    </MockWindow>
    <FloatBadge icon={Bell} tone="brand" className="-top-0 left-0 sm:-left-8">
      New update on your order
    </FloatBadge>
  </div>,

  <div key="vault" className="relative py-10">
    <FloatBadge icon={Lock} tone="success" className="-top-0 right-0 sm:-right-8">
      Encrypted & private
    </FloatBadge>
    <MockWindow title="Documents">
      <div className="grid grid-cols-2 gap-2.5">
        {["CAC Certificate", "MEMART", "TIN Letter", "Director ID", "Utility bill", "Tax clearance"].map((name, index) => (
          <div key={name} className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", index < 3 ? "bg-brand-50 text-brand-600" : "bg-navy-50 text-foreground")}>
              <FileText className="size-4" />
            </span>
            <span className="truncate text-xs font-semibold text-foreground">{name}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <ShieldCheck className="size-4 text-success" /> Only you and your assigned officer can open these.
      </p>
    </MockWindow>
  </div>,

  <div key="workspace" className="relative py-10">
    <MockWindow title="Book a space">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-navy-900 text-white dark:bg-navy-700">
          <Mic className="size-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-foreground">Podcast Studio A</p>
          <p className="text-xs text-muted">Reenite Uyo · up to 4 people</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs font-semibold">
        {["10:00", "12:00", "14:00", "16:00"].map((slot, index) => (
          <span
            key={slot}
            className={cn(
              "rounded-lg border py-2",
              index === 2 ? "border-brand-500 bg-brand-500 text-white" : index === 0 ? "border-border text-muted line-through opacity-60" : "border-border text-foreground",
            )}
          >
            {slot}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-muted p-3">
        <div className="text-xs">
          <p className="font-semibold text-foreground">Tue · 14:00 to 16:00</p>
          <p className="text-muted">Show this code at the front desk</p>
        </div>
        <QrCode className="size-10 text-foreground" />
      </div>
    </MockWindow>
    <FloatBadge icon={CheckCircle2} tone="success" className="-bottom-0 right-0 sm:-right-8">
      Booking confirmed
    </FloatBadge>
  </div>,
];
