"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { DotLoader } from "./loader";

const controlClasses =
  "w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] text-foreground placeholder:text-navy-400 " +
  "transition-colors focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 " +
  "aria-invalid:border-danger aria-invalid:focus:ring-danger/15 disabled:bg-surface-muted";

type FieldProps = {
  label: string;
  name: string;
  error?: string[];
  hint?: ReactNode;
  /** Shown next to the label, e.g. a "Forgot password?" link. */
  aside?: ReactNode;
};

type TextFieldProps = FieldProps & ComponentProps<"input"> & {
  /** Fixed text inside the input on the left, e.g. "₦". */
  leading?: ReactNode;
  /** Classes for the input itself (e.g. font-mono for API keys); `className` styles the wrapper. */
  inputClassName?: string;
};

export function TextField({
  label,
  name,
  error,
  hint,
  aside,
  leading,
  inputClassName,
  className,
  type = "text",
  ...props
}: TextFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-sm font-medium text-muted">
            {leading}
          </span>
        )}
        <input
          id={id}
          name={name}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(controlClasses, "h-11", isPassword && "pr-11", Boolean(leading) && "pl-10", inputClassName)}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-navy-400 hover:text-foreground"
            aria-label={revealed ? "Hide password" : "Show password"}
          >
            {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  className,
  children,
  ...props
}: FieldProps & ComponentProps<"select">) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        className={cn(controlClasses, "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235c6488%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:18px] bg-[right_12px_center] bg-no-repeat pr-10")}
        {...props}
      >
        {children}
      </select>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

export function TextareaField({ label, name, error, hint, className, ...props }: FieldProps & ComponentProps<"textarea">) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        className={cn(controlClasses, "min-h-28 py-3")}
        {...props}
      />
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

function FieldMessage({ id, error, hint }: { id: string; error?: string[]; hint?: ReactNode }) {
  if (error?.length) {
    return (
      <p id={`${id}-error`} className="text-[13px] text-danger">
        {error[0]}
      </p>
    );
  }
  return hint ? (
    <p id={`${id}-hint`} className="text-[13px] text-muted">
      {hint}
    </p>
  ) : null;
}

/** On/off switch backed by a real checkbox, so it posts "on" in FormData like any checkbox. */
export function SwitchField({
  label,
  description,
  className,
  ...props
}: { label: string; description?: ReactNode } & Omit<ComponentProps<"input">, "type">) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start justify-between gap-4", className)}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" {...props} />
        <span className="h-6 w-11 rounded-full bg-navy-100 transition-colors peer-checked:bg-brand-500 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-500/25 peer-disabled:opacity-50" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Submit button that shows the brand dot loader while its form's action is pending. */
export function SubmitButton({ children, className, ...props }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className={className} {...props}>
      {pending ? <DotLoader className="text-current" /> : children}
    </Button>
  );
}
