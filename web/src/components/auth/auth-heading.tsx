import type { ReactNode } from "react";

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-extrabold text-foreground">{title}</h1>
      {description && <p className="mt-2 text-muted">{description}</p>}
    </div>
  );
}
