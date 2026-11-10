"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyAddress({ lines }: { lines: string[] }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(lines.join("\n"));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the address is on screen to copy by hand.
        }
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy address"}
    </Button>
  );
}
